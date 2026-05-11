//! Subset of the OSV schema we need for ingest.
//!
//! Reference: <https://ossf.github.io/osv-schema/>. We deserialize only the fields
//! consumed at ingest time; everything else is dropped on the floor.

use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct Advisory {
    pub id: String,
    #[serde(default)]
    pub aliases: Vec<String>,
    #[serde(default)]
    pub summary: String,
    pub published: Option<String>,
    pub modified: Option<String>,
    #[serde(default)]
    pub severity: Vec<Severity>,
    #[serde(default)]
    pub database_specific: Option<DatabaseSpecific>,
    #[serde(default)]
    pub affected: Vec<Affected>,
}

#[derive(Debug, Deserialize)]
pub struct Severity {
    #[serde(rename = "type")]
    pub kind: String,
    pub score: String,
}

#[derive(Debug, Deserialize)]
pub struct DatabaseSpecific {
    /// GHSA includes `"severity": "HIGH"`. PYSEC sometimes omits.
    pub severity: Option<String>,
    /// Optional numeric CVSS score (out of band of the `severity` vector).
    pub cvss_score: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct Affected {
    pub package: Package,
    #[serde(default)]
    pub ranges: Vec<Range>,
}

#[derive(Debug, Deserialize)]
pub struct Package {
    pub ecosystem: String,
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct Range {
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(default)]
    pub events: Vec<Event>,
}

#[derive(Debug, Deserialize)]
pub struct Event {
    #[serde(default)]
    pub introduced: Option<String>,
    #[serde(default)]
    pub fixed: Option<String>,
    #[serde(default)]
    pub last_affected: Option<String>,
    #[serde(default)]
    pub limit: Option<String>,
}

/// `(introduced, fixed)` pair flattened from a range's `events[]`. The OSV format
/// expresses ranges as a sequence of `introduced`/`fixed` events on a number line;
/// we collapse them into closed-open intervals at ingest time so the query path
/// only ever compares versions.
#[derive(Debug, Clone)]
pub struct RangePair {
    pub introduced: String,
    pub fixed: Option<String>,
}

impl Range {
    /// Walk `events[]` and emit `(introduced, fixed?)` pairs. OSV events come in
    /// pairs: an `introduced` followed by a `fixed` (or `last_affected`, or end of
    /// list). Open-low ranges use `introduced: "0"`. Open-high ranges have no
    /// closing event and we emit `fixed: None`.
    pub fn to_pairs(&self) -> Vec<RangePair> {
        let mut out = Vec::new();
        let mut current_introduced: Option<String> = None;
        for event in &self.events {
            if let Some(intro) = &event.introduced {
                if let Some(prev) = current_introduced.take() {
                    out.push(RangePair {
                        introduced: prev,
                        fixed: None,
                    });
                }
                current_introduced = Some(intro.clone());
            } else if let Some(fixed) = &event.fixed {
                if let Some(prev) = current_introduced.take() {
                    out.push(RangePair {
                        introduced: prev,
                        fixed: Some(fixed.clone()),
                    });
                }
            } else if let Some(last) = &event.last_affected {
                if let Some(prev) = current_introduced.take() {
                    out.push(RangePair {
                        introduced: prev,
                        fixed: Some(last.clone()),
                    });
                }
            } else if event.limit.is_some() {
                if let Some(prev) = current_introduced.take() {
                    out.push(RangePair {
                        introduced: prev,
                        fixed: None,
                    });
                }
            }
        }
        if let Some(intro) = current_introduced.take() {
            out.push(RangePair {
                introduced: intro,
                fixed: None,
            });
        }
        out
    }
}

/// Reduce the various severity signals OSV ships to a single normalized label.
/// Order of precedence:
///   1. `database_specific.severity` (already labeled by the upstream DB).
///   2. CVSS_V3 / CVSS_V4 numeric score (mapped via CVSS bucketing).
///   3. `"UNKNOWN"` fallback.
pub fn normalized_severity(adv: &Advisory) -> (String, Option<f64>) {
    if let Some(ds) = &adv.database_specific {
        if let Some(label) = &ds.severity {
            let normalized = label.to_uppercase();
            if matches!(
                normalized.as_str(),
                "CRITICAL" | "HIGH" | "MODERATE" | "MEDIUM" | "LOW"
            ) {
                let canonical = if normalized == "MEDIUM" {
                    "MODERATE".to_string()
                } else {
                    normalized
                };
                let score = ds.cvss_score.or_else(|| extract_cvss_base_score(&adv.severity));
                return (canonical, score);
            }
        }
    }

    if let Some(score) = extract_cvss_base_score(&adv.severity) {
        let label = score_to_label(score);
        return (label.to_string(), Some(score));
    }

    ("UNKNOWN".to_string(), None)
}

fn extract_cvss_base_score(entries: &[Severity]) -> Option<f64> {
    for entry in entries {
        if entry.kind.starts_with("CVSS_V") {
            if let Some(score) = parse_cvss_base_score(&entry.score) {
                return Some(score);
            }
        }
    }
    None
}

/// CVSS vector strings encode the base score implicitly. Some OSV records embed
/// the numeric base in a non-standard suffix (`"CVSS:3.1/...?baseScore=7.5"`);
/// when present we use it. Otherwise we return `None` and the caller falls back
/// to the database-specific label.
fn parse_cvss_base_score(value: &str) -> Option<f64> {
    if let Some(idx) = value.find("baseScore=") {
        let tail = &value[idx + "baseScore=".len()..];
        let end = tail.find(|c: char| !c.is_ascii_digit() && c != '.').unwrap_or(tail.len());
        return tail[..end].parse::<f64>().ok();
    }
    None
}

fn score_to_label(score: f64) -> &'static str {
    if score >= 9.0 {
        "CRITICAL"
    } else if score >= 7.0 {
        "HIGH"
    } else if score >= 4.0 {
        "MODERATE"
    } else if score > 0.0 {
        "LOW"
    } else {
        "UNKNOWN"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn range_with_introduced_and_fixed_emits_one_pair() {
        let r = Range {
            kind: "SEMVER".into(),
            events: vec![
                Event {
                    introduced: Some("0".into()),
                    fixed: None,
                    last_affected: None,
                    limit: None,
                },
                Event {
                    introduced: None,
                    fixed: Some("1.2.3".into()),
                    last_affected: None,
                    limit: None,
                },
            ],
        };
        let pairs = r.to_pairs();
        assert_eq!(pairs.len(), 1);
        assert_eq!(pairs[0].introduced, "0");
        assert_eq!(pairs[0].fixed.as_deref(), Some("1.2.3"));
    }

    #[test]
    fn range_open_high_emits_pair_without_fixed() {
        let r = Range {
            kind: "SEMVER".into(),
            events: vec![Event {
                introduced: Some("2.0.0".into()),
                fixed: None,
                last_affected: None,
                limit: None,
            }],
        };
        let pairs = r.to_pairs();
        assert_eq!(pairs.len(), 1);
        assert_eq!(pairs[0].fixed, None);
    }

    #[test]
    fn range_multiple_intervals_split_per_pair() {
        let r = Range {
            kind: "SEMVER".into(),
            events: vec![
                Event {
                    introduced: Some("0".into()),
                    fixed: None,
                    last_affected: None,
                    limit: None,
                },
                Event {
                    introduced: None,
                    fixed: Some("1.5.0".into()),
                    last_affected: None,
                    limit: None,
                },
                Event {
                    introduced: Some("2.0.0".into()),
                    fixed: None,
                    last_affected: None,
                    limit: None,
                },
                Event {
                    introduced: None,
                    fixed: Some("2.3.4".into()),
                    last_affected: None,
                    limit: None,
                },
            ],
        };
        let pairs = r.to_pairs();
        assert_eq!(pairs.len(), 2);
        assert_eq!(pairs[1].introduced, "2.0.0");
        assert_eq!(pairs[1].fixed.as_deref(), Some("2.3.4"));
    }

    #[test]
    fn severity_prefers_database_specific_label() {
        let adv = Advisory {
            id: "GHSA-x".into(),
            aliases: vec![],
            summary: "".into(),
            published: None,
            modified: None,
            severity: vec![],
            database_specific: Some(DatabaseSpecific {
                severity: Some("HIGH".into()),
                cvss_score: None,
            }),
            affected: vec![],
        };
        let (label, _) = normalized_severity(&adv);
        assert_eq!(label, "HIGH");
    }

    #[test]
    fn severity_maps_medium_to_moderate() {
        let adv = Advisory {
            id: "GHSA-x".into(),
            aliases: vec![],
            summary: "".into(),
            published: None,
            modified: None,
            severity: vec![],
            database_specific: Some(DatabaseSpecific {
                severity: Some("medium".into()),
                cvss_score: None,
            }),
            affected: vec![],
        };
        let (label, _) = normalized_severity(&adv);
        assert_eq!(label, "MODERATE");
    }

    #[test]
    fn severity_unknown_when_no_signals() {
        let adv = Advisory {
            id: "GHSA-x".into(),
            aliases: vec![],
            summary: "".into(),
            published: None,
            modified: None,
            severity: vec![],
            database_specific: None,
            affected: vec![],
        };
        let (label, score) = normalized_severity(&adv);
        assert_eq!(label, "UNKNOWN");
        assert_eq!(score, None);
    }
}
