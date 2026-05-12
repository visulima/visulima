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
pub fn matcher_for(ecosystem: &str) -> Option<&'static dyn RangeMatcher> {
    match ecosystem.to_lowercase().as_str() {
        "npm" => Some(&npm::NpmSemverMatcher),
        "pypi" => Some(&pep440::Pep440Matcher),
        "crates.io" | "cargo" => Some(&cargo::CargoMatcher),
        "go" => Some(&go::GoMatcher),
        "maven" => Some(&maven::MavenMatcher),
        "rubygems" => Some(&rubygems::RubyGemsMatcher),
        _ => None,
    }
}
