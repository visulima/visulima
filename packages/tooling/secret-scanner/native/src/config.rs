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
    #[serde(default, rename = "allowlist", alias = "allowlists")]
    pub allowlist: Allowlists,
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
}
