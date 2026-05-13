//! Go module range matcher.
//!
//! Go modules use SemVer with two quirks vs npm/cargo:
//!  1. Every version is prefixed with `v` (e.g. `v1.2.3`).
//!  2. Major versions ≥ 2 without a `/vN` import path suffix get a
//!     `+incompatible` build-metadata tag (`v2.0.0+incompatible`). The
//!     leading metadata is _ignored_ for ordering per SemVer rules, which
//!     `semver::Version` honours automatically — we just need to strip
//!     the leading `v`.
//!
//! Pseudo-versions like `v0.0.0-20210101000000-abcdef012345` are valid
//! SemVer prereleases — they sort below `v0.0.0` as expected.

use semver::Version;

use super::RangeMatcher;

pub struct GoMatcher;

impl RangeMatcher for GoMatcher {
    fn matches(&self, version: &str, introduced: &str, fixed: Option<&str>) -> bool {
        let installed = match parse_go(version) {
            Some(v) => v,
            None => return false,
        };

        if introduced != "0" {
            let lower = match parse_go(introduced) {
                Some(v) => v,
                None => return false,
            };
            if installed < lower {
                return false;
            }
        }

        if let Some(fixed) = fixed {
            let upper = match parse_go(fixed) {
                Some(v) => v,
                None => return false,
            };
            if installed >= upper {
                return false;
            }
        }

        true
    }
}

fn parse_go(raw: &str) -> Option<Version> {
    let trimmed = raw.trim().trim_start_matches('v');
    Version::parse(trimmed).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn handles_v_prefix() {
        let m = GoMatcher;
        assert!(m.matches("v1.2.0", "v1.0.0", Some("v2.0.0")));
        assert!(!m.matches("v2.0.0", "v1.0.0", Some("v2.0.0")));
    }

    #[test]
    fn handles_incompatible_metadata() {
        let m = GoMatcher;
        // v2.0.0+incompatible compares equal to v2.0.0 by semver precedence.
        assert!(!m.matches("v2.0.0+incompatible", "v1.0.0", Some("v2.0.0")));
        assert!(m.matches("v2.0.0+incompatible", "v2.0.0", Some("v3.0.0")));
    }

    #[test]
    fn pseudo_version_sorts_below_release() {
        let m = GoMatcher;
        // v0.0.0-20210101000000-abc is a prerelease, sorts below v0.0.0.
        assert!(m.matches(
            "v0.0.0-20210101000000-abcdef012345",
            "0",
            Some("v1.0.0")
        ));
    }

    #[test]
    fn open_high_range() {
        let m = GoMatcher;
        assert!(m.matches("v99.0.0", "v1.0.0", None));
        assert!(!m.matches("v0.9.0", "v1.0.0", None));
    }

    #[test]
    fn rejects_non_semver() {
        let m = GoMatcher;
        assert!(!m.matches("v1.0", "v1.0.0", Some("v2.0.0")));
    }
}
