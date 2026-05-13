//! PyPI (PEP 440) range matcher.
//!
//! PEP 440 versions are richer than SemVer: epochs (`1!2.3.4`), post-releases
//! (`1.0.post1`), pre-release tags (`a1`, `rc1`), and dev tags (`dev1`). The
//! `pep440_rs` crate is the canonical Rust implementation (used by uv) — we
//! reuse its `Version` type for parsing and ordering.

use std::str::FromStr;

use pep440_rs::Version;

use super::RangeMatcher;

pub struct Pep440Matcher;

impl RangeMatcher for Pep440Matcher {
    fn matches(&self, version: &str, introduced: &str, fixed: Option<&str>) -> bool {
        let installed = match Version::from_str(version.trim()) {
            Ok(v) => v,
            Err(_) => return false,
        };

        if introduced != "0" {
            let lower = match Version::from_str(introduced.trim()) {
                Ok(v) => v,
                Err(_) => return false,
            };
            if installed < lower {
                return false;
            }
        }

        if let Some(fixed) = fixed {
            let upper = match Version::from_str(fixed.trim()) {
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
        let m = Pep440Matcher;
        assert!(m.matches("1.2.0", "1.0.0", Some("2.0.0")));
        assert!(!m.matches("2.0.0", "1.0.0", Some("2.0.0")));
    }

    #[test]
    fn prerelease_sorts_below_release() {
        let m = Pep440Matcher;
        // 1.0.0a1 < 1.0.0 per PEP 440.
        assert!(m.matches("1.0.0a1", "0", Some("1.0.0")));
        assert!(!m.matches("1.0.0", "0", Some("1.0.0")));
    }

    #[test]
    fn post_release_sorts_above_release() {
        let m = Pep440Matcher;
        // 1.0.0.post1 > 1.0.0.
        assert!(m.matches("1.0.0.post1", "1.0.0", Some("2.0.0")));
    }

    #[test]
    fn epoch_dominates_release_segment() {
        let m = Pep440Matcher;
        // 2!1.0 > 1!99.0 because epoch 2 > epoch 1.
        assert!(m.matches("2!1.0", "1!50.0", None));
        assert!(!m.matches("1!99.0", "2!1.0", None));
    }

    #[test]
    fn open_high_range() {
        let m = Pep440Matcher;
        assert!(m.matches("99.0.0", "1.0.0", None));
    }

    #[test]
    fn rejects_invalid_versions() {
        let m = Pep440Matcher;
        assert!(!m.matches("not-a-version", "1.0.0", Some("2.0.0")));
    }
}
