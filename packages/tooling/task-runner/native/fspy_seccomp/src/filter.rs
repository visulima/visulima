//! Seccomp filter installer. Uses the libseccomp high-level API so
//! we don't hand-roll BPF — `seccomp_rule_add(..., SCMP_ACT_NOTIFY,
//! syscall_nr, ...)` for each tracked syscall, then `seccomp_load`
//! commits the filter to the current thread's kernel state.
//!
//! When any rule uses `SCMP_ACT_NOTIFY`, libseccomp auto-installs
//! the filter with `SECCOMP_FILTER_FLAG_NEW_LISTENER` and the kernel
//! returns a notify fd. We retrieve it via `seccomp_notify_fd` after
//! load and hand it to the parent via SCM_RIGHTS.

use std::ffi::CString;
use std::io;
use std::os::raw::c_int;
use std::os::unix::io::RawFd;

use libseccomp_sys::{
    SECCOMP_RET_ALLOW, SECCOMP_RET_USER_NOTIF, seccomp_init, seccomp_load, seccomp_notify_fd,
    seccomp_release, seccomp_rule_add, seccomp_syscall_resolve_name,
};

use crate::syscalls::TrackedSyscall;

/// libseccomp's `SCMP_ACT_*` constants are C macros mapping to the
/// matching `SECCOMP_RET_*` kernel constants. The high-level wrapper
/// treats them as plain `u32` actions on `seccomp_rule_add`.
const SCMP_ACT_ALLOW: u32 = SECCOMP_RET_ALLOW;
const SCMP_ACT_NOTIFY: u32 = SECCOMP_RET_USER_NOTIF;

/// Build and install a seccomp filter that traps the given syscalls
/// for user-notify and allows everything else. Returns the kernel-
/// issued listener fd that the parent process will epoll on.
///
/// MUST be called from the post-fork pre-exec window (or otherwise
/// the future child) — the kernel installs the filter on the
/// *calling* thread, and the notify fd lives in *its* fd table.
///
/// # Safety
///
/// Wraps several `unsafe` libseccomp FFI calls. Caller must ensure
/// `prctl(PR_SET_NO_NEW_PRIVS, 1, ...)` succeeded earlier in the
/// same thread, or `seccomp_load` will fail with `EACCES` for a
/// non-root process.
pub unsafe fn install(tracked: &[TrackedSyscall]) -> io::Result<RawFd> {
    let ctx = unsafe { seccomp_init(SCMP_ACT_ALLOW) };
    if ctx.is_null() {
        return Err(io::Error::new(io::ErrorKind::Other, "seccomp_init returned null"));
    }

    // Guard against early-return leaks: release the libseccomp ctx
    // on every exit path. The kernel filter (and its notify fd) live
    // independently once `seccomp_load` succeeds, so it's fine to
    // release the library handle after we capture the fd.
    let result = (|| -> io::Result<RawFd> {
        for entry in tracked {
            let Ok(name) = CString::new(entry.name) else {
                // Names baked into static tables; a NUL byte means
                // a code-level mistake, not a runtime problem worth
                // surfacing — skip and keep installing the rest.
                continue;
            };

            let nr = unsafe { seccomp_syscall_resolve_name(name.as_ptr()) };
            if nr < 0 {
                // libseccomp's "this name doesn't exist on the
                // current arch" return. Common for legacy calls
                // (`stat`, `unlink`, `rename`) on aarch64-only
                // userspaces, or `openat2` on older toolchains.
                // Skip — the rest of the table is still useful.
                continue;
            }

            let rc = unsafe { seccomp_rule_add(ctx, SCMP_ACT_NOTIFY, nr as c_int, 0) };
            if rc != 0 {
                // EINVAL here can mean "syscall exists but isn't
                // filterable on this arch" (rare). Same calculus:
                // skip the entry so a partial-table install still
                // gives us something instead of nothing.
                continue;
            }
        }

        let rc = unsafe { seccomp_load(ctx) };
        if rc != 0 {
            return Err(io::Error::from_raw_os_error(-rc));
        }

        let fd = unsafe { seccomp_notify_fd(ctx) };
        if fd < 0 {
            return Err(io::Error::from_raw_os_error(-fd));
        }

        Ok(fd)
    })();

    unsafe { seccomp_release(ctx) };
    result
}
