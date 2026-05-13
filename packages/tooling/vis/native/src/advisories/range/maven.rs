//! Maven Central range matcher.
//!
//! Maven versions follow the Maven 3 spec
//! (<https://maven.apache.org/pom.html#Version_Order_Specification>).
//! Implemented manually here — it's a focused ~100 lines, and existing
//! crates are either unmaintained 0.1.0s or too narrow.
//!
//! Tokenization:
//!  * Split on `.`, `-`, and digit/letter boundaries.
//!  * Numeric segments compare as integers.
//!  * String segments map to qualifier ranks (alpha < beta < milestone < rc
//!    < snapshot < "" (release) < sp < other strings).
//!  * Trailing `.0` / `-0` / `-""` segments are trimmed for normalization
//!    so `1`, `1.0`, and `1-0` compare equal.

use std::cmp::Ordering;

use super::RangeMatcher;

pub struct MavenMatcher;

impl RangeMatcher for MavenMatcher {
    fn matches(&self, version: &str, introduced: &str, fixed: Option<&str>) -> bool {
        let installed = MavenVersion::parse(version);

        if introduced != "0" {
            let lower = MavenVersion::parse(introduced);
            if installed.cmp(&lower) == Ordering::Less {
                return false;
            }
        }

        if let Some(fixed) = fixed {
            let upper = MavenVersion::parse(fixed);
            if installed.cmp(&upper) != Ordering::Less {
                return false;
            }
        }

        true
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Token {
    Num(u64),
    Qual(String),
}

#[derive(Debug, Clone)]
struct MavenVersion {
    tokens: Vec<Token>,
}

impl MavenVersion {
    fn parse(raw: &str) -> Self {
        let mut tokens: Vec<Token> = Vec::new();
        let chars: Vec<char> = raw.trim().chars().collect();
        let mut i = 0;
        let mut current = String::new();
        let mut current_is_digit: Option<bool> = None;

        let flush = |buf: &mut String, is_digit: Option<bool>, out: &mut Vec<Token>| {
            if buf.is_empty() {
                return;
            }
            match is_digit {
                Some(true) => {
                    // Leading zeros are tolerated; bad numbers fall back to qual.
                    if let Ok(n) = buf.parse::<u64>() {
                        out.push(Token::Num(n));
                    } else {
                        out.push(Token::Qual(buf.to_lowercase()));
                    }
                }
                _ => out.push(Token::Qual(buf.to_lowercase())),
            }
            buf.clear();
        };

        while i < chars.len() {
            let c = chars[i];

            if c == '.' || c == '-' {
                flush(&mut current, current_is_digit, &mut tokens);
                current_is_digit = None;
                i += 1;
                continue;
            }

            let is_digit = c.is_ascii_digit();

            // Insert an implicit boundary on digit/letter transitions, mirroring
            // Maven's tokenizer behaviour.
            if let Some(prev) = current_is_digit {
                if prev != is_digit {
                    flush(&mut current, Some(prev), &mut tokens);
                }
            }

            current.push(c);
            current_is_digit = Some(is_digit);
            i += 1;
        }

        flush(&mut current, current_is_digit, &mut tokens);

        // Normalize: strip trailing tokens that compare equal to "zero" so
        // `1`, `1.0`, `1-0`, `1-""` all share a representation. The "zero" for
        // a numeric position is `Num(0)`; for a qualifier position it's the
        // empty string (release).
        while let Some(last) = tokens.last() {
            match last {
                Token::Num(0) => {
                    tokens.pop();
                }
                Token::Qual(q) if q.is_empty() => {
                    tokens.pop();
                }
                _ => break,
            }
        }

        Self { tokens }
    }

    fn cmp(&self, other: &Self) -> Ordering {
        let len = self.tokens.len().max(other.tokens.len());
        for idx in 0..len {
            let a = self.tokens.get(idx);
            let b = other.tokens.get(idx);

            let ord = match (a, b) {
                (Some(x), Some(y)) => compare_tokens(x, y),
                (Some(x), None) => compare_tokens(x, &zero_for(x)),
                (None, Some(y)) => compare_tokens(&zero_for(y), y),
                (None, None) => Ordering::Equal,
            };

            if ord != Ordering::Equal {
                return ord;
            }
        }
        Ordering::Equal
    }
}

fn zero_for(t: &Token) -> Token {
    match t {
        Token::Num(_) => Token::Num(0),
        Token::Qual(_) => Token::Qual(String::new()),
    }
}

fn compare_tokens(a: &Token, b: &Token) -> Ordering {
    match (a, b) {
        (Token::Num(x), Token::Num(y)) => x.cmp(y),
        (Token::Qual(x), Token::Qual(y)) => qualifier_rank(x).cmp(&qualifier_rank(y)),
        // Numeric beats qualifier at the same position per Maven rules.
        (Token::Num(_), Token::Qual(_)) => Ordering::Greater,
        (Token::Qual(_), Token::Num(_)) => Ordering::Less,
    }
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
enum QualifierRank {
    Known(i32),
    Other(String),
}

fn qualifier_rank(s: &str) -> QualifierRank {
    match s {
        "alpha" | "a" => QualifierRank::Known(-5),
        "beta" | "b" => QualifierRank::Known(-4),
        "milestone" | "m" => QualifierRank::Known(-3),
        "rc" | "cr" => QualifierRank::Known(-2),
        "snapshot" => QualifierRank::Known(-1),
        "" | "ga" | "final" | "release" => QualifierRank::Known(0),
        "sp" => QualifierRank::Known(1),
        // Unknown qualifiers sort alphabetically *after* `sp` per the spec.
        other => QualifierRank::Other(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn release_inside_range() {
        let m = MavenMatcher;
        assert!(m.matches("1.2.0", "1.0.0", Some("2.0.0")));
        assert!(!m.matches("2.0.0", "1.0.0", Some("2.0.0")));
    }

    #[test]
    fn alpha_below_release() {
        let m = MavenMatcher;
        // 1.0-alpha < 1.0
        assert!(m.matches("1.0-alpha", "0", Some("1.0")));
        assert!(!m.matches("1.0", "0", Some("1.0")));
    }

    #[test]
    fn beta_below_release() {
        let m = MavenMatcher;
        assert!(m.matches("1.0-beta-1", "0", Some("1.0")));
    }

    #[test]
    fn rc_below_release() {
        let m = MavenMatcher;
        assert!(m.matches("1.0-rc1", "0", Some("1.0")));
        assert!(m.matches("1.0-cr1", "0", Some("1.0")));
    }

    #[test]
    fn snapshot_below_release() {
        let m = MavenMatcher;
        assert!(m.matches("1.0-SNAPSHOT", "0", Some("1.0")));
    }

    #[test]
    fn sp_above_release() {
        let m = MavenMatcher;
        // 1.0-sp1 > 1.0 — so out of [1.0, 1.0) and out of [0, 1.0).
        assert!(!m.matches("1.0-sp1", "0", Some("1.0")));
        assert!(m.matches("1.0-sp1", "1.0", None));
    }

    #[test]
    fn ordering_trio() {
        // 1.0-alpha < 1.0 < 1.0-sp1
        let a = MavenVersion::parse("1.0-alpha");
        let b = MavenVersion::parse("1.0");
        let c = MavenVersion::parse("1.0-sp1");
        assert_eq!(a.cmp(&b), Ordering::Less);
        assert_eq!(b.cmp(&c), Ordering::Less);
    }

    #[test]
    fn normalization_trailing_zero() {
        // 1, 1.0, 1.0.0 should compare equal.
        let a = MavenVersion::parse("1");
        let b = MavenVersion::parse("1.0");
        let c = MavenVersion::parse("1.0.0");
        assert_eq!(a.cmp(&b), Ordering::Equal);
        assert_eq!(b.cmp(&c), Ordering::Equal);
    }
}
