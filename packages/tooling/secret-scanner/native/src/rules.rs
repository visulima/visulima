// Compiled rule model. Raw TOML -> compiled regexes + aho-corasick prefilter.

use aho_corasick::{AhoCorasick, AhoCorasickKind, MatchKind};
use fancy_regex::Regex;
use regex::bytes::{Regex as BytesRegex, RegexSet, RegexSetBuilder};

use crate::config::{Allowlist, Config, RawPatternRequirements, RawRule};

/// Regex backend chosen at compile time. `Fast` is the stock `regex` crate
/// (guaranteed-linear DFA, no lookaround/backrefs) — we always probe this
/// first because Fast rules participate in the global `RegexSet` prefilter
/// and skip the per-candidate iteration when the file clearly doesn't match.
/// `Fancy` is the fallback for patterns that need PCRE features.
#[derive(Debug)]
pub enum Engine {
    Fast(BytesRegex),
    Fancy(Regex),
}

impl Engine {
    /// `true` when this rule participates in the global `RegexSet` prefilter.
    pub fn is_fast(&self) -> bool {
        matches!(self, Self::Fast(_))
    }
}

/// Upper bounds for the stock `regex` crate. Keep these generous — hitting the
/// `size_limit` while compiling a single rule drops it to the Fancy engine
/// (functional fallback); hitting `dfa_size_limit` on the RegexSet drops the
/// whole prefilter and we fall back to AC-only (still correct, just slower).
///
/// The DFA budget scales with `Σ rule NFA states`. At 1,000+ patterns the
/// default 10 MB is too tight; 64 MB buys comfortable headroom. A release
/// build's `CompiledRuleset` holds one of these per process, so the memory
/// cost is paid once per scanner instance.
const REGEX_SIZE_LIMIT: usize = 10 << 20;
const REGEX_SET_DFA_SIZE_LIMIT: usize = 64 << 20;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Confidence {
    Low,
    Medium,
    High,
}

impl Confidence {
    pub fn parse(s: &str) -> Option<Self> {
        match s.to_ascii_lowercase().as_str() {
            "low" => Some(Self::Low),
            "medium" | "med" => Some(Self::Medium),
            "high" => Some(Self::High),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Low => "low",
            Self::Medium => "medium",
            Self::High => "high",
        }
    }
}

impl Default for Confidence {
    fn default() -> Self {
        // Rules that don't declare confidence keep their historical behaviour — never
        // filtered by `min_confidence`. Any explicit user floor (e.g. `--min-confidence
        // medium`) drops the unlabeled rules, which is the point.
        Self::Low
    }
}

#[derive(Debug)]
pub struct CompiledPatternRequirements {
    pub min_digits: Option<u32>,
    pub min_length: Option<u32>,
    pub min_uppercase: Option<u32>,
    pub min_lowercase: Option<u32>,
    /// Lower-cased substrings; a case-insensitive `contains` against the captured secret.
    /// Kept as `Vec<String>` — ignore lists are typically ≤4 items, making AC overhead
    /// a net loss.
    pub ignore_if_contains_lower: Vec<String>,
}

impl CompiledPatternRequirements {
    fn from_raw(raw: &RawPatternRequirements) -> Option<Self> {
        let ignore_if_contains_lower: Vec<String> =
            raw.ignore_if_contains.iter().filter(|s| !s.is_empty()).map(|s| s.to_lowercase()).collect();

        if raw.min_digits.is_none()
            && raw.min_length.is_none()
            && raw.min_uppercase.is_none()
            && raw.min_lowercase.is_none()
            && ignore_if_contains_lower.is_empty()
        {
            return None;
        }

        Some(Self {
            min_digits: raw.min_digits,
            min_length: raw.min_length,
            min_uppercase: raw.min_uppercase,
            min_lowercase: raw.min_lowercase,
            ignore_if_contains_lower,
        })
    }
}

#[derive(Debug)]
pub struct CompiledRule {
    pub id: String,
    pub description: String,
    pub engine: Option<Engine>,
    pub path_regex: Option<Regex>,
    pub entropy: Option<f32>,
    pub secret_group: u32,
    pub keywords_lower: Vec<String>,
    pub tags: Vec<String>,
    pub priority: i32,
    pub pre_regex_replace: Vec<(Regex, String)>,
    pub source: Option<String>,
    pub confidence: Confidence,
    pub pattern_requirements: Option<CompiledPatternRequirements>,
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
    /// Empty = applies to every rule. Non-empty = only applies when the current rule id
    /// is in this set (gitleaks `targetRules`).
    pub target_rules: Vec<String>,
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
    /// Second-stage prefilter over every `Engine::Fast` rule. `None` when the set
    /// would overflow `dfa_size_limit` or contained no Fast rules — the detector
    /// falls back to AC-only candidate selection. When `Some`, a Fast rule is
    /// only active when *both* AC and the RegexSet flag it.
    pub regex_set: Option<RegexSet>,
    /// Maps a `regex_set` pattern index back to the `rules` index it belongs to.
    pub regex_set_pattern_to_rule: Vec<usize>,
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

/// Probe-compile a rule's main pattern. We try the stock `regex` crate first
/// — patterns that compile there run faster *and* participate in the global
/// `RegexSet` prefilter. Patterns using lookaround / backrefs fall back to
/// `fancy_regex`; they work correctly, just without the RegexSet benefit.
fn build_engine(pattern: &str, rule_id: &str) -> Result<Engine, CompileError> {
    match regex::bytes::RegexBuilder::new(pattern).size_limit(REGEX_SIZE_LIMIT).build() {
        Ok(re) => Ok(Engine::Fast(re)),
        Err(_) => match build_regex(pattern) {
            Ok(re) => Ok(Engine::Fancy(re)),
            Err(e) => Err(CompileError::InvalidRuleRegex(rule_id.to_string(), e.to_string())),
        },
    }
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
            target_rules: a.target_rules.clone(),
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

        // Global RegexSet over every `Engine::Fast` rule — re-uses each rule's source
        // pattern (not the compiled `regex::bytes::Regex`) so we get the stock `regex`
        // crate's DFA union. Patterns that couldn't build a Fast engine (lookaround,
        // backrefs) are *not* in the set; the detector keeps them on AC-only selection.
        //
        // We intentionally rebuild from the raw `cfg.rules` pattern here rather than
        // storing a separate copy: the raw config is the authoritative source, and the
        // set is a prefilter — its hit bitmap tells us *which rule* to run, never what
        // to extract.
        let mut set_patterns: Vec<String> = Vec::new();
        let mut regex_set_pattern_to_rule: Vec<usize> = Vec::new();

        for (i, rule) in rules.iter().enumerate() {
            if let (Some(raw), true) = (cfg.rules.iter().find(|r| r.id == rule.id), rule.engine.as_ref().is_some_and(Engine::is_fast)) {
                if let Some(pattern) = raw.regex.as_ref() {
                    set_patterns.push(pattern.clone());
                    regex_set_pattern_to_rule.push(i);
                }
            }
        }

        let regex_set = if set_patterns.is_empty() {
            None
        } else {
            match RegexSetBuilder::new(&set_patterns)
                .size_limit(REGEX_SIZE_LIMIT)
                .dfa_size_limit(REGEX_SET_DFA_SIZE_LIMIT)
                .build()
            {
                Ok(set) => Some(set),
                Err(_) => {
                    // The individual rules still work — we just lose the second-stage
                    // prefilter. Clear the mapping so the detector falls back cleanly.
                    regex_set_pattern_to_rule.clear();
                    None
                }
            }
        };

        Ok(Self {
            rules,
            keyword_ac,
            keyword_to_rule,
            regex_set,
            regex_set_pattern_to_rule,
            global_allowlists,
            skipped_rules: skipped,
        })
    }
}

fn compile_rule(raw: &RawRule) -> Result<CompiledRule, CompileError> {
    let engine = raw.regex.as_ref().map(|p| build_engine(p, &raw.id)).transpose()?;
    let path_regex = raw
        .path
        .as_ref()
        .map(|p| build_regex(p).map_err(|e| CompileError::InvalidPathRegex(raw.id.clone(), e.to_string())))
        .transpose()?;

    let allowlists = compile_allowlists(&raw.id, &raw.allowlist.0)?;

    let pre_regex_replace = raw
        .pre_regex_replace
        .iter()
        .map(|r| {
            build_regex(&r.from)
                .map(|re| (re, r.to.clone()))
                .map_err(|e| CompileError::InvalidRuleRegex(raw.id.clone(), e.to_string()))
        })
        .collect::<Result<Vec<_>, _>>()?;

    let confidence = raw
        .confidence
        .as_deref()
        .and_then(Confidence::parse)
        .unwrap_or_default();

    let pattern_requirements = raw
        .pattern_requirements
        .as_ref()
        .and_then(CompiledPatternRequirements::from_raw);

    Ok(CompiledRule {
        id: raw.id.clone(),
        description: raw.description.clone().unwrap_or_default(),
        engine,
        path_regex,
        entropy: raw.entropy,
        secret_group: raw.secret_group.unwrap_or(0),
        keywords_lower: raw.keywords.iter().map(|k| k.to_lowercase()).collect(),
        tags: raw.tags.clone(),
        priority: raw.priority.unwrap_or(0),
        pre_regex_replace,
        source: raw.source.clone(),
        confidence,
        pattern_requirements,
        allowlists,
    })
}
