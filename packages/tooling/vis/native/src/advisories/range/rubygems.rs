//! RubyGems range matcher.
//!
//! RubyGems versions follow the rules in `Gem::Version`
//! (<https://docs.ruby-lang.org/en/3.0/Gem/Version.html>). Versions are
//! tokenised into runs of digits or letters (so `1.0.0beta1` parses as
//! `[1, 0, 0, "beta", 1]`), then split into a numeric prefix and a
//! string-or-mixed tail. Trailing zeros on each side are trimmed so
//! `1.0` == `1` and the two halves are concatenated to form the canonical
//! segment list used for comparison.
//!
//! Comparison rule (per the Ruby implementation): when one side runs out
//! of segments, the missing slot defaults to integer `0` — and `String < Integer`
//! at the same position. That's what makes `1.0.0.beta` sort *below* `1.0.0`.

use std::cmp::Ordering;

use super::RangeMatcher;

pub struct RubyGemsMatcher;

impl RangeMatcher for RubyGemsMatcher {
    fn matches(&self, version: &str, introduced: &str, fixed: Option<&str>) -> bool {
        let installed = RubyVersion::parse(version);

        if introduced != "0" {
            let lower = RubyVersion::parse(introduced);
            if installed.cmp(&lower) == Ordering::Less {
                return false;
            }
        }

        if let Some(fixed) = fixed {
            let upper = RubyVersion::parse(fixed);
            if installed.cmp(&upper) != Ordering::Less {
                return false;
            }
        }

        true
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Segment {
    Num(u64),
    Str(String),
}

#[derive(Debug, Clone)]
struct RubyVersion {
    segments: Vec<Segment>,
}

impl RubyVersion {
    fn parse(raw: &str) -> Self {
        // Scan for runs of digits or letters; everything else (dots, dashes)
        // is treated as a separator. This mirrors `s.scan(/[0-9]+|[a-z]+/i)`.
        let mut raw_segments: Vec<Segment> = Vec::new();
        let chars: Vec<char> = raw.trim().chars().collect();
        let mut i = 0;

        while i < chars.len() {
            let c = chars[i];
            if c.is_ascii_digit() {
                let start = i;
                while i < chars.len() && chars[i].is_ascii_digit() {
                    i += 1;
                }
                let slice: String = chars[start..i].iter().collect();
                if let Ok(n) = slice.parse::<u64>() {
                    raw_segments.push(Segment::Num(n));
                } else {
                    raw_segments.push(Segment::Str(slice.to_lowercase()));
                }
            } else if c.is_ascii_alphabetic() {
                let start = i;
                while i < chars.len() && chars[i].is_ascii_alphabetic() {
                    i += 1;
                }
                let slice: String = chars[start..i].iter().collect();
                raw_segments.push(Segment::Str(slice.to_lowercase()));
            } else {
                // Skip separators (., -, _, etc.)
                i += 1;
            }
        }

        // Split into numeric prefix and string-or-mixed tail.
        let split_at = raw_segments.iter().position(|s| matches!(s, Segment::Str(_)));
        let (mut numeric, mut tail): (Vec<Segment>, Vec<Segment>) = match split_at {
            Some(idx) => {
                let tail = raw_segments.split_off(idx);
                (raw_segments, tail)
            }
            None => (raw_segments, Vec::new()),
        };

        trim_trailing_zeros(&mut numeric);
        trim_trailing_zeros(&mut tail);

        numeric.extend(tail);
        Self { segments: numeric }
    }

    fn cmp(&self, other: &Self) -> Ordering {
        let len = self.segments.len().max(other.segments.len());
        for idx in 0..len {
            // Missing slots default to Num(0), so `1.0.0.beta` (tail = "beta")
            // ends up comparing String("beta") against Num(0) — String loses.
            let default = Segment::Num(0);
            let a = self.segments.get(idx).unwrap_or(&default);
            let b = other.segments.get(idx).unwrap_or(&default);

            let ord = match (a, b) {
                (Segment::Num(x), Segment::Num(y)) => x.cmp(y),
                (Segment::Str(x), Segment::Str(y)) => x.cmp(y),
                (Segment::Str(_), Segment::Num(_)) => Ordering::Less,
                (Segment::Num(_), Segment::Str(_)) => Ordering::Greater,
            };

            if ord != Ordering::Equal {
                return ord;
            }
        }
        Ordering::Equal
    }
}

fn trim_trailing_zeros(segments: &mut Vec<Segment>) {
    while let Some(Segment::Num(0)) = segments.last() {
        segments.pop();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn closed_open_range() {
        let m = RubyGemsMatcher;
        assert!(m.matches("1.2.0", "1.0.0", Some("2.0.0")));
        assert!(!m.matches("2.0.0", "1.0.0", Some("2.0.0")));
    }

    #[test]
    fn prerelease_sorts_below_release() {
        let m = RubyGemsMatcher;
        // 1.0.0.beta < 1.0.0
        assert!(m.matches("1.0.0.beta", "0", Some("1.0.0")));
        assert!(!m.matches("1.0.0", "0", Some("1.0.0")));
    }

    #[test]
    fn rc_sorts_below_release() {
        let m = RubyGemsMatcher;
        assert!(m.matches("1.0.0.rc1", "0", Some("1.0.0")));
        assert!(m.matches("1.0.0.rc.1", "0", Some("1.0.0")));
    }

    #[test]
    fn beta_alphabetical_order() {
        // 1.0.0.alpha < 1.0.0.beta < 1.0.0.rc — string segments sort lexically.
        let a = RubyVersion::parse("1.0.0.alpha");
        let b = RubyVersion::parse("1.0.0.beta");
        let c = RubyVersion::parse("1.0.0.rc");
        assert_eq!(a.cmp(&b), Ordering::Less);
        assert_eq!(b.cmp(&c), Ordering::Less);
    }

    #[test]
    fn normalization_trailing_zero() {
        // 1, 1.0, 1.0.0 should compare equal.
        let a = RubyVersion::parse("1");
        let b = RubyVersion::parse("1.0");
        let c = RubyVersion::parse("1.0.0");
        assert_eq!(a.cmp(&b), Ordering::Equal);
        assert_eq!(b.cmp(&c), Ordering::Equal);
    }

    #[test]
    fn open_high_range() {
        let m = RubyGemsMatcher;
        assert!(m.matches("99.0.0", "1.0.0", None));
        assert!(!m.matches("0.9.0", "1.0.0", None));
    }

    #[test]
    fn mixed_digit_letter_tokenisation() {
        // "1.0.0beta1" splits into [1, 0, 0, "beta", 1] without an explicit
        // separator before "beta".
        let a = RubyVersion::parse("1.0.0beta1");
        let b = RubyVersion::parse("1.0.0.beta.1");
        assert_eq!(a.cmp(&b), Ordering::Equal);
    }
}
