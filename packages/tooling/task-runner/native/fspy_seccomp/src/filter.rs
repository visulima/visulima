//! BPF filter builder. Generates a seccomp program that returns
//! `SECCOMP_RET_USER_NOTIF` for the syscalls we want to observe and
//! `SECCOMP_RET_ALLOW` for everything else.
//!
//! **Not implemented.** Plan: emit cBPF instructions per the table in
//! `rfc/design-fspy-seccomp-unotify.md`, install with
//! `SECCOMP_FILTER_FLAG_NEW_LISTENER` so the parent receives the notify
//! fd back via the seccomp(2) return value.

use crate::syscalls::TrackedSyscall;

/// A compiled seccomp BPF program ready to hand to `seccomp(2)`.
#[derive(Debug, Default)]
pub struct Program {
    /// Raw cBPF instruction bytes (placeholder — final shape is
    /// `[sock_filter]`).
    pub bytes: Vec<u8>,
}

/// Build a program that traps on every syscall in `tracked` and
/// allows everything else.
pub fn build(_tracked: &[TrackedSyscall]) -> Program {
    // TODO: emit BPF program. See `rfc/design-fspy-seccomp-unotify.md`
    // "Intercepted syscalls" + "BPF filter" sections.
    Program::default()
}
