//! Path normalization for Win32-API paths.
//!
//! - Strip `\\?\` and `\\.\` long-path prefixes (per RFC, the supervisor
//!   handles this, not the DLL — keeps the hot path minimal).
//! - Map backslashes to forward slashes on the supervisor side so the
//!   downstream cache-keying code never sees a Windows-specific path.

use std::path::{Path, PathBuf};

/// Normalize a Win32 path into a forward-slash form suitable for
/// fingerprinting. Strips `\\?\` and `\\.\` prefixes; leaves UNC
/// paths intact.
///
/// **Not implemented.** Today it's a passthrough so consumers can
/// at least flow data; replace once we have real DLL events to
/// normalize.
pub fn normalize(path: &Path) -> PathBuf {
    path.to_path_buf()
}
