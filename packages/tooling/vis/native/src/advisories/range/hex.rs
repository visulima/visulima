//! Hex range matcher.
//!
//! Hex versions are Elixir semver: `MAJOR.MINOR.PATCH` with an optional
//! `-pre` and `+build` suffix. OSV records for Hex use `SEMVER` ranges with
//! `introduced` and `fixed` events. Build metadata does not affect ordering,
//! which `semver::Version` already honours, so no extra comparator is needed.

use semver::Version;

use super::RangeMatcher;

pub struct HexMatcher;

impl RangeMatcher for HexMatcher {
    fn matches(&self, version: &str, introduced: &str, fixed: Option<&str>) -> bool {
        let installed = match parse(version) {
            Some(v) => v,
            None => return false,
        };

        if introduced != "0" {
            let lower = match parse(introduced) {
                Some(v) => v,
                None => return false,
            };
            if installed < lower {
                return false;
            }
        }

        if let Some(fixed) = fixed {
            let upper = match parse(fixed) {
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

fn parse(raw: &str) -> Option<Version> {
    Version::parse(raw.trim()).ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::advisories::range::row_matches;

    #[test]
    fn closed_open_range() {
        let m = HexMatcher;
        assert!(m.matches("1.7.0", "1.7.0", Some("1.7.22")));
        assert!(m.matches("1.7.21", "1.7.0", Some("1.7.22")));
        assert!(!m.matches("1.7.22", "1.7.0", Some("1.7.22")));
        assert!(!m.matches("1.6.9", "1.7.0", Some("1.7.22")));
    }

    #[test]
    fn introduced_zero_means_open_low() {
        let m = HexMatcher;
        assert!(m.matches("0.1.0", "0", Some("1.16.6")));
        assert!(!m.matches("1.16.6", "0", Some("1.16.6")));
    }

    #[test]
    fn last_affected_is_inclusive() {
        // OSV last_affected names the last affected release, so it is included.
        let m = HexMatcher;
        assert!(row_matches(&m, "1.5.9", "1.0.0", None, Some("1.5.9")));
        assert!(!row_matches(&m, "1.5.10", "1.0.0", None, Some("1.5.9")));
    }

    #[test]
    fn open_high_range() {
        let m = HexMatcher;
        assert!(m.matches("9.0.0", "1.0.0", None));
        assert!(!m.matches("0.9.0", "1.0.0", None));
    }

    #[test]
    fn release_candidate_sorts_below_release() {
        let m = HexMatcher;
        assert!(m.matches("1.6.0-rc.0", "1.4.0-rc.0", Some("1.6.17")));
        assert!(!m.matches("1.6.0", "1.6.0-rc.1", Some("1.6.0")));
        assert!(m.matches("1.6.0-rc.0", "1.6.0-rc.0", Some("1.6.0")));
    }

    #[test]
    fn build_metadata_does_not_change_precedence() {
        let m = HexMatcher;
        assert!(!m.matches("1.7.22+build.4", "1.7.0", Some("1.7.22")));
        assert!(m.matches("1.7.21+build.4", "1.7.0", Some("1.7.22")));
    }

    #[test]
    fn unparseable_version_never_matches() {
        let m = HexMatcher;
        assert!(!m.matches("1.7", "1.0.0", Some("2.0.0")));
    }
}
