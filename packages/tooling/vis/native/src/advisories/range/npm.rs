use semver::Version;

use super::RangeMatcher;

pub struct NpmSemverMatcher;

impl RangeMatcher for NpmSemverMatcher {
    fn matches(&self, version: &str, introduced: &str, fixed: Option<&str>) -> bool {
        let installed = match parse_lenient(version) {
            Some(v) => v,
            None => return false,
        };

        if introduced != "0" {
            let lower = match parse_lenient(introduced) {
                Some(v) => v,
                None => return false,
            };
            if installed < lower {
                return false;
            }
        }

        if let Some(fixed) = fixed {
            let upper = match parse_lenient(fixed) {
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

/// npm version strings sometimes drop the patch component or carry a leading
/// `v`. `semver::Version::parse` is strict, so we normalize first.
fn parse_lenient(raw: &str) -> Option<Version> {
    let trimmed = raw.trim().trim_start_matches('v');
    if let Ok(v) = Version::parse(trimmed) {
        return Some(v);
    }
    let parts: Vec<&str> = trimmed.split('-').collect();
    let core_parts: Vec<&str> = parts[0].split('.').collect();
    let core = match core_parts.len() {
        1 => format!("{}.0.0", core_parts[0]),
        2 => format!("{}.{}.0", core_parts[0], core_parts[1]),
        _ => parts[0].to_string(),
    };
    let normalized = if parts.len() > 1 { format!("{core}-{}", parts[1..].join("-")) } else { core };
    Version::parse(&normalized).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn inside_closed_open_range() {
        let m = NpmSemverMatcher;
        assert!(m.matches("1.2.0", "1.0.0", Some("2.0.0")));
        assert!(m.matches("1.0.0", "1.0.0", Some("2.0.0")));
        assert!(!m.matches("2.0.0", "1.0.0", Some("2.0.0")));
        assert!(!m.matches("0.9.0", "1.0.0", Some("2.0.0")));
    }

    #[test]
    fn open_high_range() {
        let m = NpmSemverMatcher;
        assert!(m.matches("99.0.0", "1.0.0", None));
        assert!(!m.matches("0.0.1", "1.0.0", None));
    }

    #[test]
    fn introduced_zero_means_open_low() {
        let m = NpmSemverMatcher;
        assert!(m.matches("0.0.1", "0", Some("1.0.0")));
        assert!(!m.matches("1.0.0", "0", Some("1.0.0")));
    }

    #[test]
    fn lenient_parsing_two_component() {
        let m = NpmSemverMatcher;
        assert!(m.matches("1.2", "1.0.0", Some("2.0.0")));
    }

    #[test]
    fn prerelease_versions() {
        let m = NpmSemverMatcher;
        // 1.0.0-alpha.1 is less than 1.0.0 per semver precedence
        assert!(!m.matches("1.0.0-alpha.1", "1.0.0", Some("2.0.0")));
        assert!(m.matches("1.0.0", "1.0.0-alpha.1", Some("2.0.0")));
    }
}
