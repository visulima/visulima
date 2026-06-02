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
use std::os::unix::io::RawFd;

use libc::{Ioctl, SECCOMP_USER_NOTIF_FLAG_CONTINUE, seccomp_notif, seccomp_notif_resp};

use crate::FileAccess;
use crate::syscalls;

// Linux ioctl numbers — computed from `<linux/seccomp.h>`'s
// `_IOWR(SECCOMP_IOC_MAGIC, N, T)` macros where
// `SECCOMP_IOC_MAGIC = '!'` (0x21, easy to misread as 'S'). Layout
// is `(dir<<30) | (size<<16) | (type<<8) | nr`; `dir` is RW (3),
// `size` is the struct's byte size. Stable across all Linux arches.
//
// `libc::Ioctl` is `c_ulong` on glibc (u64) and `c_int` on musl
// (i32). Computing as `u32` then `as`-casting to Ioctl preserves
// the bit pattern on both — the kernel reads the raw bytes.

const fn ioc(dir: u32, ty: u32, nr: u32, size: u32) -> Ioctl {
    (((dir) << 30) | ((size) << 16) | ((ty) << 8) | (nr)) as Ioctl
}

/// `_IOWR('!', 0, struct seccomp_notif)` — 80-byte struct.
const SECCOMP_IOCTL_NOTIF_RECV: Ioctl = ioc(3, 0x21, 0, 80);
/// `_IOWR('!', 1, struct seccomp_notif_resp)` — 24-byte struct.
const SECCOMP_IOCTL_NOTIF_SEND: Ioctl = ioc(3, 0x21, 1, 24);

/// Drain the listener until the tracked process tree exits — or until
/// `cancel_fd` becomes readable, whichever comes first.
///
/// Returns the gathered accesses. Stops on:
/// - `ENOENT` / `ECANCELED` from the receive ioctl. Both surface
///   "the listener drained" on different kernel versions — ENOENT
///   is the historical return, ECANCELED is what 5.x+ can return
///   when the last task exits mid-receive.
/// - `EINTR` is retried — interrupts here mean the supervisor's own
///   thread received a signal, not that tracking should bail.
/// - `cancel_fd` readable. The caller writes to it once the *main*
///   target has exited and a grace window has lapsed, so a lingering
///   descendant (e.g. an orphaned browser process from a
///   vitest-browser-mode test) can't keep the notify fd alive and
///   block the run forever. See voidzero-dev/vite-task#396. We
///   `poll(2)` both fds rather than blocking in the recv ioctl so
///   this wake-up is possible at all.
pub fn run(notify_fd: RawFd, cancel_fd: RawFd) -> io::Result<Vec<FileAccess>> {
    // Stack-allocated request/response buffers. The kernel writes
    // the full struct each notification, so allocating per-iteration
    // would just churn the heap.
    let mut req: seccomp_notif = unsafe { mem::zeroed() };
    let mut resp: seccomp_notif_resp = unsafe { mem::zeroed() };

    let mut accesses = Vec::new();

    loop {
        // Block until a notification is pending OR the caller asks us to
        // stop. Without this poll we'd sit in a blocking recv ioctl that
        // only returns when the *entire* tracked tree exits.
        let mut fds = [
            libc::pollfd { fd: notify_fd, events: libc::POLLIN, revents: 0 },
            libc::pollfd { fd: cancel_fd, events: libc::POLLIN, revents: 0 },
        ];

        let prc = unsafe { libc::poll(fds.as_mut_ptr(), 2, -1) };

        if prc < 0 {
            let err = io::Error::last_os_error();

            if err.raw_os_error() == Some(libc::EINTR) {
                continue;
            }

            return Err(err);
        }

        // Cancellation requested — return what we've gathered so far.
        if fds[1].revents != 0 {
            break;
        }

        // Spurious wake with nothing on the notify fd — loop again.
        if fds[0].revents == 0 {
            continue;
        }

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
