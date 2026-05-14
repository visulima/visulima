//! Semver major-bucket encoding.
//!
//! Mirrors the encoding the upstream `endevco/osv-bloom` builder emits:
//!
//! | version    | bucket |
//! |------------|--------|
//! | `1.2.3`    | `"1"`  |
//! | `3.7.0`    | `"3"`  |
//! | `0.3.7`    | `"0.3"` |
//! | `0.0.1`    | `"0.0"` |
//! | unparseable| `None` |
//!
//! Pre-1.0 packages bucket by `0.<minor>` because semver allows breaking
//! changes between minors below 1.0 — bucketing by `0` alone would
//! false-positive every install of any 0.x package that ever had a vuln.
//!
//! Returns `None` for inputs `semver` rejects (build metadata salad,
//! `latest`, `^1.0.0`, …). Probing falls back to the wildcard `"*"` bucket
//! at the caller side so unparseable specifiers still catch wildcard MAL-*
//! advisories.

use semver::Version;

/// The wildcard bucket key. `endevco/osv-bloom` emits this for advisories
/// whose `introduced: "0"` event covers every version, and for `MAL-*`
/// records that have no version data at all.
pub const WILDCARD_BUCKET: &str = "*";

/// Encode `version_str` into the bucket string the upstream builder used.
/// Returns `None` when the version is not a valid semver; callers should
/// fall back to probing only the wildcard bucket in that case.
pub fn version_bucket(version_str: &str) -> Option<String> {
    let v = Version::parse(version_str.trim()).ok()?;

    Some(if v.major >= 1 {
        v.major.to_string()
    } else {
        format!("0.{}", v.minor)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_post_1_0_by_major() {
        assert_eq!(version_bucket("1.2.3").as_deref(), Some("1"));
        assert_eq!(version_bucket("3.7.0").as_deref(), Some("3"));
        assert_eq!(version_bucket("18.0.0").as_deref(), Some("18"));
    }

    #[test]
    fn encodes_pre_1_0_by_zero_minor() {
        assert_eq!(version_bucket("0.3.7").as_deref(), Some("0.3"));
        assert_eq!(version_bucket("0.0.1").as_deref(), Some("0.0"));
        assert_eq!(version_bucket("0.10.0").as_deref(), Some("0.10"));
    }

    #[test]
    fn ignores_prerelease_and_build_metadata() {
        // semver matches the major/minor regardless of trailing -alpha.1 / +build.
        assert_eq!(version_bucket("1.0.0-alpha.1").as_deref(), Some("1"));
        assert_eq!(version_bucket("0.3.7+build.42").as_deref(), Some("0.3"));
    }

    #[test]
    fn rejects_unparseable() {
        assert_eq!(version_bucket("latest"), None);
        assert_eq!(version_bucket("^1.0.0"), None);
        assert_eq!(version_bucket(""), None);
        assert_eq!(version_bucket("not-a-version"), None);
    }

    #[test]
    fn trims_whitespace() {
        assert_eq!(version_bucket("  1.2.3  ").as_deref(), Some("1"));
    }
}
