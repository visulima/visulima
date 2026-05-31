//! `fspy_seccomp` — Linux file-access tracker via `seccomp_unotify`.
//!
//! **Status: WIP scaffold.** This crate corresponds to plan step 1 in
//! `rfc/design-fspy-seccomp-unotify.md`. It compiles, lays out the
//! module boundaries called for in the RFC, and stubs the public
//! entrypoint — nothing else is wired yet.
//!
//! See the RFC for the full design (syscall table, fork-tracking,
//! path resolution strategy, integration with `file-access-tracker.ts`).

#![cfg(target_os = "linux")]
#![deny(unused_must_use)]

pub mod filter;
pub mod peer;
pub mod supervisor;
pub mod syscalls;

/// One observed file access. Mirrors the TypeScript-side
/// `FileAccess` interface in `src/file-access-tracker.ts`; the
/// supervisor serialises a stream of these back to the parent.
#[derive(Debug, Clone)]
pub struct FileAccess {
    pub path: std::path::PathBuf,
    pub kind: AccessKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AccessKind {
    Read,
    ReadDir,
    Stat,
    Write,
    Missing,
}

/// Result of tracking a single command invocation.
#[derive(Debug, Default)]
pub struct TrackingResult {
    pub accesses: Vec<FileAccess>,
    pub exit_code: i32,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
}

/// Spawn `cmd` with seccomp tracking attached. Returns the gathered
/// accesses once the child exits.
///
/// **Not implemented.** This is the public surface the TypeScript-side
/// `trackWithSeccomp(...)` will call into via NAPI. Today it returns
/// `Err(...)` so any caller wires up the diagnostic path; the strace /
/// preload fallback in `file-access-tracker.ts` keeps the runner
/// working until this lands.
pub fn track_command(_cmd: &[String]) -> std::io::Result<TrackingResult> {
    Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "fspy_seccomp::track_command is not yet implemented — see rfc/design-fspy-seccomp-unotify.md",
    ))
}
