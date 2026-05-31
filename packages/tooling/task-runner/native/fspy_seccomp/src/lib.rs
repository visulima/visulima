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
//! │ posix_spawn(                 │   ┌────────────────────────────┐
//! │   "fspy-seccomp-helper",     │   │ helper (fresh single-      │
//! │   argv=[target_cmd, args],   │──►│ threaded process)          │
//! │   env={FSPY_SOCK=<path>})    │   │  1. PR_SET_NO_NEW_PRIVS    │
//! │                              │   │  2. seccomp_load -> fd     │
//! │ accept connection            │◄──│  3. connect to FSPY_SOCK   │
//! │ recv notify_fd via SCM_RIGHTS│◄──│  4. send fd via SCM_RIGHTS │
//! │                              │   │  5. execve(target)         │
//! │ run supervisor on notify_fd  │   └────────────────────────────┘
//! │ wait(child)                  │
//! └──────────────────────────────┘
//! ```
//!
//! `posix_spawn` uses `vfork+exec` internally — safe to call from
//! a multi-threaded parent. The helper is a single-threaded process
//! when it does the seccomp install; no fork-in-multithreaded
//! exposure anywhere.
//!
//! The helper binary is `src/bin/helper.rs` (see `Cargo.toml`
//! `[[bin]]` entry); packaging ships it next to the `.node` addon.

#![cfg(target_os = "linux")]
#![deny(unused_must_use)]

use std::io::{self, Read};
use std::os::unix::ffi::OsStrExt;
use std::os::unix::io::{AsRawFd, FromRawFd, IntoRawFd, OwnedFd, RawFd};
use std::os::unix::process::ExitStatusExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::mpsc::sync_channel;
use std::thread;

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

/// Optional spawn settings for the tracked command. None means
/// "inherit from the parent" (cwd + env).
#[derive(Debug, Default, Clone)]
pub struct SpawnOptions {
    pub cwd: Option<PathBuf>,
    /// Extra env vars merged on top of the parent's. Use this for
    /// per-command overrides (e.g. enhanced PATH, NODE_OPTIONS).
    pub env: Vec<(String, String)>,
}

/// Spawn `cmd` under seccomp tracking. The parent listens on a
/// Unix socket; `posix_spawn` invokes `helper_path` with the
/// socket path as `FSPY_SOCK`; the helper sends the notify fd back
/// via SCM_RIGHTS and execves the target.
///
/// `cmd[0]` is the target program path (resolved via `$PATH` by
/// the helper's `execvp`); `cmd[1..]` are its arguments.
///
/// `helper_path` must point at a `fspy-seccomp-helper` binary
/// shipping alongside this library (typically packaged with the
/// `.node` addon).
pub fn track_command(
    cmd: &[String],
    helper_path: &Path,
    opts: &SpawnOptions,
) -> io::Result<TrackingResult> {
    if cmd.is_empty() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "track_command requires at least the program path",
        ));
    }

    // Per-spawn Unix socket path. Random suffix to avoid collisions
    // when many trackers run concurrently in the same temp dir.
    let sock_path = mk_socket_path();

    // Bind + listen before spawning so the helper's connect can
    // never race against an unready listener.
    let listener = bind_listener(&sock_path)?;
    // Ensure the socket file is removed even on early-return paths.
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

    let mut child = command.spawn()?;

    // Accept the helper's connection, recv the notify fd via
    // SCM_RIGHTS. The helper hands off once and execves; we never
    // accept a second connection.
    let notify_fd = accept_and_recv_fd(&listener)?;

    // Supervisor runs in a thread so we can simultaneously read
    // stdio + wait on the child without deadlocking.
    let (tx, rx) = sync_channel::<io::Result<Vec<FileAccess>>>(0);
    let supervisor_fd = notify_fd;
    let supervisor_thread = thread::spawn(move || {
        let result = supervisor::run(supervisor_fd);
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

    let exit_code = status
        .code()
        .or_else(|| status.signal().map(|s| 128 + s))
        .unwrap_or(-1);

    Ok(TrackingResult {
        accesses,
        exit_code,
        stdout,
        stderr,
    })
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

fn bind_listener(path: &Path) -> io::Result<OwnedFd> {
    let fd = unsafe { libc::socket(libc::AF_UNIX, libc::SOCK_STREAM | libc::SOCK_CLOEXEC, 0) };
    if fd < 0 {
        return Err(io::Error::last_os_error());
    }
    let owned = unsafe { OwnedFd::from_raw_fd(fd) };

    let path_bytes = path.as_os_str().as_bytes();
    if path_bytes.len() >= 108 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "socket path too long for sockaddr_un",
        ));
    }
    let mut addr: libc::sockaddr_un = unsafe { std::mem::zeroed() };
    addr.sun_family = libc::AF_UNIX as libc::sa_family_t;
    for (i, &b) in path_bytes.iter().enumerate() {
        addr.sun_path[i] = b as libc::c_char;
    }
    let addr_len = std::mem::size_of::<libc::sa_family_t>() + path_bytes.len() + 1;

    let rc = unsafe {
        libc::bind(
            owned.as_raw_fd(),
            &addr as *const _ as *const libc::sockaddr,
            addr_len as u32,
        )
    };
    if rc != 0 {
        return Err(io::Error::last_os_error());
    }
    let rc = unsafe { libc::listen(owned.as_raw_fd(), 1) };
    if rc != 0 {
        return Err(io::Error::last_os_error());
    }

    Ok(owned)
}

fn accept_and_recv_fd(listener: &OwnedFd) -> io::Result<RawFd> {
    let conn = unsafe { libc::accept(listener.as_raw_fd(), std::ptr::null_mut(), std::ptr::null_mut()) };
    if conn < 0 {
        return Err(io::Error::last_os_error());
    }
    let conn_owned = unsafe { OwnedFd::from_raw_fd(conn) };

    let mut data: u8 = 0;
    let mut iov = libc::iovec {
        iov_base: &mut data as *mut u8 as *mut libc::c_void,
        iov_len: 1,
    };
    let mut cmsg_buf = [0u8; 32];
    let mut msg: libc::msghdr = unsafe { std::mem::zeroed() };
    msg.msg_iov = &mut iov;
    msg.msg_iovlen = 1;
    msg.msg_control = cmsg_buf.as_mut_ptr() as *mut libc::c_void;
    msg.msg_controllen = cmsg_buf.len() as _;

    let rc = unsafe { libc::recvmsg(conn_owned.as_raw_fd(), &mut msg, 0) };
    if rc < 0 {
        return Err(io::Error::last_os_error());
    }
    if rc == 0 {
        return Err(io::Error::new(
            io::ErrorKind::UnexpectedEof,
            "helper closed connection before sending notify fd",
        ));
    }

    let cmsg = unsafe { libc::CMSG_FIRSTHDR(&msg) };
    if cmsg.is_null() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "no SCM_RIGHTS ancillary data from helper",
        ));
    }
    let (level, ty) = unsafe { ((*cmsg).cmsg_level, (*cmsg).cmsg_type) };
    if level != libc::SOL_SOCKET || ty != libc::SCM_RIGHTS {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("unexpected cmsg level/type {level}/{ty}"),
        ));
    }
    let fd = unsafe { std::ptr::read(libc::CMSG_DATA(cmsg) as *const RawFd) };
    if fd < 0 {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "received invalid fd"));
    }
    Ok(fd)
}

/// Force a use of `OwnedFd::into_raw_fd` so the import doesn't show
/// as dead. Removed once a future caller (e.g. detecting helper
/// crash without exit code) actually owns notify-fd lifetimes here.
#[allow(dead_code)]
fn _force_ownedfd_into_raw_fd(fd: OwnedFd) -> RawFd {
    fd.into_raw_fd()
}
