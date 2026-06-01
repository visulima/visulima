//! Path normalization for Win32-API paths.
//!
//! Win32 file APIs hand us paths in several shapes: drive paths
//! (`C:\dir\file`), the extended-length prefix (`\\?\C:\dir\file`), the
//! device-namespace prefix (`\\.\…`), and UNC paths (`\\server\share`). The
//! supervisor normalizes them to a forward-slash form so the downstream
//! cache-keying code never sees a Windows-specific shape, mirroring what the
//! Linux/macOS trackers already emit.

use std::path::{Path, PathBuf};

/// Strip the extended-length (`\\?\`) and device (`\\.\`) prefixes and map
/// backslashes to forward slashes. UNC roots are preserved as `//server/share`.
///
/// - `\\?\C:\a\b`        → `C:/a/b`
/// - `\\?\UNC\srv\share` → `//srv/share`
/// - `\\.\C:\a`          → `C:/a`
/// - `C:\a\b`            → `C:/a/b`
/// - `\\srv\share\a`     → `//srv/share/a`
pub fn normalize(path: &Path) -> PathBuf {
    PathBuf::from(normalize_str(&path.to_string_lossy()))
}

fn normalize_str(raw: &str) -> String {
    // `\\?\UNC\server\share` is the extended form of a UNC path — drop the
    // `\\?\UNC\` and re-introduce the `\\` UNC root so it normalizes the same
    // as a plain `\\server\share`.
    if let Some(rest) = strip_prefix_ci(raw, r"\\?\UNC\") {
        return format!("//{}", rest.replace('\\', "/"));
    }

    // Extended-length and device prefixes are interchangeable for our
    // purposes; strip either.
    let stripped = raw.strip_prefix(r"\\?\").or_else(|| raw.strip_prefix(r"\\.\")).unwrap_or(raw);

    stripped.replace('\\', "/")
}

/// Case-insensitive `strip_prefix` — Windows path prefixes are
/// case-insensitive (`\\?\unc\` vs `\\?\UNC\`).
fn strip_prefix_ci<'a>(s: &'a str, prefix: &str) -> Option<&'a str> {
    if s.len() >= prefix.len() && s[..prefix.len()].eq_ignore_ascii_case(prefix) {
        Some(&s[prefix.len()..])
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::normalize_str;

    #[test]
    fn strips_extended_length_prefix() {
        assert_eq!(normalize_str(r"\\?\C:\a\b"), "C:/a/b");
    }

    #[test]
    fn strips_device_prefix() {
        assert_eq!(normalize_str(r"\\.\C:\a"), "C:/a");
    }

    #[test]
    fn rewrites_extended_unc() {
        assert_eq!(normalize_str(r"\\?\UNC\srv\share\f"), "//srv/share/f");
        assert_eq!(normalize_str(r"\\?\unc\srv\share"), "//srv/share");
    }

    #[test]
    fn preserves_plain_unc() {
        assert_eq!(normalize_str(r"\\srv\share\a"), "//srv/share/a");
    }

    #[test]
    fn plain_drive_path() {
        assert_eq!(normalize_str(r"C:\dir\file.txt"), "C:/dir/file.txt");
    }
}
