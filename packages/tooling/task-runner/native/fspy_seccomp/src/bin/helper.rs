//! `fspy-seccomp-helper` — the per-spawn injector binary.
//!
//! The parent (Node-side NAPI binding) cannot install a seccomp
//! filter in its own pre_exec hook from a multi-threaded runtime
//! safely. Instead, the parent posix_spawns this helper with:
//!
//! - env `FSPY_SOCK`: path to a parent-owned Unix socket listener
//! - argv: `[helper_path, target_cmd, target_args...]`
//!
//! The helper runs in a *fresh single-threaded process* (posix_spawn
//! uses vfork+exec internally — no fork-in-multithreaded hazard):
//!
//! 1. `prctl(PR_SET_NO_NEW_PRIVS)` — required for non-root tasks.
//! 2. `filter::install(syscalls::tracked())` — builds the filter via
//!    libseccomp and returns the listener fd.
//! 3. Connect to the parent's Unix socket at `FSPY_SOCK`.
//! 4. Send the listener fd to the parent via `SCM_RIGHTS` (handled
//!    by nix's `sendmsg` + `ControlMessage::ScmRights`).
//! 5. `execve(target_cmd, target_args)`.
//!
//! From this point the kernel routes every tracked syscall in the
//! target child (and descendants — seccomp filters inherit across
//! fork/clone) to the parent's notify fd.

#![cfg(target_os = "linux")]

use std::env;
use std::ffi::CString;
use std::io::{self, IoSlice};
use std::os::unix::io::{AsRawFd, OwnedFd, RawFd};
use std::path::Path;
use std::process::ExitCode;

use nix::sys::socket::{
    connect, sendmsg, socket, AddressFamily, ControlMessage, MsgFlags, SockFlag, SockType, UnixAddr,
};

use fspy_seccomp::{filter, syscalls};

const ENV_SOCK: &str = "FSPY_SOCK";

fn main() -> ExitCode {
    // Exit codes follow the sh(1) convention for "couldn't execute"
    // errors so the parent can distinguish helper failures from the
    // target program's own non-zero exits.
    match run() {
        Ok(()) => unreachable!("execve replaces the process image; on success this never returns"),
        Err(code) => code,
    }
}

fn run() -> Result<(), ExitCode> {
    // Argv layout: [helper_self, target_cmd, target_arg0, target_arg1, ...]
    let mut argv: Vec<String> = env::args().collect();
    if argv.len() < 2 {
        eprintln!("fspy-seccomp-helper: usage: helper <target_cmd> [args...]");
        return Err(ExitCode::from(64)); // EX_USAGE
    }
    // Drop our own argv[0]; what remains is target argv.
    argv.remove(0);

    let sock_path = match env::var_os(ENV_SOCK) {
        Some(p) => p,
        None => {
            eprintln!("fspy-seccomp-helper: missing {ENV_SOCK} env var");
            return Err(ExitCode::from(64));
        }
    };

    // PR_SET_NO_NEW_PRIVS is required for non-root seccomp_load.
    let rc = unsafe { libc::prctl(libc::PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) };
    if rc != 0 {
        eprintln!("fspy-seccomp-helper: prctl(PR_SET_NO_NEW_PRIVS) failed: {}", io::Error::last_os_error(),);
        return Err(ExitCode::from(126));
    }

    // SAFETY: We are the only thread in this process (posix_spawn
    // gave us a fresh image). libseccomp's allocations / global
    // state are safe to use here.
    let notify_fd = match unsafe { filter::install(syscalls::tracked()) } {
        Ok(fd) => fd,
        Err(e) => {
            eprintln!("fspy-seccomp-helper: filter install failed: {e}");
            return Err(ExitCode::from(126));
        }
    };

    if let Err(e) = send_notify_fd(Path::new(&sock_path), notify_fd) {
        eprintln!("fspy-seccomp-helper: send notify fd failed: {e}");
        return Err(ExitCode::from(126));
    }

    // Our copy of the listener fd is no longer needed; the parent
    // received a SCM_RIGHTS dup of it. Closing here keeps the child
    // fd table minimal across exec.
    unsafe { libc::close(notify_fd) };

    // execve replaces the process image. From this point seccomp
    // notifications fire whenever the target runs a tracked syscall.
    let target = CString::new(argv[0].as_bytes()).map_err(|_| ExitCode::from(64))?;
    let arg_cstrs: Vec<CString> =
        argv.iter().map(|s| CString::new(s.as_bytes()).map_err(|_| ExitCode::from(64))).collect::<Result<_, _>>()?;
    let mut arg_ptrs: Vec<*const libc::c_char> = arg_cstrs.iter().map(|c| c.as_ptr()).collect();
    arg_ptrs.push(std::ptr::null());

    unsafe {
        libc::execvp(target.as_ptr(), arg_ptrs.as_ptr());
    }

    // execvp only returns on failure (no such file, permission denied, etc).
    eprintln!("fspy-seccomp-helper: execvp({}) failed: {}", argv[0], io::Error::last_os_error(),);
    Err(ExitCode::from(127)) // command not found / not executable
}

/// Connect to the parent's listener at `sock_path` and hand it the
/// notify fd via `SCM_RIGHTS`. Goes through nix's typed `sendmsg` +
/// `ControlMessage::ScmRights` so the cmsg framing + alignment are
/// the library's problem, not ours.
fn send_notify_fd(sock_path: &Path, payload_fd: RawFd) -> io::Result<()> {
    let sock: OwnedFd = socket(AddressFamily::Unix, SockType::Stream, SockFlag::empty(), None).map_err(to_io)?;

    // UnixAddr::new performs the sun_path bounds check (108 bytes).
    let addr = UnixAddr::new(sock_path).map_err(to_io)?;
    connect(sock.as_raw_fd(), &addr).map_err(to_io)?;

    // Linux requires at least 1 iovec byte for SCM_RIGHTS to be
    // attached — send a single zero byte alongside the fd.
    let payload = [0u8];
    let iov = [IoSlice::new(&payload)];
    let fds = [payload_fd];
    let cmsgs = [ControlMessage::ScmRights(&fds)];

    sendmsg::<()>(sock.as_raw_fd(), &iov, &cmsgs, MsgFlags::empty(), None).map_err(to_io)?;

    Ok(())
}

fn to_io(e: nix::errno::Errno) -> io::Error {
    io::Error::from_raw_os_error(e as i32)
}
