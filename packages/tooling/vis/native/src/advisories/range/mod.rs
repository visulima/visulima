//! Range matchers per ecosystem.
//!
//! Each ecosystem expresses "version V is affected by an advisory with range
//! `[introduced, fixed)`" in its own dialect. `RangeMatcher` is the shared
//! interface; query-time dispatch is a plain `match` on ecosystem string.

pub mod cargo;
pub mod go;
pub mod maven;
pub mod npm;
pub mod nuget;
pub mod pep440;
pub mod pub_semver;
pub mod rubygems;

#[cfg(test)]
mod corpus_tests;

pub trait RangeMatcher: Send + Sync {
    /// Returns `true` if `version` falls in the half-open interval
    /// `[introduced, fixed)`. `fixed = None` means the range is open-high
    /// (no fix released yet).
    fn matches(&self, version: &str, introduced: &str, fixed: Option<&str>) -> bool;

    /// Closed interval `[introduced, last_affected]` for OSV `last_affected`
    /// events. The upper check reuses `matches` with the boundary as the
    /// lower bound (`last_affected >= version`), so each dialect's ordering
    /// applies without a second comparator.
    fn matches_inclusive(&self, version: &str, introduced: &str, last_affected: &str) -> bool {
        self.matches(version, introduced, None) && self.matches(last_affected, version, None)
    }
}

/// Test one stored `affected` row. A row carries either an exclusive `fixed`
/// bound or an inclusive `last_affected` bound, never both.
pub fn row_matches(
    matcher: &dyn RangeMatcher,
    version: &str,
    introduced: &str,
    fixed: Option<&str>,
    last_affected: Option<&str>,
) -> bool {
    match (fixed, last_affected) {
        (Some(upper), _) => matcher.matches(version, introduced, Some(upper)),
        (None, Some(last)) => matcher.matches_inclusive(version, introduced, last),
        (None, None) => matcher.matches(version, introduced, None),
    }
}

/// Pick the matcher for an OSV ecosystem name. Returns `None` for ecosystems
/// we don't yet support; callers should treat that as "no findings" rather
/// than erroring — the DB may legitimately contain rows for ecosystems the
/// running build hasn't shipped matchers for yet.
///
/// OSV ecosystem names are case-sensitive in the schema (e.g. `PyPI`,
/// `RubyGems`, `Maven`), so we normalize to lowercase before matching.
///
pub fn matcher_for(ecosystem: &str) -> Option<&'static dyn RangeMatcher> {
    match ecosystem.to_lowercase().as_str() {
        "npm" => Some(&npm::NpmSemverMatcher),
        "pypi" => Some(&pep440::Pep440Matcher),
        "crates.io" | "cargo" => Some(&cargo::CargoMatcher),
        "go" => Some(&go::GoMatcher),
        "maven" => Some(&maven::MavenMatcher),
        "rubygems" => Some(&rubygems::RubyGemsMatcher),
        "pub" => Some(&pub_semver::PubMatcher),
        // SwiftPM tags are SemVer. The lenient parser also accepts the
        // two-part fixed versions (`1.20`) that OSV carries for SwiftURL.
        "swifturl" => Some(&npm::NpmSemverMatcher),
        "nuget" => Some(&nuget::NuGetMatcher),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{matcher_for, row_matches};

    #[test]
    fn pub_dispatches_to_strict_semver() {
        let m = matcher_for("Pub").expect("Pub has a matcher");
        assert!(m.matches("0.13.2", "0", Some("0.13.3")));
        assert!(!m.matches("0.13.3", "0", Some("0.13.3")));
        assert!(!m.matches("0.13", "0", Some("0.13.3")), "two-part Pub versions are not SemVer");
        assert!(matcher_for("pub").is_some(), "dispatch is case-insensitive");
    }

    #[test]
    fn pub_prerelease_precedes_release() {
        let m = matcher_for("pub").expect("pub has a matcher");
        assert!(m.matches("1.0.0-dev.1", "0", Some("1.0.0")));
        assert!(!m.matches("1.0.0", "0", Some("1.0.0")));
    }

    #[test]
    fn nuget_dispatches_case_insensitively() {
        let m = matcher_for("NuGet").expect("NuGet has a matcher");
        // GHSA-hh56-x62g-gvhc (CLEditor): last_affected 1.4.5 is inclusive.
        assert!(row_matches(m, "1.4.5", "0", None, Some("1.4.5")));
        assert!(!row_matches(m, "1.4.5.1", "0", None, Some("1.4.5")));
        assert!(matcher_for("nuget").is_some());
    }

    #[test]
    fn swifturl_uses_semver_bounds_and_lenient_two_part_versions() {
        let m = matcher_for("SwiftURL").expect("SwiftURL has a matcher");
        // GHSA-7fj7-39wj-c64f (apple/swift-nio): fixed 2.42.0.
        assert!(row_matches(m, "2.41.0", "2.41.0", Some("2.42.0"), None));
        assert!(!row_matches(m, "2.42.0", "2.41.0", Some("2.42.0"), None));
        // Two-part fixed version from the same dump.
        assert!(row_matches(m, "1.19.9", "0", Some("1.20"), None));
        assert!(!row_matches(m, "1.20.0", "0", Some("1.20"), None));
        // Pre-release precedes its release.
        assert!(row_matches(m, "2.0.0-alpha.1", "0", Some("2.0.0"), None));
    }

    #[test]
    fn last_affected_is_inclusive_and_fixed_is_exclusive() {
        let m = matcher_for("npm").expect("npm has a matcher");
        // OSV `last_affected: 4.5.0`: 4.5.0 is affected, 4.5.1 is clean.
        assert!(row_matches(m, "4.5.0", "0", None, Some("4.5.0")));
        assert!(!row_matches(m, "4.5.1", "0", None, Some("4.5.0")));
        assert!(row_matches(m, "4.4.9", "0", None, Some("4.5.0")));
        // OSV `fixed: 4.5.0`: 4.5.0 is clean.
        assert!(!row_matches(m, "4.5.0", "0", Some("4.5.0"), None));
        assert!(row_matches(m, "4.4.9", "0", Some("4.5.0"), None));
    }

    #[test]
    fn last_affected_respects_introduced() {
        let m = matcher_for("pub").expect("pub has a matcher");
        assert!(!row_matches(m, "0.9.0", "1.0.0", None, Some("1.2.0")), "below introduced");
        assert!(row_matches(m, "1.2.0", "1.0.0", None, Some("1.2.0")));
        assert!(!row_matches(m, "1.2.0+1", "1.0.0", None, Some("1.2.0")), "build suffix sorts above the bare version");
    }
}
