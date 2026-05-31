//! `fspy_windows` — Windows file-access tracker via Microsoft Detours.
//!
//! **Status: WIP scaffold.** Plan step 1 from
//! `rfc/design-fspy-windows-detours.md`: lay out the module boundaries
//! and stub the public entrypoint. Nothing here actually hooks
//! anything yet — the DLL exports a `DllMain` and the supervisor lives
//! in `pipe.rs` only as placeholder code.
//!
//! See the RFC for the full design (IAT hook surface, named-pipe IPC,
//! ARM64 considerations, EDR caveats).

#![cfg(windows)]
#![deny(unused_must_use)]

pub mod hooks;
pub mod path;
pub mod pipe;

/// Mirrors the TS-side `FileAccess` interface in
/// `src/file-access-tracker.ts`. The supervisor in the parent process
/// receives a stream of these over the per-spawn named pipe.
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

/// Spawn `cmd` with the Detours-injected DLL attached. Returns the
/// gathered accesses once the child exits.
///
/// **Not implemented.** The TS surface (`trackWithDetours(...)`) will
/// call into this via NAPI; today it errors so the strace / preload
/// fallback in `file-access-tracker.ts` keeps the runner working.
pub fn track_command(_cmd: &[String]) -> std::io::Result<Vec<FileAccess>> {
    Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "fspy_windows::track_command is not yet implemented — see rfc/design-fspy-windows-detours.md",
    ))
}

/// `DllMain` — entrypoint Windows calls when the DLL is attached to a
/// process. On `DLL_PROCESS_ATTACH` we install our hooks and connect
/// to the parent's named pipe. On `DLL_PROCESS_DETACH` we flush.
///
/// **Not implemented.** Returns `1` (TRUE) so the loader accepts the
/// DLL without crashing the child.
#[no_mangle]
pub extern "system" fn DllMain(
    _hinst: *mut core::ffi::c_void,
    _reason: u32,
    _reserved: *mut core::ffi::c_void,
) -> i32 {
    1
}
