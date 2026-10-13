//! Range matchers per ecosystem.
//!
//! Each ecosystem expresses "version V is affected by an advisory with range
//! `[introduced, fixed)`" in its own dialect. `RangeMatcher` is the shared
//! interface; query-time dispatch is a plain `match` on ecosystem string.

pub mod cargo;
pub mod go;
pub mod maven;
pub mod npm;
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
}

/// Pick the matcher for an OSV ecosystem name. Returns `None` for ecosystems
/// we don't yet support; callers should treat that as "no findings" rather
/// than erroring — the DB may legitimately contain rows for ecosystems the
/// running build hasn't shipped matchers for yet.
///
/// OSV ecosystem names are case-sensitive in the schema (e.g. `PyPI`,
/// `RubyGems`, `Maven`), so we normalize to lowercase before matching.
///
/// `NuGet` and `SwiftURL` are deliberately absent. Their OSV records carry
/// `last_affected` events (118 NuGet and 4 SwiftURL events in the published
/// dumps). `Range::to_pairs` stores those as an exclusive `fixed`,
/// so the version equal to `last_affected` would be reported clean. Until
/// the affected table can carry an inclusive upper bound, those ecosystems
/// stay refused.
pub fn matcher_for(ecosystem: &str) -> Option<&'static dyn RangeMatcher> {
    match ecosystem.to_lowercase().as_str() {
        "npm" => Some(&npm::NpmSemverMatcher),
        "pypi" => Some(&pep440::Pep440Matcher),
        "crates.io" | "cargo" => Some(&cargo::CargoMatcher),
        "go" => Some(&go::GoMatcher),
        "maven" => Some(&maven::MavenMatcher),
        "rubygems" => Some(&rubygems::RubyGemsMatcher),
        "pub" => Some(&pub_semver::PubMatcher),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::matcher_for;

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
    fn nuget_and_swifturl_stay_refused() {
        assert!(matcher_for("NuGet").is_none());
        assert!(matcher_for("SwiftURL").is_none());
    }
}
