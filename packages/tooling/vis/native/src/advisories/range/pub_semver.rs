//! Pub range matcher.
//!
//! Pub versions are strict SemVer 2.0, but Pub also orders `+build` suffixes.
//! SemVer precedence ignores build metadata, so `Version` comparison alone
//! would call `0.3.5` clean under a fix of `0.3.5+1`. The OSV record for
//! `jose` (GHSA-vm9r-h74p-hg97) uses exactly that fix, so build metadata
//! breaks ties between otherwise equal versions.

use std::cmp::Ordering;

use semver::Version;

use super::RangeMatcher;

pub struct PubMatcher;

impl RangeMatcher for PubMatcher {
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
            if compare(&installed, &lower) == Ordering::Less {
                return false;
            }
        }

        if let Some(fixed) = fixed {
            let upper = match parse(fixed) {
                Some(v) => v,
                None => return false,
            };
            if compare(&installed, &upper) != Ordering::Less {
                return false;
            }
        }

        true
    }
}

fn parse(raw: &str) -> Option<Version> {
    Version::parse(raw.trim()).ok()
}

fn compare(a: &Version, b: &Version) -> Ordering {
    a.cmp(b).then_with(|| compare_build(a.build.as_str(), b.build.as_str()))
}

/// A version with no build suffix sorts before one with a suffix. Dot-separated
/// identifiers compare numerically when both are numbers, otherwise as text.
fn compare_build(a: &str, b: &str) -> Ordering {
    match (a.is_empty(), b.is_empty()) {
        (true, true) => return Ordering::Equal,
        (true, false) => return Ordering::Less,
        (false, true) => return Ordering::Greater,
        (false, false) => {}
    }

    let mut left = a.split('.');
    let mut right = b.split('.');

    loop {
        match (left.next(), right.next()) {
            (None, None) => return Ordering::Equal,
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(x), Some(y)) => {
                let order = match (x.parse::<u64>(), y.parse::<u64>()) {
                    (Ok(p), Ok(q)) => p.cmp(&q),
                    _ => x.cmp(y),
                };

                if order != Ordering::Equal {
                    return order;
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_suffix_sorts_after_bare_version() {
        let m = PubMatcher;
        assert!(m.matches("0.3.5", "0", Some("0.3.5+1")), "0.3.5 is below the 0.3.5+1 fix");
        assert!(!m.matches("0.3.5+1", "0", Some("0.3.5+1")));
        assert!(!m.matches("0.3.5+2", "0", Some("0.3.5+1")));
    }

    #[test]
    fn numeric_build_identifiers_compare_as_numbers() {
        let m = PubMatcher;
        assert!(!m.matches("0.3.5+10", "0", Some("0.3.5+9")));
        assert!(m.matches("0.3.5+9", "0", Some("0.3.5+10")));
    }

    #[test]
    fn ordinary_semver_precedence_still_applies() {
        let m = PubMatcher;
        assert!(m.matches("0.13.2", "0", Some("0.13.3")));
        assert!(!m.matches("0.13.3", "0", Some("0.13.3")));
        assert!(m.matches("1.0.0-dev.1", "0", Some("1.0.0")));
        assert!(!m.matches("1.0.0", "0", Some("1.0.0")));
    }
}
