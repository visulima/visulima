#![deny(clippy::all)]

mod config;
mod detector;
mod entropy;
mod rules;
mod scanner;
mod walker;

use std::path::PathBuf;
use std::sync::Arc;

use napi::bindgen_prelude::*;
use napi_derive::napi;
use rayon::prelude::*;

use crate::config::Config;
use crate::detector::RawFinding;
use crate::rules::CompiledRuleset;
use crate::scanner::scan_file;
use crate::walker::{walk_paths, WalkOptions};

const DEFAULT_MAX_FILE_SIZE: u32 = 10 * 1024 * 1024; // 10 MiB
const MAX_CONFIG_SIZE: u64 = 16 * 1024 * 1024; // 16 MiB

#[napi(object)]
#[derive(Default)]
pub struct ScanOptions {
    /// Path to a gitleaks-compatible TOML config. If omitted, the caller is expected
    /// to provide `configToml`, otherwise no rules are loaded.
    pub config_path: Option<String>,
    /// Raw TOML rule string (used as-is, no file IO).
    pub config_toml: Option<String>,
    /// Respect .gitignore / .ignore (default: true)
    pub respect_gitignore: Option<bool>,
    /// Visit dotfiles (default: false — matches ignore crate default)
    pub include_hidden: Option<bool>,
    /// Extra glob patterns to exclude (rooted at each scan root)
    pub extra_ignores: Option<Vec<String>>,
    /// Max file size in bytes (default 10 MiB). Files above are skipped.
    pub max_file_size: Option<u32>,
    /// Redact secret values in output (default: false)
    pub redact: Option<bool>,
    /// Number of rayon worker threads. 0/omitted = use rayon's global pool.
    pub concurrency: Option<u32>,
}

#[napi(object)]
pub struct Finding {
    pub rule_id: String,
    pub description: String,
    pub file: String,
    pub start_line: u32,
    pub end_line: u32,
    pub start_column: u32,
    pub end_column: u32,
    pub r#match: String,
    pub secret: String,
    pub entropy: f64,
    pub tags: Vec<String>,
}

#[napi(object)]
pub struct SkippedRule {
    pub rule_id: String,
    pub reason: String,
}

#[napi(object)]
pub struct RuleInfo {
    pub id: String,
    pub description: String,
    pub tags: Vec<String>,
    pub keywords: Vec<String>,
    pub entropy: Option<f64>,
    pub has_regex: bool,
    pub has_path_filter: bool,
}

fn redact(s: &str) -> String {
    if s.len() <= 6 {
        return "******".into();
    }
    let mut out = String::with_capacity(s.len());
    out.push_str(&s[..3]);
    for _ in 0..(s.len() - 6) {
        out.push('*');
    }
    out.push_str(&s[s.len() - 3..]);
    out
}

fn to_napi_finding(f: RawFinding, redact_secrets: bool) -> Finding {
    Finding {
        rule_id: f.rule_id,
        description: f.description,
        file: f.file,
        start_line: f.start_line,
        end_line: f.end_line,
        start_column: f.start_column,
        end_column: f.end_column,
        r#match: if redact_secrets { redact(&f.r#match) } else { f.r#match },
        secret: if redact_secrets { redact(&f.secret) } else { f.secret },
        entropy: f.entropy as f64,
        tags: f.tags,
    }
}

fn load_ruleset(opts: &ScanOptions) -> Result<Arc<CompiledRuleset>> {
    let toml_str = if let Some(s) = &opts.config_toml {
        s.clone()
    } else if let Some(p) = &opts.config_path {
        let meta = std::fs::metadata(p).map_err(|e| Error::from_reason(format!("stat config: {e}")))?;
        if meta.len() > MAX_CONFIG_SIZE {
            return Err(Error::from_reason(format!("config file larger than {MAX_CONFIG_SIZE} bytes")));
        }
        std::fs::read_to_string(p).map_err(|e| Error::from_reason(format!("read config: {e}")))?
    } else {
        return Err(Error::from_reason("ScanOptions requires `configPath` or `configToml`"));
    };
    let cfg = Config::from_toml_str(&toml_str).map_err(|e| Error::from_reason(format!("parse config: {e}")))?;
    let ruleset = CompiledRuleset::compile(&cfg).map_err(|e| Error::from_reason(format!("compile rules: {e}")))?;
    Ok(Arc::new(ruleset))
}

fn scan_impl(paths: Vec<String>, opts: ScanOptions) -> Result<Vec<Finding>> {
    let roots: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
    if roots.is_empty() {
        return Ok(Vec::new());
    }
    let ruleset = load_ruleset(&opts)?;
    let max_bytes = opts.max_file_size.unwrap_or(DEFAULT_MAX_FILE_SIZE) as u64;
    let redact_secrets = opts.redact.unwrap_or(false);
    let concurrency = opts.concurrency.unwrap_or(0) as usize;

    let walk_opts = WalkOptions {
        respect_gitignore: opts.respect_gitignore.unwrap_or(true),
        respect_hidden: !opts.include_hidden.unwrap_or(false),
        extra_ignores: opts.extra_ignores.unwrap_or_default(),
        threads: concurrency,
    };

    let files = walk_paths(&roots, &walk_opts);

    let do_scan = || -> Vec<RawFinding> {
        files
            .par_iter()
            .flat_map_iter(|p| match scan_file(p, &ruleset, max_bytes) {
                Ok(Some(v)) => v.into_iter(),
                _ => Vec::new().into_iter(),
            })
            .collect()
    };

    let mut findings: Vec<RawFinding> = if concurrency == 0 {
        // Use rayon's global pool — no per-call pool construction.
        do_scan()
    } else {
        let pool = rayon::ThreadPoolBuilder::new()
            .num_threads(concurrency)
            .build()
            .map_err(|e| Error::from_reason(format!("thread pool: {e}")))?;
        pool.install(do_scan)
    };

    // Deterministic output order
    findings.sort_by(|a, b| {
        (&a.file, a.start_line, a.start_column, &a.rule_id).cmp(&(&b.file, b.start_line, b.start_column, &b.rule_id))
    });

    Ok(findings.into_iter().map(|f| to_napi_finding(f, redact_secrets)).collect())
}

#[napi]
pub async fn scan(paths: Vec<String>, options: Option<ScanOptions>) -> Result<Vec<Finding>> {
    let opts = options.unwrap_or_default();
    tokio::task::spawn_blocking(move || scan_impl(paths, opts))
        .await
        .map_err(|e| Error::from_reason(format!("join: {e}")))?
}

#[napi]
pub fn scan_sync(paths: Vec<String>, options: Option<ScanOptions>) -> Result<Vec<Finding>> {
    scan_impl(paths, options.unwrap_or_default())
}

#[napi]
pub fn scan_text_sync(content: String, file: String, options: Option<ScanOptions>) -> Result<Vec<Finding>> {
    let opts = options.unwrap_or_default();
    let redact_secrets = opts.redact.unwrap_or(false);
    let ruleset = load_ruleset(&opts)?;
    let path = PathBuf::from(&file);
    let mut raw = crate::detector::scan_text(&ruleset, &path, &content);
    raw.sort_by(|a, b| (a.start_line, a.start_column, &a.rule_id).cmp(&(b.start_line, b.start_column, &b.rule_id)));
    Ok(raw.into_iter().map(|f| to_napi_finding(f, redact_secrets)).collect())
}

/// Compile a ruleset and return rules that failed to compile, with their reason.
/// Useful for tooling that wants to validate a custom gitleaks.toml.
#[napi]
pub fn inspect_ruleset(options: Option<ScanOptions>) -> Result<Vec<SkippedRule>> {
    let ruleset = load_ruleset(&options.unwrap_or_default())?;
    Ok(ruleset
        .skipped_rules
        .iter()
        .map(|(id, reason)| SkippedRule { rule_id: id.clone(), reason: reason.clone() })
        .collect())
}

/// Return metadata for every rule compiled from the config.
#[napi]
pub fn list_rules(options: Option<ScanOptions>) -> Result<Vec<RuleInfo>> {
    let ruleset = load_ruleset(&options.unwrap_or_default())?;
    Ok(ruleset
        .rules
        .iter()
        .map(|rule| RuleInfo {
            id: rule.id.clone(),
            description: rule.description.clone(),
            tags: rule.tags.clone(),
            keywords: rule.keywords_lower.clone(),
            entropy: rule.entropy.map(|e| e as f64),
            has_regex: rule.regex.is_some(),
            has_path_filter: rule.path_regex.is_some(),
        })
        .collect())
}

/// Scan a fixed list of files (e.g. from `git diff --name-only`). Bypasses the walker.
#[napi]
pub async fn scan_files(files: Vec<String>, options: Option<ScanOptions>) -> Result<Vec<Finding>> {
    let opts = options.unwrap_or_default();
    tokio::task::spawn_blocking(move || scan_files_impl(files, opts))
        .await
        .map_err(|e| Error::from_reason(format!("join: {e}")))?
}

fn scan_files_impl(files: Vec<String>, opts: ScanOptions) -> Result<Vec<Finding>> {
    if files.is_empty() {
        return Ok(Vec::new());
    }
    let ruleset = load_ruleset(&opts)?;
    let max_bytes = opts.max_file_size.unwrap_or(DEFAULT_MAX_FILE_SIZE) as u64;
    let redact_secrets = opts.redact.unwrap_or(false);
    let concurrency = opts.concurrency.unwrap_or(0) as usize;

    let paths: Vec<PathBuf> = files.into_iter().map(PathBuf::from).collect();

    let do_scan = || -> Vec<RawFinding> {
        paths
            .par_iter()
            .flat_map_iter(|p| match scan_file(p, &ruleset, max_bytes) {
                Ok(Some(v)) => v.into_iter(),
                _ => Vec::new().into_iter(),
            })
            .collect()
    };

    let mut findings: Vec<RawFinding> = if concurrency == 0 {
        do_scan()
    } else {
        let pool = rayon::ThreadPoolBuilder::new()
            .num_threads(concurrency)
            .build()
            .map_err(|e| Error::from_reason(format!("thread pool: {e}")))?;
        pool.install(do_scan)
    };

    findings.sort_by(|a, b| {
        (&a.file, a.start_line, a.start_column, &a.rule_id).cmp(&(&b.file, b.start_line, b.start_column, &b.rule_id))
    });

    Ok(findings.into_iter().map(|f| to_napi_finding(f, redact_secrets)).collect())
}
