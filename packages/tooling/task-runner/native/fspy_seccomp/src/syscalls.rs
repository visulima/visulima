//! Per-architecture syscall numbers + flag→access-kind decoding.
//!
//! Per the RFC syscall table, every `TrackedSyscall` maps to one
//! `AccessKind` (or `Read`/`Write` selected by flags at notify time).
//! Numbers must be regenerated per `target_arch` — `x86_64` and
//! `aarch64` have different `openat` numbers (257 vs 56).

use crate::AccessKind;

/// One row of the seccomp filter table — which syscall, default
/// classification (overridable per-event for flag-decoded calls).
#[derive(Debug, Clone, Copy)]
pub struct TrackedSyscall {
    pub nr: i32,
    pub kind: AccessKind,
    /// When `true`, the supervisor inspects the syscall args to
    /// upgrade `Read` to `Write` (e.g. `openat` with `O_WRONLY`).
    pub flag_decoded: bool,
}

/// The full set we intercept. Populated for the current build target.
pub fn tracked() -> &'static [TrackedSyscall] {
    // TODO: emit per-arch tables. Today an empty list keeps the
    // crate compiling and forces any consumer through the
    // `track_command` "not implemented" error path.
    &[]
}
