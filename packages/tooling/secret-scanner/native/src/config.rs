// Gitleaks-compatible config schema.
//
// The JS wrapper is responsible for loading configs from any format (TOML, JSON, YAML, JS, etc.)
// via c12. The native side only sees a deserialized object — this struct receives it through
// serde_json::from_value on the ScanOptions.config field.
// Reference: https://github.com/gitleaks/gitleaks/blob/master/config/config.go
#![allow(dead_code)]

use serde::Deserialize;

#[derive(Debug, Deserialize, Default, Clone)]
pub struct Config {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default, rename = "extend")]
    pub extend: Option<Extend>,
    #[serde(default, rename = "rules")]
    pub rules: Vec<RawRule>,
    #[serde(default, rename = "allowlist", alias = "allowlists")]
    pub allowlist: Allowlists,
}

#[derive(Debug, Deserialize, Default, Clone)]
pub struct Extend {
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default, rename = "useDefault")]
    pub use_default: Option<bool>,
    #[serde(default, rename = "disabledRules")]
    pub disabled_rules: Vec<String>,
}

#[derive(Debug, Deserialize, Default, Clone)]
pub struct RawRule {
    pub id: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub regex: Option<String>,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub entropy: Option<f32>,
    #[serde(default, rename = "secretGroup")]
    pub secret_group: Option<u32>,
    #[serde(default)]
    pub keywords: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    /// Higher wins when two rules match the same span. Default 0. Generic catch-all rules
    /// ship with priority `-1` so that specific rules always win the dedup pass.
    #[serde(default)]
    pub priority: Option<i32>,
    /// Ordered list of `(from, to)` regex replacements applied to the file content before
    /// the rule's own regex runs. Useful for normalising escape sequences / quote styles
    /// per rule without polluting the detector globally.
    #[serde(default, rename = "preRegexReplace")]
    pub pre_regex_replace: Vec<PreReplacement>,
    /// Provenance of the rule — "gitleaks", "kingfisher", "visulima", or user-defined.
    /// Surfaced on every finding via `Finding.source` for auditability.
    #[serde(default)]
    pub source: Option<String>,
    /// Author-declared match quality: "low" | "medium" | "high". Low bar by default so
    /// existing rules (which don't declare confidence) are not silently filtered out.
    /// Drives `min_confidence` gating at load and `Finding.confidence` at report time.
    #[serde(default)]
    pub confidence: Option<String>,
    /// Kingfisher-style cheap post-match filters. Applied after entropy, before allowlists.
    /// Cuts typical false-positive patterns (example/test placeholders, non-alphanum noise)
    /// without needing a full validator.
    #[serde(default, rename = "patternRequirements")]
    pub pattern_requirements: Option<RawPatternRequirements>,
    #[serde(default, rename = "allowlist", alias = "allowlists")]
    pub allowlist: Allowlists,
}

#[derive(Debug, Deserialize, Default, Clone)]
pub struct PreReplacement {
    pub from: String,
    #[serde(default)]
    pub to: String,
}

#[derive(Debug, Deserialize, Default, Clone)]
pub struct RawPatternRequirements {
    /// Minimum number of decimal digits in the captured secret. Cuts matches of pure
    /// alpha placeholders (`EXAMPLE`, `SECRET_KEY_HERE`) when a real secret always has
    /// at least one digit.
    #[serde(default, rename = "minDigits")]
    pub min_digits: Option<u32>,
    /// Minimum length (byte count) of the captured secret. Cheapest filter — runs first.
    #[serde(default, rename = "minLength")]
    pub min_length: Option<u32>,
    /// Minimum ASCII uppercase letters in the captured secret. Paired with `minLowercase`
    /// this enforces mixed-case structural shape on tokens where that is a defining trait.
    #[serde(default, rename = "minUppercase")]
    pub min_uppercase: Option<u32>,
    /// Minimum ASCII lowercase letters in the captured secret.
    #[serde(default, rename = "minLowercase")]
    pub min_lowercase: Option<u32>,
    /// Case-insensitive substrings that disqualify the match. Kingfisher ships this with
    /// terms like "EXAMPLE", "TEST", "YOUR_" — catching documentation placeholders.
    #[serde(default, rename = "ignoreIfContains")]
    pub ignore_if_contains: Vec<String>,
}

// gitleaks schema has a single top-level [allowlist] OR [[allowlists]] array, and the same
// inside rules. We accept both forms.
#[derive(Debug, Default, Clone)]
pub struct Allowlists(pub Vec<Allowlist>);

impl<'de> Deserialize<'de> for Allowlists {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum Inner {
            One(Allowlist),
            Many(Vec<Allowlist>),
        }
        match Option::<Inner>::deserialize(deserializer)? {
            None => Ok(Self(Vec::new())),
            Some(Inner::One(a)) => Ok(Self(vec![a])),
            Some(Inner::Many(v)) => Ok(Self(v)),
        }
    }
}

#[derive(Debug, Deserialize, Default, Clone)]
pub struct Allowlist {
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default, rename = "commits")]
    pub commits: Vec<String>,
    #[serde(default)]
    pub paths: Vec<String>,
    #[serde(default)]
    pub regexes: Vec<String>,
    #[serde(default)]
    pub stopwords: Vec<String>,
    #[serde(default, rename = "regexTarget")]
    pub regex_target: Option<String>,
    #[serde(default)]
    pub condition: Option<String>,
    /// Gitleaks `targetRules`: when present, the allowlist only applies to findings whose
    /// rule id appears in the list. An empty list (the default) means "applies to all".
    #[serde(default, rename = "targetRules")]
    pub target_rules: Vec<String>,
}
