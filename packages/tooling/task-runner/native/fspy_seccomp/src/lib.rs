//! `fspy_seccomp` — Linux file-access tracker via `seccomp_unotify`.
//!
//! ## Architecture (helper-binary pattern)
//!
//! The fork-from-multithreaded hazard rules out installing the
//! seccomp filter in a `pre_exec` hook when the parent is something
//! like Node (multi-threaded: V8 + libuv + tokio workers). The
//! supervisor would inherit allocator + libseccomp locks held by
//! sibling threads at fork time and could deadlock between fork
//! and execve.
//!
//! Architecture, instead:
//!
//! ```text
//! parent (Node + .node addon)
//! ┌──────────────────────────────┐
//! │ create Unix socket listener  │
//! │ at $TMPDIR/fspy-XXXX.sock    │
//! │                              │
//! │ Command::spawn(              │   ┌────────────────────────────┐
//! │   "fspy-seccomp-helper",     │   │ helper (fresh single-      │
//! │   argv=[target_cmd, args],   │──►│ threaded process)          │
//! │   env={FSPY_SOCK=<path>})    │   │  1. PR_SET_NO_NEW_PRIVS    │
//! │   (posix_spawn under hood —  │   │  2. seccomp_load -> fd     │
//! │    no pre_exec hook)         │   │  3. connect to FSPY_SOCK   │
//! │                              │   │  4. send fd via SCM_RIGHTS │
//! │ accept connection            │◄──│  5. execve(target)         │
//! │ recv notify_fd via SCM_RIGHTS│◄──│                            │
//! │                              │   └────────────────────────────┘
//! │ supervisor thread:           │
//! │   seccomp_notify_receive     │
//! │   -> classify(notif, pid)    │
//! │   -> CONTINUE                │
//! │ drain stdout/stderr pipes    │
//! │ wait(child)                  │
//! └──────────────────────────────┘
//! ```
//!
//! `Command::spawn` without a `pre_exec` hook uses `posix_spawn`
//! under the hood — multi-thread-safe (vfork+exec internally). The
//! helper is a single-threaded process when it does the seccomp
//! install; no fork-in-multithreaded exposure anywhere.

#![cfg(target_os = "linux")]
#![deny(unused_must_use)]

use std::io::{self, IoSliceMut, Read};
use std::os::fd::AsFd;
use std::os::unix::io::{AsRawFd, FromRawFd, OwnedFd, RawFd};
use std::os::unix::process::ExitStatusExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::mpsc::sync_channel;
use std::thread;
use std::time::{Duration, Instant};

use nix::cmsg_space;
use nix::poll::{poll, PollFd, PollFlags, PollTimeout};
use nix::sys::socket::{
    accept, bind, listen, recvmsg, socket, AddressFamily, Backlog, ControlMessageOwned, MsgFlags, SockFlag, SockType,
    UnixAddr,
};

pub mod filter;
pub mod peer;
pub mod supervisor;
pub mod syscalls;

/// One observed file access. Mirrors the TypeScript-side
/// `FileAccess` interface in `src/file-access-tracker.ts`.
#[derive(Debug, Clone)]
pub struct FileAccess {
    pub path: PathBuf,
    pub kind: AccessKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AccessKind {
    Read,
    ReadDir,
    Stat,
    Write,
    Missing,
}

/// Result of tracking a single command invocation. `stdout` /
/// `stderr` are captured separately so the orchestrator can present
/// each stream independently (UI parity with the strace path).
#[derive(Debug, Default)]
pub struct TrackingResult {
    pub accesses: Vec<FileAccess>,
    pub exit_code: i32,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
}

/// Optional spawn settings for the tracked command. `None` fields
/// fall through to parent-process inheritance.
#[derive(Debug, Default, Clone)]
pub struct SpawnOptions {
    pub cwd: Option<PathBuf>,
    /// Extra env vars merged on top of the parent's. Use this for
    /// per-command overrides (e.g. enhanced PATH, NODE_OPTIONS).
    pub env: Vec<(String, String)>,
}

/// Spawn `cmd` under seccomp tracking. The parent listens on a
/// Unix socket; `Command::spawn` invokes `helper_path` with the
/// socket path as `FSPY_SOCK`; the helper sends the notify fd back
/// via SCM_RIGHTS and execves the target.
///
/// `cmd[0]` is the target program path (resolved via `$PATH` by
/// the helper's `execvp`); `cmd[1..]` are its arguments.
///
/// `helper_path` must point at a `fspy-seccomp-helper` binary
/// shipping alongside this library (typically packaged with the
/// `.node` addon).
///
/// `on_started` (when present) is invoked once with the helper PID
/// as soon as the spawn succeeds. The PID is the same one that
/// becomes the target process post-`execve`, so callers can register
/// it for SIGTERM-on-abort cleanup. The callback runs synchronously
/// on the calling thread before `accept_and_recv_fd` blocks.
pub fn track_command(
    cmd: &[String],
    helper_path: &Path,
    opts: &SpawnOptions,
    on_started: Option<&mut dyn FnMut(u32)>,
) -> io::Result<TrackingResult> {
    if cmd.is_empty() {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "track_command requires at least the program path"));
    }

    let sock_path = mk_socket_path();
    let listener = bind_listener(&sock_path).map_err(|e| e)?;
    // Remove the socket file even on early-return paths.
    let _socket_cleanup = SocketCleanup(sock_path.clone());

    // Spawn the helper via std::process::Command. Without a
    // pre_exec hook configured Rust uses posix_spawn under the hood
    // (multi-thread-safe — uses vfork+exec internally), so the
    // fork-in-multithreaded hazard that breaks the strace-style
    // pre_exec install doesn't apply. Stdio::piped lets us capture
    // the target's output for the orchestrator.
    let mut command = Command::new(helper_path);
    command.arg(&cmd[0]);
    command.args(&cmd[1..]);
    command.env("FSPY_SOCK", &sock_path);
    if let Some(cwd) = &opts.cwd {
        command.current_dir(cwd);
    }
    for (k, v) in &opts.env {
        command.env(k, v);
    }
    command.stdin(Stdio::null());
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());

    let mut child = command.spawn().map_err(|e| e)?;

    // Surface the PID immediately so callers can register the
    // helper for kill-on-abort. The PID survives the helper→target
    // execve, so a future SIGTERM hits the actual target.
    if let Some(cb) = on_started {
        cb(child.id());
    }

    // ChildGuard ensures the helper is killed + reaped on every
    // early return between spawn and the wait at the bottom. Without
    // this an error from accept_and_recv_fd / supervisor::run would
    // leak the helper (and any target it had execvp'd) as a zombie.
    let mut guard = ChildGuard::new(&mut child);

    // Accept the helper's connection (with a watchdog: if the helper
    // dies before connecting we'd otherwise block forever in accept).
    // The helper hands off once and execves; we never accept a
    // second connection.
    let notify_fd = accept_and_recv_fd(&listener, &mut guard).map_err(|e| e)?;

    // Past the accept handoff: from here on the helper is the target
    // process — let the regular wait below reap it instead of the
    // guard killing it. `release` flips the guard to no-op so Drop
    // doesn't double-wait.
    let child = guard.release();

    // Supervisor runs in a thread so we can simultaneously read
    // stdio + wait on the child without deadlocking.
    let (tx, rx) = sync_channel::<io::Result<Vec<FileAccess>>>(0);
    let supervisor_fd = notify_fd;
    let supervisor_thread = thread::spawn(move || {
        let result = supervisor::run(supervisor_fd);
        // Closing the fd matches "parent owns the listener" — once
        // the supervisor returns we have no further use for it.
        unsafe { libc::close(supervisor_fd) };
        let _ = tx.send(result);
    });

    // Drain stdout/stderr on dedicated threads. Reading inline would
    // deadlock if the child wrote enough to fill the pipe buffer
    // (~64 KiB) while we waited on the supervisor.
    let mut child_stdout = child.stdout.take();
    let mut child_stderr = child.stderr.take();
    let stdout_thread = thread::spawn(move || -> io::Result<Vec<u8>> {
        let mut buf = Vec::new();
        if let Some(mut s) = child_stdout.take() {
            s.read_to_end(&mut buf)?;
        }
        Ok(buf)
    });
    let stderr_thread = thread::spawn(move || -> io::Result<Vec<u8>> {
        let mut buf = Vec::new();
        if let Some(mut s) = child_stderr.take() {
            s.read_to_end(&mut buf)?;
        }
        Ok(buf)
    });

    let status = child.wait()?;

    let accesses = match rx.recv() {
        Ok(Ok(list)) => list,
        Ok(Err(e)) => {
            let _ = supervisor_thread.join();
            return Err(e);
        }
        Err(_) => Vec::new(),
    };
    let _ = supervisor_thread.join();

    let stdout = stdout_thread.join().unwrap_or_else(|_| Ok(Vec::new())).unwrap_or_default();
    let stderr = stderr_thread.join().unwrap_or_else(|_| Ok(Vec::new())).unwrap_or_default();

    let exit_code = status.code().or_else(|| status.signal().map(|s| 128 + s)).unwrap_or(-1);

    Ok(TrackingResult { accesses, exit_code, stdout, stderr })
}

fn mk_socket_path() -> PathBuf {
    let pid = std::process::id();
    // Counter for the rare case of N trackers in the same process
    // within the same nanosecond — pid alone isn't unique enough.
    static COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let seq = COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    std::env::temp_dir().join(format!("fspy-{pid}-{seq}.sock"))
}

struct SocketCleanup(PathBuf);
impl Drop for SocketCleanup {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

/// Bind a Unix-stream listener at `path`. Unlinks any stale file
/// at the same path first — a previous crashed run sharing our pid
/// could otherwise make `bind` fail with `EADDRINUSE`. Path-length
/// bounds checking is done by `UnixAddr::new`.
fn bind_listener(path: &Path) -> io::Result<OwnedFd> {
    // Best-effort unlink. If the file doesn't exist (the normal
    // case) we get ENOENT and ignore it. Any other error will surface
    // again from bind() with a more useful message.
    let _ = std::fs::remove_file(path);

    let fd = socket(AddressFamily::Unix, SockType::Stream, SockFlag::SOCK_CLOEXEC, None).map_err(to_io)?;

    let addr = UnixAddr::new(path).map_err(to_io)?;
    bind(fd.as_raw_fd(), &addr).map_err(to_io)?;
    listen(&fd, Backlog::new(1).unwrap()).map_err(to_io)?;

    Ok(fd)
}

/// Accept the helper's connection and receive the seccomp notify fd
/// via `SCM_RIGHTS`. Polls the listener with the helper's exit as a
/// watchdog: if the helper dies before connecting we surface the
/// failure instead of hanging in `accept` forever.
fn accept_and_recv_fd(listener: &OwnedFd, guard: &mut ChildGuard<'_>) -> io::Result<RawFd> {
    // Total time we'll wait for the helper to do prctl + seccomp_load
    // + connect. Generous enough for a slow/cold CI box.
    const ACCEPT_DEADLINE: Duration = Duration::from_secs(5);
    // Poll in short ticks and re-check the helper's liveness each one.
    // A single 5s poll would block the full timeout when the helper
    // dies at seccomp_load (common in sandboxes that disallow the
    // user-notif filter) — it exits *before* connecting, so the
    // listener never becomes readable. Ticking lets us notice the
    // exit within ~one tick and fail fast so the caller can fall back
    // to strace / no-tracking instead of hanging.
    let tick = PollTimeout::from(100u16);
    let mut poll_fds = [PollFd::new(listener.as_fd(), PollFlags::POLLIN)];
    let start = Instant::now();

    loop {
        match poll(&mut poll_fds, tick) {
            Ok(0) => {
                // Tick elapsed with no connection. If the helper has
                // exited, surface that immediately (it failed before
                // the handshake — e.g. seccomp_load denied).
                if let Some(status) = guard.try_check_exit()? {
                    return Err(io::Error::new(
                        io::ErrorKind::BrokenPipe,
                        format!("fspy helper exited before connecting (status: {status:?})"),
                    ));
                }

                if start.elapsed() >= ACCEPT_DEADLINE {
                    return Err(io::Error::new(
                        io::ErrorKind::TimedOut,
                        format!("fspy helper did not connect within {}s", ACCEPT_DEADLINE.as_secs()),
                    ));
                }

                continue;
            }
            Ok(_) => break,
            Err(nix::errno::Errno::EINTR) => continue,
            Err(e) => return Err(to_io(e)),
        }
    }

    let conn = accept(listener.as_raw_fd()).map_err(to_io)?;
    // SAFETY: accept returns an owned fd on success.
    let conn_owned = unsafe { OwnedFd::from_raw_fd(conn) };

    // recvmsg with a single SCM_RIGHTS-sized cmsg buffer. nix
    // handles the buffer alignment + cmsg framing for us — the
    // cmsg_space! macro sizes it correctly for one RawFd payload.
    let mut iov_buf = [0u8; 1];
    let mut iov = [IoSliceMut::new(&mut iov_buf)];
    let mut cmsg = cmsg_space!(RawFd);

    let msg: nix::sys::socket::RecvMsg<'_, '_, ()> =
        recvmsg(conn_owned.as_raw_fd(), &mut iov, Some(&mut cmsg), MsgFlags::empty()).map_err(to_io)?;

    if msg.bytes == 0 {
        return Err(io::Error::new(io::ErrorKind::UnexpectedEof, "helper closed connection before sending notify fd"));
    }

    for cmsg in msg.cmsgs().map_err(to_io)? {
        if let ControlMessageOwned::ScmRights(fds) = cmsg {
            if let Some(&fd) = fds.first() {
                return Ok(fd);
            }
        }
    }

    Err(io::Error::new(io::ErrorKind::InvalidData, "no SCM_RIGHTS fd in helper's message"))
}

fn to_io(e: nix::errno::Errno) -> io::Error {
    io::Error::from_raw_os_error(e as i32)
}

/// RAII guard that kills + reaps a helper child if the caller drops
/// out of `track_command` before the regular `wait`. Required to
/// avoid orphaning the helper (and any target it execvp'd) on the
/// error paths between `Command::spawn` and the final `child.wait`.
struct ChildGuard<'a> {
    /// `Some` while active, `None` after `release()` — Drop short-
    /// circuits on `None` so the regular wait at the bottom of
    /// `track_command` does the reaping without a double-wait.
    child: Option<&'a mut std::process::Child>,
}

impl<'a> ChildGuard<'a> {
    fn new(child: &'a mut std::process::Child) -> Self {
        Self { child: Some(child) }
    }

    fn release(mut self) -> &'a mut std::process::Child {
        self.child.take().expect("ChildGuard released twice")
    }

    fn try_check_exit(&mut self) -> io::Result<Option<std::process::ExitStatus>> {
        match self.child.as_mut() {
            Some(child) => child.try_wait(),
            None => Ok(None),
        }
    }
}

impl<'a> Drop for ChildGuard<'a> {
    fn drop(&mut self) {
        if let Some(child) = self.child.as_mut() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}
