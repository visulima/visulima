//! crates.io range matcher.
//!
//! Cargo enforces strict SemVer 2.0 on every published version, so the
//! npm matcher's lenient parser is overkill here. We use `semver::Version`
//! directly and reject anything that doesn't round-trip.

use semver::Version;

use super::RangeMatcher;

pub struct CargoMatcher;

impl RangeMatcher for CargoMatcher {
    fn matches(&self, version: &str, introduced: &str, fixed: Option<&str>) -> bool {
        let installed = match Version::parse(version.trim()) {
            Ok(v) => v,
            Err(_) => return false,
        };

        if introduced != "0" {
            let lower = match Version::parse(introduced.trim()) {
                Ok(v) => v,
                Err(_) => return false,
            };
            if installed < lower {
                return false;
            }
        }

        if let Some(fixed) = fixed {
            let upper = match Version::parse(fixed.trim()) {
                Ok(v) => v,
                Err(_) => return false,
            };
            if installed >= upper {
                return false;
            }
        }

        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn closed_open_range() {
        let m = CargoMatcher;
        assert!(m.matches("1.2.0", "1.0.0", Some("2.0.0")));
        assert!(m.matches("1.0.0", "1.0.0", Some("2.0.0")));
        assert!(!m.matches("2.0.0", "1.0.0", Some("2.0.0")));
        assert!(!m.matches("0.9.0", "1.0.0", Some("2.0.0")));
    }

    #[test]
    fn open_high_range() {
        let m = CargoMatcher;
        assert!(m.matches("99.0.0", "1.0.0", None));
    }

    #[test]
    fn open_low_range_via_zero_marker() {
        let m = CargoMatcher;
        assert!(m.matches("0.0.1", "0", Some("1.0.0")));
        assert!(!m.matches("1.0.0", "0", Some("1.0.0")));
    }

    #[test]
    fn rejects_non_semver_versions() {
        let m = CargoMatcher;
        // crates.io requires three components — "1.0" is not valid SemVer.
        assert!(!m.matches("1.0", "1.0.0", Some("2.0.0")));
    }

    #[test]
    fn prerelease_precedence() {
        let m = CargoMatcher;
        assert!(!m.matches("1.0.0-rc.1", "1.0.0", Some("2.0.0")));
        assert!(m.matches("1.0.0", "1.0.0-rc.1", Some("2.0.0")));
    }
}
