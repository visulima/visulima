//! In-process supervisor that consumes events off the kernel's
//! seccomp notify fd and folds them into a `Vec<FileAccess>`.
//!
//! Runs as a thread inside whichever process called `track_command`
//! — Node holds the resulting handle via NAPI. There is no separate
//! supervisor binary; an out-of-process design adds IPC and
//! packaging cost we don't yet need (decided during the RFC scaffold
//! audit).
//!
//! Loop shape:
//! 1. `seccomp_notify_alloc` once → req/resp buffers.
//! 2. `seccomp_notify_receive(fd, req)` blocks until the kernel
//!    posts a notification (or the tracked child exits and the
//!    listener becomes drained, surfaced as ENOENT / ECANCELED).
//! 3. `syscalls::classify(notif, pid)` returns zero or more
//!    `FileAccess` entries.
//! 4. `seccomp_notify_respond` with `SECCOMP_USER_NOTIF_FLAG_CONTINUE`
//!    so the child runs the real syscall — we observe, never block.

use std::io;
use std::mem;
use std::os::unix::io::RawFd;

use libseccomp_sys::{
    SECCOMP_USER_NOTIF_FLAG_CONTINUE, seccomp_notif, seccomp_notif_resp, seccomp_notify_alloc,
    seccomp_notify_free, seccomp_notify_receive, seccomp_notify_respond,
};

use crate::FileAccess;
use crate::syscalls;

/// Drain the listener until the tracked process tree exits.
///
/// Returns the gathered accesses. Stops on:
/// - `ENOENT` / `ECANCELED` from `seccomp_notify_receive`. Both
///   surface "the listener drained" on different kernel versions —
///   ENOENT is the historical return, ECANCELED is what 5.x+ can
///   return when the last task exits mid-receive.
/// - `EINTR` is retried — interrupts here mean the supervisor's own
///   thread received a signal, not that tracking should bail.
pub fn run(notify_fd: RawFd) -> io::Result<Vec<FileAccess>> {
    let mut req: *mut seccomp_notif = std::ptr::null_mut();
    let mut resp: *mut seccomp_notif_resp = std::ptr::null_mut();

    let rc = unsafe { seccomp_notify_alloc(&mut req, &mut resp) };
    if rc != 0 {
        return Err(io::Error::from_raw_os_error(-rc));
    }

    struct Bufs {
        req: *mut seccomp_notif,
        resp: *mut seccomp_notif_resp,
    }
    impl Drop for Bufs {
        fn drop(&mut self) {
            unsafe { seccomp_notify_free(self.req, self.resp) };
        }
    }
    let _bufs = Bufs { req, resp };

    let mut accesses = Vec::new();

    loop {
        unsafe { std::ptr::write_bytes(req as *mut u8, 0, mem::size_of::<seccomp_notif>()) };

        let rc = unsafe { seccomp_notify_receive(notify_fd, req) };
        if rc != 0 {
            let err = io::Error::from_raw_os_error(-rc);
            match err.raw_os_error() {
                Some(libc::EINTR) => continue,
                Some(libc::ENOENT) | Some(libc::ECANCELED) => break,
                _ => return Err(err),
            }
        }

        let notif = unsafe { &*req };
        let pid = notif.pid as i32;
        let events = syscalls::classify(notif, pid);

        // Always respond — leaving a request un-acked stalls the
        // child forever. CONTINUE passes the syscall through to the
        // kernel so observable behaviour is unchanged.
        let response = unsafe { &mut *resp };
        response.id = notif.id;
        response.val = 0;
        response.error = 0;
        response.flags = SECCOMP_USER_NOTIF_FLAG_CONTINUE;

        let rc = unsafe { seccomp_notify_respond(notify_fd, resp) };
        if rc != 0 {
            let err = io::Error::from_raw_os_error(-rc);
            // ENOENT here means the tracked task disappeared
            // (received a fatal signal) between receive and
            // respond. Drop this batch — we never confirmed the
            // syscall ran — and keep listening.
            if err.raw_os_error() == Some(libc::ENOENT) {
                continue;
            }
            return Err(err);
        }

        accesses.extend(events);
    }

    Ok(accesses)
}
