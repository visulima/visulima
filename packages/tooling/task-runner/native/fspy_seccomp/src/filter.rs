//! Pure-Rust seccomp filter installer. Hand-rolls a BPF program
//! that returns `SECCOMP_RET_USER_NOTIF` for the syscalls we want
//! to observe and `SECCOMP_RET_ALLOW` for everything else, then
//! loads it via raw `seccomp(2)` with `SECCOMP_FILTER_FLAG_NEW_LISTENER`.
//!
//! Why no `libseccomp-sys`: that crate dynamically links the
//! system libseccomp, which doesn't cross-compile into musl /
//! aarch64 sysroots without bespoke CI setup. Rolling our own BPF
//! takes ~80 lines and works on every Linux target with no C
//! dependency.
//!
//! BPF program shape:
//!
//! ```text
//! ld [arch]                  // seccomp_data.arch (32 bits)
//! jeq <native_arch>, 1, 0    // if matches: skip kill; else: kill
//! ret KILL_PROCESS
//! ld [nr]                    // seccomp_data.nr (32 bits)
//! for each tracked syscall:
//!     jeq <nr>, <to_notify>, 0
//! ret ALLOW
//! to_notify:
//! ret USER_NOTIF
//! ```

use std::io;
use std::os::raw::c_long;
use std::os::unix::io::RawFd;

use libc::{
    c_uint, seccomp_data, sock_filter, sock_fprog, syscall, SYS_seccomp, BPF_ABS, BPF_JEQ, BPF_JMP, BPF_JUMP, BPF_K,
    BPF_LD, BPF_RET, BPF_STMT, BPF_W, SECCOMP_FILTER_FLAG_NEW_LISTENER, SECCOMP_RET_ALLOW, SECCOMP_RET_USER_NOTIF,
    SECCOMP_SET_MODE_FILTER,
};

use crate::syscalls::TrackedSyscall;

/// `SECCOMP_RET_KILL_THREAD` (value 0) is used on the arch-
/// mismatch branch — running with the wrong syscall numbers would
/// let calls through silently, so terminating the offending thread
/// is the safe fallback. Use KILL_THREAD rather than KILL_PROCESS
/// for broader kernel-config compatibility.
const SECCOMP_RET_KILL_THREAD: c_uint = 0x0000_0000;

/// `AUDIT_ARCH_*` aren't in libc. Hard-coded per arch from
/// `<linux/audit.h>`. Add more entries when porting to a new arch.
#[cfg(target_arch = "x86_64")]
const NATIVE_AUDIT_ARCH: c_uint = 0xc000_003e;

#[cfg(target_arch = "aarch64")]
const NATIVE_AUDIT_ARCH: c_uint = 0xc000_00b7;

#[cfg(target_arch = "riscv64")]
const NATIVE_AUDIT_ARCH: c_uint = 0xc000_00f3;

/// Build and install a seccomp filter that traps the given
/// syscalls for user-notify and allows everything else. Returns
/// the kernel-issued listener fd that the parent supervisor will
/// read notifications from.
///
/// MUST be called from the post-fork pre-exec window (or otherwise
/// the future child) — the kernel installs the filter on the
/// *calling* thread, and the notify fd lives in *its* fd table.
///
/// # Safety
///
/// Wraps raw `seccomp(2)`. Caller must ensure
/// `prctl(PR_SET_NO_NEW_PRIVS, 1, ...)` succeeded earlier in the
/// same thread, or `seccomp(2)` returns `EACCES` for a non-root
/// process.
pub unsafe fn install(tracked: &[TrackedSyscall]) -> io::Result<RawFd> {
    let prog = build_bpf(tracked);
    let fprog = sock_fprog {
        len: u16::try_from(prog.len())
            .map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "BPF program exceeds 65535 instructions"))?,
        filter: prog.as_ptr() as *mut sock_filter,
    };

    // `seccomp(2)` with `SECCOMP_FILTER_FLAG_NEW_LISTENER` returns
    // the listener fd on success. Cast via `c_long`/`as i32` so
    // we preserve negative fds for error mapping.
    let rc = unsafe {
        syscall(
            SYS_seccomp,
            SECCOMP_SET_MODE_FILTER as c_long,
            SECCOMP_FILTER_FLAG_NEW_LISTENER as c_long,
            &fprog as *const _,
        )
    };

    if rc < 0 {
        return Err(io::Error::last_os_error());
    }
    Ok(rc as RawFd)
}

/// Construct the BPF program. ~5 fixed instructions for the arch
/// guard + 1 per tracked syscall + 2 final returns (allow, notify).
fn build_bpf(tracked: &[TrackedSyscall]) -> Vec<sock_filter> {
    // Field offsets in `struct seccomp_data` — stable kernel ABI:
    //   nr        : offset 0  (i32)
    //   arch      : offset 4  (u32)
    //   ip        : offset 8  (u64)
    //   args[6]   : offset 16 (u64 each)
    let arch_offset = std::mem::offset_of!(seccomp_data, arch) as u32;
    let nr_offset = std::mem::offset_of!(seccomp_data, nr) as u32;

    // Pre-filter out syscalls that don't exist on this arch — they
    // contribute no BPF instruction. Doing this once lets the jump
    // offsets stay simple (count of remaining checks).
    let resolved: Vec<i32> = tracked.iter().filter_map(|s| s.nr()).collect();

    let mut prog = Vec::with_capacity(5 + resolved.len() + 1);

    // 1. Load seccomp_data.arch
    prog.push(unsafe { BPF_STMT((BPF_LD | BPF_W | BPF_ABS) as u16, arch_offset) });
    // 2. If arch matches native, skip the kill; else fall through.
    prog.push(unsafe { BPF_JUMP((BPF_JMP | BPF_JEQ | BPF_K) as u16, NATIVE_AUDIT_ARCH, 1, 0) });
    // 3. Kill on arch mismatch — running with wrong syscall
    //    numbers would let calls through silently. Safer to terminate.
    prog.push(unsafe { BPF_STMT((BPF_RET | BPF_K) as u16, SECCOMP_RET_KILL_THREAD) });
    // 4. Load seccomp_data.nr
    prog.push(unsafe { BPF_STMT((BPF_LD | BPF_W | BPF_ABS) as u16, nr_offset) });

    // 5. For each tracked syscall, jeq to the NOTIFY return at the
    //    end. Distance from this jeq to NOTIFY = (remaining checks
    //    after this one) + 1 (skip the ALLOW return).
    let n = resolved.len();
    for (i, nr) in resolved.iter().enumerate() {
        let jt = u8::try_from(n - 1 - i + 1).unwrap_or(0xff);
        prog.push(unsafe { BPF_JUMP((BPF_JMP | BPF_JEQ | BPF_K) as u16, *nr as u32, jt, 0) });
    }

    // 6. Default action: allow.
    prog.push(unsafe { BPF_STMT((BPF_RET | BPF_K) as u16, SECCOMP_RET_ALLOW) });
    // 7. Notify target (jumped to from any matched jeq above).
    prog.push(unsafe { BPF_STMT((BPF_RET | BPF_K) as u16, SECCOMP_RET_USER_NOTIF) });

    prog
}
