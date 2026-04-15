// Compiled rule model. Raw TOML -> compiled regexes + aho-corasick prefilter.

use aho_corasick::{AhoCorasick, AhoCorasickKind, MatchKind};
use fancy_regex::Regex;

use crate::config::{Allowlist, Config, RawRule};

#[derive(Debug)]
pub struct CompiledRule {
    pub id: String,
    pub description: String,
    pub regex: Option<Regex>,
    pub path_regex: Option<Regex>,
    pub entropy: Option<f32>,
    pub secret_group: u32,
    pub keywords_lower: Vec<String>,
    pub tags: Vec<String>,
    pub allowlists: Vec<CompiledAllowlist>,
}

#[derive(Debug)]
pub struct CompiledAllowlist {
    pub paths: Vec<Regex>,
    pub regexes: Vec<Regex>,
    pub stopwords_lower: Vec<String>,
    pub regex_target: AllowlistTarget,
    /// true = OR (any match allows), false = AND (all must match). gitleaks default is OR.
    pub condition_and: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AllowlistTarget {
    Match,
    Secret,
    Line,
}

#[derive(Debug)]
pub struct CompiledRuleset {
    pub rules: Vec<CompiledRule>,
    /// Global keyword prefilter across all rules. Match indexes are rule indexes.
    pub keyword_ac: Option<AhoCorasick>,
    /// For each keyword pattern id -> rule index
    pub keyword_to_rule: Vec<usize>,
    /// Global allowlist applied to every finding
    pub global_allowlists: Vec<CompiledAllowlist>,
    /// Rules that failed to compile (id -> reason). Kept for diagnostics.
    pub skipped_rules: Vec<(String, String)>,
}

#[derive(Debug, thiserror::Error)]
pub enum CompileError {
    #[error("invalid regex in rule '{0}': {1}")]
    InvalidRuleRegex(String, String),
    #[error("invalid path regex in rule '{0}': {1}")]
    InvalidPathRegex(String, String),
    #[error("invalid allowlist regex in rule '{0}': {1}")]
    InvalidAllowlistRegex(String, String),
    #[error("invalid allowlist path regex: {0}")]
    InvalidAllowlistPath(String),
    #[error("aho-corasick build failed: {0}")]
    Ac(String),
}

fn build_regex(pattern: &str) -> Result<Regex, Box<fancy_regex::Error>> {
    // Gitleaks patterns are PCRE-flavored. fancy-regex accepts the full syntax
    // verbatim (including `{{literal}}` and lookarounds for future third-party
    // rulesets) while delegating to `regex` internally for patterns that don't
    // need extended features — so the performance cost over plain `regex` is
    // near zero for gitleaks' default ruleset.
    //
    // fancy_regex::Error is large (~136 bytes); boxing keeps Result small.
    Regex::new(pattern).map_err(Box::new)
}

fn compile_allowlists(rule_id: &str, lists: &[Allowlist]) -> Result<Vec<CompiledAllowlist>, CompileError> {
    let mut out = Vec::with_capacity(lists.len());
    for a in lists {
        let paths = a
            .paths
            .iter()
            .map(|p| build_regex(p).map_err(|e| CompileError::InvalidAllowlistPath(e.to_string())))
            .collect::<Result<Vec<_>, _>>()?;
        let regexes = a
            .regexes
            .iter()
            .map(|r| {
                build_regex(r).map_err(|e| CompileError::InvalidAllowlistRegex(rule_id.to_string(), e.to_string()))
            })
            .collect::<Result<Vec<_>, _>>()?;
        let regex_target = match a.regex_target.as_deref() {
            Some("match") => AllowlistTarget::Match,
            Some("line") => AllowlistTarget::Line,
            _ => AllowlistTarget::Secret, // gitleaks default
        };
        let condition_and = matches!(a.condition.as_deref(), Some("AND") | Some("and"));
        out.push(CompiledAllowlist {
            paths,
            regexes,
            stopwords_lower: a.stopwords.iter().map(|s| s.to_lowercase()).collect(),
            regex_target,
            condition_and,
        });
    }
    Ok(out)
}

impl CompiledRuleset {
    pub fn compile(cfg: &Config) -> Result<Self, CompileError> {
        let mut rules: Vec<CompiledRule> = Vec::with_capacity(cfg.rules.len());
        let mut skipped: Vec<(String, String)> = Vec::new();
        for raw in &cfg.rules {
            match compile_rule(raw) {
                Ok(r) => rules.push(r),
                Err(e) => skipped.push((raw.id.clone(), e.to_string())),
            }
        }

        // Build global keyword AC
        let mut patterns: Vec<String> = Vec::new();
        let mut keyword_to_rule: Vec<usize> = Vec::new();
        for (i, r) in rules.iter().enumerate() {
            for k in &r.keywords_lower {
                patterns.push(k.clone());
                keyword_to_rule.push(i);
            }
        }
        let keyword_ac = if patterns.is_empty() {
            None
        } else {
            Some(
                AhoCorasick::builder()
                    .kind(Some(AhoCorasickKind::DFA))
                    .match_kind(MatchKind::Standard)
                    .ascii_case_insensitive(true)
                    .build(&patterns)
                    .map_err(|e| CompileError::Ac(e.to_string()))?,
            )
        };

        let global_allowlists = compile_allowlists("__global__", &cfg.allowlist.0)?;

        Ok(Self { rules, keyword_ac, keyword_to_rule, global_allowlists, skipped_rules: skipped })
    }
}

fn compile_rule(raw: &RawRule) -> Result<CompiledRule, CompileError> {
    let regex = raw
        .regex
        .as_ref()
        .map(|p| build_regex(p).map_err(|e| CompileError::InvalidRuleRegex(raw.id.clone(), e.to_string())))
        .transpose()?;
    let path_regex = raw
        .path
        .as_ref()
        .map(|p| build_regex(p).map_err(|e| CompileError::InvalidPathRegex(raw.id.clone(), e.to_string())))
        .transpose()?;

    let allowlists = compile_allowlists(&raw.id, &raw.allowlist.0)?;

    Ok(CompiledRule {
        id: raw.id.clone(),
        description: raw.description.clone().unwrap_or_default(),
        regex,
        path_regex,
        entropy: raw.entropy,
        secret_group: raw.secret_group.unwrap_or(0),
        keywords_lower: raw.keywords.iter().map(|k| k.to_lowercase()).collect(),
        tags: raw.tags.clone(),
        allowlists,
    })
}
