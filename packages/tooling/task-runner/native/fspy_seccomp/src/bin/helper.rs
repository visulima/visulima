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
//! 4. Send the listener fd to the parent via `SCM_RIGHTS`.
//! 5. `execve(target_cmd, target_args)`.
//!
//! From this point the kernel routes every tracked syscall in the
//! target child (and descendants — seccomp filters inherit across
//! fork/clone) to the parent's notify fd.

#![cfg(target_os = "linux")]

use std::env;
use std::ffi::CString;
use std::io;
use std::os::unix::ffi::OsStrExt;
use std::os::unix::io::RawFd;
use std::path::Path;
use std::process::ExitCode;

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
        eprintln!(
            "fspy-seccomp-helper: prctl(PR_SET_NO_NEW_PRIVS) failed: {}",
            io::Error::last_os_error(),
        );
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
    let target = CString::new(argv[0].as_bytes())
        .map_err(|_| ExitCode::from(64))?;
    let arg_cstrs: Vec<CString> = argv
        .iter()
        .map(|s| CString::new(s.as_bytes()).map_err(|_| ExitCode::from(64)))
        .collect::<Result<_, _>>()?;
    let mut arg_ptrs: Vec<*const libc::c_char> = arg_cstrs.iter().map(|c| c.as_ptr()).collect();
    arg_ptrs.push(std::ptr::null());

    unsafe {
        libc::execvp(target.as_ptr(), arg_ptrs.as_ptr());
    }

    // execvp only returns on failure (no such file, permission denied, etc).
    eprintln!(
        "fspy-seccomp-helper: execvp({}) failed: {}",
        argv[0],
        io::Error::last_os_error(),
    );
    Err(ExitCode::from(127)) // command not found / not executable
}

/// Connect to the parent's listener at `sock_path` and hand it the
/// notify fd via SCM_RIGHTS. Writes a single zero byte alongside —
/// Linux requires at least 1 iovec byte for SCM_RIGHTS.
fn send_notify_fd(sock_path: &Path, payload_fd: RawFd) -> io::Result<()> {
    use libc::{c_void, iovec};

    // Open a Unix stream socket and connect to sock_path.
    let sock = unsafe { libc::socket(libc::AF_UNIX, libc::SOCK_STREAM, 0) };
    if sock < 0 {
        return Err(io::Error::last_os_error());
    }

    let path_bytes = sock_path.as_os_str().as_bytes();
    if path_bytes.len() >= 108 {
        // sun_path is fixed at 108 bytes on Linux. Truncating would
        // silently route us to the wrong listener.
        unsafe { libc::close(sock) };
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "FSPY_SOCK path too long for sockaddr_un",
        ));
    }

    let mut addr: libc::sockaddr_un = unsafe { std::mem::zeroed() };
    addr.sun_family = libc::AF_UNIX as libc::sa_family_t;
    for (i, &b) in path_bytes.iter().enumerate() {
        addr.sun_path[i] = b as libc::c_char;
    }
    // Length: family field + path + trailing NUL. Compute up to but
    // not past the actual path length.
    let addr_len = std::mem::size_of::<libc::sa_family_t>() + path_bytes.len() + 1;

    let rc = unsafe {
        libc::connect(sock, &addr as *const _ as *const libc::sockaddr, addr_len as u32)
    };
    if rc != 0 {
        let err = io::Error::last_os_error();
        unsafe { libc::close(sock) };
        return Err(err);
    }

    let mut data: u8 = 0;
    let mut iov = iovec {
        iov_base: &mut data as *mut u8 as *mut c_void,
        iov_len: 1,
    };

    let mut cmsg_buf = [0u8; 32];
    let mut msg: libc::msghdr = unsafe { std::mem::zeroed() };
    msg.msg_iov = &mut iov;
    msg.msg_iovlen = 1;
    msg.msg_control = cmsg_buf.as_mut_ptr() as *mut c_void;
    msg.msg_controllen = unsafe { libc::CMSG_SPACE(std::mem::size_of::<RawFd>() as u32) as _ };

    unsafe {
        let cmsg = libc::CMSG_FIRSTHDR(&msg);
        (*cmsg).cmsg_level = libc::SOL_SOCKET;
        (*cmsg).cmsg_type = libc::SCM_RIGHTS;
        (*cmsg).cmsg_len = libc::CMSG_LEN(std::mem::size_of::<RawFd>() as u32) as _;
        std::ptr::write(libc::CMSG_DATA(cmsg) as *mut RawFd, payload_fd);
    }

    let rc = unsafe { libc::sendmsg(sock, &msg, 0) };
    let send_err = if rc < 0 { Some(io::Error::last_os_error()) } else { None };

    unsafe { libc::close(sock) };

    match send_err {
        Some(e) => Err(e),
        None => Ok(()),
    }
}
