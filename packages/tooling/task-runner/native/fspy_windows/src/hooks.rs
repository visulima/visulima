//! IAT hook installers — one per Windows API in the RFC's hook
//! surface table.
//!
//! **Not implemented.** Plan: use Detours' `DetourTransactionBegin` /
//! `DetourAttach` / `DetourTransactionCommit` to patch the IAT
//! entries below. Each hook records a `FileAccess` and tail-calls the
//! original.
//!
//! Hook surface (from `rfc/design-fspy-windows-detours.md`):
//! - `CreateFileW`, `CreateFileA` — main funnel for `read`/`write`
//! - `GetFileAttributesExW` — `stat` (existence checks)
//! - `FindFirstFileExW` — `readdir`
//! - `MoveFileExW` — `write` (both source + target paths)
//! - `DeleteFileW` — `write`
//! - `NtCreateFile`, `NtOpenFile` — bypass-the-Win32-API tools
//!   (cargo, MSVC linker); the ones that matter for "static binary"
//!   cases.

/// Install every hook in the table. Called from `DllMain` on
/// `DLL_PROCESS_ATTACH` before the host program runs any code.
///
/// Returns `Result<()>` rather than `()` because every real
/// implementation will be fallible — `DetourTransactionBegin` /
/// `DetourAttach` / `DetourTransactionCommit` each surface errors,
/// and pinning the call-site contract now means the eventual wiring
/// only edits the body, not every caller.
pub fn install_all() -> std::io::Result<()> {
    // TODO: Detours transactions per hook.
    Ok(())
}

/// Uninstall every hook. Called from `DllMain` on
/// `DLL_PROCESS_DETACH` so we don't leak IAT patches into other
/// children that spawn from this process. Same `Result<()>` rationale
/// as `install_all`.
pub fn uninstall_all() -> std::io::Result<()> {
    // TODO.
    Ok(())
}
