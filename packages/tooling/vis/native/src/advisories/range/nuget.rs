//! NuGet range matcher.
//!
//! NuGet versions are SemVer-like with up to four numeric parts (`1.0.0.1`),
//! so `semver::Version` cannot parse them. Ordering follows NuGet's rules:
//!
//! - Missing numeric parts count as zero, so `1.0`, `1.0.0` and `1.0.0.0` are
//!   equal.
//! - Build metadata (`+...`) is ignored.
//! - A release sorts after any pre-release of the same numbers.
//! - Pre-release labels compare by dot-separated identifiers. Numeric
//!   identifiers compare as numbers, a numeric identifier sorts before an
//!   alphanumeric one, and comparison ignores ASCII case.

use std::cmp::Ordering;

use super::RangeMatcher;

pub struct NuGetMatcher;

impl RangeMatcher for NuGetMatcher {
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

#[derive(Debug, PartialEq, Eq)]
struct Version {
    core: [u64; 4],
    pre: Option<String>,
}

fn parse(raw: &str) -> Option<Version> {
    let without_metadata = raw.trim().split('+').next()?;
    let (core, pre) = match without_metadata.split_once('-') {
        Some((core, pre)) => {
            if pre.split('.').any(str::is_empty) {
                return None;
            }
            (core, Some(pre.to_string()))
        }
        None => (without_metadata, None),
    };

    let parts: Vec<&str> = core.split('.').collect();
    if parts.len() > 4 {
        return None;
    }
    let mut numbers = [0u64; 4];
    for (slot, part) in numbers.iter_mut().zip(parts) {
        if !is_numeric(part) {
            return None;
        }
        *slot = part.parse().ok()?;
    }

    Some(Version { core: numbers, pre })
}

fn compare(a: &Version, b: &Version) -> Ordering {
    a.core.cmp(&b.core).then_with(|| match (&a.pre, &b.pre) {
        (None, None) => Ordering::Equal,
        (None, Some(_)) => Ordering::Greater,
        (Some(_), None) => Ordering::Less,
        (Some(x), Some(y)) => compare_pre(x, y),
    })
}

fn compare_pre(a: &str, b: &str) -> Ordering {
    let mut left = a.split('.');
    let mut right = b.split('.');
    loop {
        match (left.next(), right.next()) {
            (None, None) => return Ordering::Equal,
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(x), Some(y)) => {
                let ordering = compare_identifier(x, y);
                if ordering != Ordering::Equal {
                    return ordering;
                }
            }
        }
    }
}

fn compare_identifier(a: &str, b: &str) -> Ordering {
    match (is_numeric(a), is_numeric(b)) {
        (true, true) => {
            let a = a.trim_start_matches('0');
            let b = b.trim_start_matches('0');
            a.len().cmp(&b.len()).then_with(|| a.cmp(b))
        }
        (true, false) => Ordering::Less,
        (false, true) => Ordering::Greater,
        (false, false) => a.to_ascii_lowercase().cmp(&b.to_ascii_lowercase()),
    }
}

fn is_numeric(part: &str) -> bool {
    !part.is_empty() && part.bytes().all(|b| b.is_ascii_digit())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn matches(version: &str, fixed: &str) -> bool {
        NuGetMatcher.matches(version, "0", Some(fixed))
    }

    #[test]
    fn four_part_versions_compare_numerically() {
        assert!(matches("1.0.0.1", "1.0.0.2"));
        assert!(!matches("1.0.0.2", "1.0.0.2"));
        assert!(!matches("1.0.0.10", "1.0.0.9"), "10 is above 9, not below");
        assert!(matches("1.0.0.9", "1.0.0.10"));
    }

    #[test]
    fn missing_parts_are_zero() {
        assert!(!matches("1.0", "1.0.0.0"));
        assert!(!matches("1.0.0", "1.0.0.0"));
        assert!(!matches("1", "1.0"));
        assert!(matches("1.0.0", "1.0.0.1"));
        assert!(!matches("1.0.0.0", "1.0.0"));
    }

    #[test]
    fn leading_zeros_and_build_metadata_do_not_change_order() {
        assert!(!matches("1.01.1", "1.1.1"));
        assert!(!matches("1.0.7+r3456", "1.0.7"));
    }

    #[test]
    fn release_sorts_after_its_prerelease() {
        assert!(matches("13.0.1-beta1", "13.0.1"));
        assert!(!matches("13.0.1", "13.0.1"));
        assert!(matches("1.0.1-zzz", "1.0.1"));
    }

    #[test]
    fn prerelease_identifiers_follow_nuget_order() {
        assert!(matches("1.0.1-alpha10", "1.0.1-alpha2"), "alpha10 sorts before alpha2 (alphanumeric)");
        assert!(matches("1.0.1-rc.2", "1.0.1-rc.10"), "numeric identifiers compare as numbers");
        assert!(matches("1.0.1-aaa", "1.0.1-beta"));
        assert!(matches("1.0.1-alpha.1", "1.0.1-alpha.beta"), "numeric identifier sorts first");
        assert!(matches("1.0.1-alpha", "1.0.1-alpha.1"), "shorter label sorts first");
    }

    #[test]
    fn prerelease_labels_compare_case_insensitively() {
        assert!(!matches("1.0.0-RC.1", "1.0.0-rc.1"));
        assert!(!matches("1.0.0-Alpha", "1.0.0-alpha"));
    }

    #[test]
    fn range_bounds_use_nuget_ordering() {
        // Newtonsoft.Json GHSA-5crp-9r3c-p9vr: fixed 13.0.1.
        assert!(NuGetMatcher.matches("13.0.0", "0", Some("13.0.1")));
        assert!(NuGetMatcher.matches("13.0.1-beta1", "0", Some("13.0.1")));
        assert!(!NuGetMatcher.matches("13.0.1", "0", Some("13.0.1")));
        assert!(!NuGetMatcher.matches("12.0.9", "13.0.0", Some("13.0.1")), "below introduced");
    }

    #[test]
    fn invalid_versions_never_match() {
        assert!(!NuGetMatcher.matches("1.0.0.0.0", "0", None));
        assert!(!NuGetMatcher.matches("1.x", "0", None));
        assert!(!NuGetMatcher.matches("1.0.0-", "0", None));
    }
}
