//! In-process supervisor that consumes events off the kernel's
//! seccomp notify fd and folds them into a `Vec<FileAccess>`.
//!
//! Runs as a thread inside whichever process called `track_command`
//! — Node holds the resulting handle via NAPI. There is no separate
//! supervisor binary; an out-of-process design adds IPC and
//! packaging cost we don't yet need.
//!
//! Loop shape:
//! 1. Allocate `seccomp_notif` / `seccomp_notif_resp` on the stack.
//! 2. `ioctl(fd, SECCOMP_IOCTL_NOTIF_RECV, &req)` blocks until the
//!    kernel posts a notification (or the tracked child exits and
//!    the listener becomes drained, surfaced as ENOENT / ECANCELED).
//! 3. `syscalls::classify(notif, pid)` returns zero or more
//!    `FileAccess` entries.
//! 4. `ioctl(fd, SECCOMP_IOCTL_NOTIF_SEND, &resp)` with
//!    `SECCOMP_USER_NOTIF_FLAG_CONTINUE` so the child runs the real
//!    syscall — we observe, never block.

use std::io;
use std::mem;
use std::os::raw::c_ulong;
use std::os::unix::io::RawFd;

use libc::{seccomp_notif, seccomp_notif_resp, SECCOMP_USER_NOTIF_FLAG_CONTINUE};

use crate::syscalls;
use crate::FileAccess;

// Linux ioctl numbers — computed once by hand from
// `<linux/seccomp.h>`'s `_IOWR('S', N, T)` macros. The layout is
// `(dir<<30) | (size<<16) | (type<<8) | nr`; for these the type is
// 'S' (0x53), `dir` is RW (3), and the size is the underlying
// struct's byte size. These are stable across all Linux arches.

/// `_IOWR('S', 0, struct seccomp_notif)` — 80-byte struct → size = 80.
const SECCOMP_IOCTL_NOTIF_RECV: c_ulong = 0xC050_2100;
/// `_IOWR('S', 1, struct seccomp_notif_resp)` — 24-byte struct.
const SECCOMP_IOCTL_NOTIF_SEND: c_ulong = 0xC018_2101;

/// Drain the listener until the tracked process tree exits.
///
/// Returns the gathered accesses. Stops on:
/// - `ENOENT` / `ECANCELED` from the receive ioctl. Both surface
///   "the listener drained" on different kernel versions — ENOENT
///   is the historical return, ECANCELED is what 5.x+ can return
///   when the last task exits mid-receive.
/// - `EINTR` is retried — interrupts here mean the supervisor's own
///   thread received a signal, not that tracking should bail.
pub fn run(notify_fd: RawFd) -> io::Result<Vec<FileAccess>> {
    // Stack-allocated request/response buffers. The kernel writes
    // the full struct each notification, so allocating per-iteration
    // would just churn the heap.
    let mut req: seccomp_notif = unsafe { mem::zeroed() };
    let mut resp: seccomp_notif_resp = unsafe { mem::zeroed() };

    let mut accesses = Vec::new();

    loop {
        // Zero between iterations so stale fields from the previous
        // notification can't leak through if the kernel writes a
        // shorter payload. The kernel always writes the fields we
        // read (id, pid, data) so `sizeof::<seccomp_notif>` suffices.
        unsafe {
            std::ptr::write_bytes(&mut req as *mut seccomp_notif as *mut u8, 0, mem::size_of::<seccomp_notif>());
        }

        let rc = unsafe { libc::ioctl(notify_fd, SECCOMP_IOCTL_NOTIF_RECV, &mut req as *mut seccomp_notif) };
        if rc != 0 {
            let err = io::Error::last_os_error();
            match err.raw_os_error() {
                Some(libc::EINTR) => continue,
                Some(libc::ENOENT) | Some(libc::ECANCELED) => break,
                _ => return Err(err),
            }
        }

        let pid = req.pid as i32;
        let events = syscalls::classify(&req, pid);

        // Always respond — leaving a request un-acked stalls the
        // child forever. CONTINUE passes the syscall through to the
        // kernel so observable behaviour is unchanged.
        resp.id = req.id;
        resp.val = 0;
        resp.error = 0;
        resp.flags = SECCOMP_USER_NOTIF_FLAG_CONTINUE as u32;

        let rc = unsafe { libc::ioctl(notify_fd, SECCOMP_IOCTL_NOTIF_SEND, &resp as *const seccomp_notif_resp) };
        if rc != 0 {
            let err = io::Error::last_os_error();
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
