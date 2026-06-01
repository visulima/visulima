//! NAPI surface for `fspy_macos` — macOS-only.
//!
//! `trackWithInterpose(argv, dylibPath, options, onStarted)` spawns the
//! **directly-exec'd** target (never `/bin/sh` — macOS SIP strips
//! `DYLD_INSERT_LIBRARIES` from system binaries and their children) with the
//! interpose dylib at `dylibPath` injected, and resolves with the file
//! accesses the dylib reported once the child exits.
//!
//! ## Wire
//!
//! Parent and child share an `AF_UNIX`/`SOCK_DGRAM` socketpair. The child's
//! end (a plain inherited fd, number passed via `FSPY_MACOS_FD`) is the only
//! write end; when the child and all its descendants exit, every write end
//! closes and the parent's `recv` returns `0` (EOF) — that's the loop's
//! natural terminator. Each datagram is `[u8 mode][path bytes]`.
//!
//! ## Path resolution
//!
//! The dylib sends paths verbatim (it can't cheaply canonicalise in an
//! arbitrary process). Relative paths are joined against the spawn `cwd`
//! here; absolute paths pass through. The TypeScript caller does the
//! workspace-root + exclusion filtering, identical to the seccomp path.

#![cfg(target_os = "macos")]

use std::collections::HashMap;
use std::io::Read;
use std::os::unix::io::{FromRawFd, RawFd};
use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;

use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;

/// Mirrors the TypeScript `FileAccess` shape in `src/file-access-tracker.ts`.
#[napi(object)]
pub struct InterposeFileAccess {
    pub path: String,
    pub kind: String,
}

#[napi(object)]
pub struct InterposeTrackingResult {
    pub accesses: Vec<InterposeFileAccess>,
    pub exit_code: i32,
    pub stdout: Buffer,
    pub stderr: Buffer,
}

#[napi(object)]
pub struct InterposeSpawnOptions {
    pub cwd: Option<String>,
    /// Extra env merged on top of the parent's. The caller is responsible for
    /// providing the enhanced PATH; `DYLD_INSERT_LIBRARIES` / `FSPY_MACOS_FD`
    /// are injected here and override any caller-supplied values.
    pub env: Option<HashMap<String, String>>,
}

/// `trackWithInterpose(argv, dylibPath, options?, onStarted?)`.
///
/// `argv` MUST be a direct binary invocation (`["eslint", "."]`,
/// `["/abs/node", "x.mjs"]`) — NOT `["sh", "-c", "..."]`. The TypeScript
/// dispatch is responsible for only routing direct-exec commands here and
/// keeping shell-syntax commands on the preload fallback.
#[napi(
    catch_unwind,
    ts_args_type = "argv: Array<string>, dylibPath: string, options?: InterposeSpawnOptions | undefined | null, onStarted?: ((pid: number) => void) | undefined | null"
)]
pub async fn track_with_interpose(
    argv: Vec<String>,
    dylib_path: String,
    options: Option<InterposeSpawnOptions>,
    on_started: Option<ThreadsafeFunction<u32, (), u32, Status, false>>,
) -> Result<InterposeTrackingResult> {
    if argv.is_empty() {
        return Err(Error::new(Status::InvalidArg, "argv must not be empty"));
    }

    let cwd = options.as_ref().and_then(|o| o.cwd.clone()).map(PathBuf::from);
    let extra_env = options.and_then(|o| o.env).unwrap_or_default();

    let (pid_tx, pid_rx) = mpsc::sync_channel::<u32>(1);

    let work = tokio::task::spawn_blocking(move || run(argv, &dylib_path, cwd, extra_env, pid_tx));

    if let Some(tsfn) = on_started {
        tokio::task::spawn_blocking(move || {
            if let Ok(pid) = pid_rx.recv() {
                tsfn.call(pid, ThreadsafeFunctionCallMode::NonBlocking);
            }
        });
    }

    work.await
        .map_err(|e| Error::new(Status::GenericFailure, format!("interpose tracker panicked: {e}")))?
        .map_err(|e| Error::new(Status::GenericFailure, format!("interpose tracker failed: {e}")))
}

/// Blocking worker: socketpair → spawn injected → drain datagrams → collect.
fn run(
    argv: Vec<String>,
    dylib_path: &str,
    cwd: Option<PathBuf>,
    extra_env: HashMap<String, String>,
    pid_tx: mpsc::SyncSender<u32>,
) -> std::io::Result<InterposeTrackingResult> {
    // SAFETY: socketpair into a 2-element array; checked for error.
    let mut fds = [0 as RawFd; 2];
    let rc = unsafe { libc::socketpair(libc::AF_UNIX, libc::SOCK_DGRAM, 0, fds.as_mut_ptr()) };

    if rc != 0 {
        return Err(std::io::Error::last_os_error());
    }

    let parent_fd = fds[0];
    let child_fd = fds[1];

    // Parent end must not leak into the child; child end must survive exec.
    set_cloexec(parent_fd, true);
    set_cloexec(child_fd, false);

    // Grow the receive buffer so a burst of accesses from a fast child isn't
    // silently dropped before the reader thread drains it.
    let bufsize: libc::c_int = 4 * 1024 * 1024;
    unsafe {
        libc::setsockopt(
            parent_fd,
            libc::SOL_SOCKET,
            libc::SO_RCVBUF,
            std::ptr::addr_of!(bufsize).cast(),
            std::mem::size_of::<libc::c_int>() as libc::socklen_t,
        );
    }

    let mut command = Command::new(&argv[0]);
    command.args(&argv[1..]);
    command.env("DYLD_INSERT_LIBRARIES", dylib_path);
    command.env("FSPY_MACOS_FD", child_fd.to_string());
    command.envs(&extra_env);
    command.stdin(Stdio::null());
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());

    if let Some(dir) = &cwd {
        command.current_dir(dir);
    }

    // The fd is inherited by number; nothing else to do in pre_exec but it
    // documents intent and guarantees the fd isn't accidentally closed.
    let keep = child_fd;
    unsafe {
        command.pre_exec(move || {
            // Re-clear CLOEXEC defensively in the forked child.
            libc::fcntl(keep, libc::F_SETFD, 0);
            Ok(())
        });
    }

    let mut child = match command.spawn() {
        Ok(c) => c,
        Err(e) => {
            close(parent_fd);
            close(child_fd);
            return Err(e);
        }
    };

    // Parent no longer needs the child's write end; closing it means the only
    // remaining write end lives in the child, so `recv` hits EOF on exit.
    close(child_fd);

    let _ = pid_tx.send(child.id());

    let cwd_for_norm = cwd.unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from("/")));

    // Reader thread: drain datagrams until EOF.
    let reader = thread::spawn(move || drain(parent_fd, &cwd_for_norm));

    // Drain stdout/stderr concurrently to avoid deadlocking on full pipes.
    let mut stdout_pipe = child.stdout.take();
    let mut stderr_pipe = child.stderr.take();

    let out_handle = thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(p) = stdout_pipe.as_mut() {
            let _ = p.read_to_end(&mut buf);
        }
        buf
    });
    let err_handle = thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(p) = stderr_pipe.as_mut() {
            let _ = p.read_to_end(&mut buf);
        }
        buf
    });

    let status = child.wait()?;
    let stdout = out_handle.join().unwrap_or_default();
    let stderr = err_handle.join().unwrap_or_default();
    let accesses = reader.join().unwrap_or_default();

    Ok(InterposeTrackingResult {
        accesses,
        exit_code: status.code().unwrap_or(-1),
        stdout: Buffer::from(stdout),
        stderr: Buffer::from(stderr),
    })
}

/// Receive `[mode][path]` datagrams until EOF, de-duplicating (path, kind).
fn drain(parent_fd: RawFd, cwd: &Path) -> Vec<InterposeFileAccess> {
    // Take ownership so the fd is closed when the reader returns.
    let socket = unsafe { std::fs::File::from_raw_fd(parent_fd) };
    let raw = socket.as_raw_fd_compat();

    let mut seen = std::collections::HashSet::<(String, u8)>::new();
    let mut out = Vec::new();
    let mut buf = [0u8; 1 + 1024];

    loop {
        // SOCK_DGRAM: one recv == one whole datagram.
        let n = unsafe { libc::recv(raw, buf.as_mut_ptr().cast(), buf.len(), 0) };

        if n <= 0 {
            break; // 0 = EOF (all write ends closed); <0 = error.
        }

        let n = n as usize;

        if n < 1 {
            continue;
        }

        let mode = buf[0];
        let path_bytes = &buf[1..n];

        if path_bytes.is_empty() {
            continue;
        }

        let path = normalize(path_bytes, cwd);

        if seen.insert((path.clone(), mode)) {
            out.push(InterposeFileAccess { path, kind: kind_str(mode).to_string() });
        }
    }

    out
}

/// Join relative paths against the spawn cwd; pass absolutes through. Lossy
/// UTF-8 — non-UTF-8 paths are rare and the JS side compares as strings.
fn normalize(bytes: &[u8], cwd: &Path) -> String {
    use std::os::unix::ffi::OsStrExt;

    let os = std::ffi::OsStr::from_bytes(bytes);
    let p = Path::new(os);

    if p.is_absolute() {
        p.to_string_lossy().into_owned()
    } else {
        cwd.join(p).to_string_lossy().into_owned()
    }
}

fn kind_str(mode: u8) -> &'static str {
    match mode {
        1 => "write",
        2 => "stat",
        3 => "readdir",
        _ => "read",
    }
}

fn set_cloexec(fd: RawFd, on: bool) {
    unsafe {
        let flags = libc::fcntl(fd, libc::F_GETFD);
        if flags >= 0 {
            let next = if on { flags | libc::FD_CLOEXEC } else { flags & !libc::FD_CLOEXEC };
            libc::fcntl(fd, libc::F_SETFD, next);
        }
    }
}

fn close(fd: RawFd) {
    unsafe {
        libc::close(fd);
    }
}

/// Tiny shim so `drain` can grab the raw fd back out of the `File` guard
/// without an extra `use` at call sites.
trait AsRawFdCompat {
    fn as_raw_fd_compat(&self) -> RawFd;
}

impl AsRawFdCompat for std::fs::File {
    fn as_raw_fd_compat(&self) -> RawFd {
        use std::os::unix::io::AsRawFd;
        self.as_raw_fd()
    }
}
