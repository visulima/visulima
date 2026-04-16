#![deny(clippy::all)]

mod config;
mod detector;
mod entropy;
mod rules;
mod scanner;
mod walker;

use std::collections::VecDeque;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use napi::bindgen_prelude::*;
use napi_derive::napi;
use once_cell::sync::Lazy;
use rayon::prelude::*;

use crate::config::Config;
use crate::detector::RawFinding;
use crate::rules::{CompiledRuleset, Confidence};
use crate::scanner::scan_file;
use crate::walker::{walk_paths, WalkOptions};

/// Capacity of the compiled-ruleset cache. Four is enough to cover the
/// common matrix: `gitleaks` vs `kingfisher` vs `combined` × optional
/// `min_confidence` / user preset layering.
const RULESET_CACHE_CAPACITY: usize = 4;

/// FIFO cache keyed by a content hash of `(config JSON, min_confidence)`.
/// Eliminates the per-scan 5-9s compile cost when the same config is reused
/// across `scan()` / `scanFiles()` / `listRules()` / repeat CLI invocations
/// within the same process. FIFO is sufficient at cap 4; a true LRU would
/// need an extra dep without measurable benefit at this size.
static RULESET_CACHE: Lazy<Mutex<VecDeque<(u64, Arc<CompiledRuleset>)>>> =
    Lazy::new(|| Mutex::new(VecDeque::with_capacity(RULESET_CACHE_CAPACITY)));

fn hash_ruleset_key(value: &serde_json::Value, min_confidence: Option<&str>) -> u64 {
    let mut hasher = DefaultHasher::new();

    // `serde_json::to_vec` preserves object-key insertion order — for a given
    // source JSON (our `data/*.json` or a user-supplied file), the hash is
    // stable across calls. A user who hand-builds the config object and
    // shuffles keys between calls will miss the cache; that's the exact
    // right behaviour (different inputs → different hash).
    if let Ok(bytes) = serde_json::to_vec(value) {
        bytes.hash(&mut hasher);
    }

    min_confidence.unwrap_or("").hash(&mut hasher);
    hasher.finish()
}

const DEFAULT_MAX_FILE_SIZE: u32 = 10 * 1024 * 1024; // 10 MiB

#[napi(object)]
#[derive(Default)]
pub struct ScanOptions {
    /// Parsed config object (gitleaks-compatible shape). The JS wrapper is responsible
    /// for loading from any format (TOML/JSON/YAML/TS/JS) via c12 and passing the result
    /// here. If absent, no rules are loaded and every scan returns an empty result.
    pub config: Option<serde_json::Value>,
    /// Respect .gitignore / .ignore (default: true)
    pub respect_gitignore: Option<bool>,
    /// Visit dotfiles (default: false — matches ignore crate default)
    pub include_hidden: Option<bool>,
    /// Extra gitignore-syntax patterns to exclude (negation, directory markers, etc. all work).
    pub extra_ignores: Option<Vec<String>>,
    /// Paths to additional `.gitignore`-syntax files to honor (beyond the walker's default
    /// `.gitignore` / `.git/info/exclude` pickup). Useful for `.secretsignore` etc.
    pub ignore_files: Option<Vec<String>>,
    /// Max file size in bytes (default 10 MiB). Files above are skipped.
    pub max_file_size: Option<u32>,
    /// Redact secret values in output (default: false)
    pub redact: Option<bool>,
    /// Number of rayon worker threads. 0/omitted = use rayon's global pool.
    pub concurrency: Option<u32>,
    /// Minimum author-declared confidence required for a rule to load. Accepts
    /// "low" | "medium" | "high". Unset (or "low") loads every rule — matching
    /// legacy behaviour. Rules with no declared confidence are treated as "low"
    /// and so are dropped whenever a higher floor is set.
    pub min_confidence: Option<String>,
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
    /// Rule provenance — `"gitleaks"`, `"kingfisher"`, `"visulima"`, or a user string.
    /// `None` for legacy rules that don't declare a source.
    pub source: Option<String>,
    /// Author-declared quality signal: `"low"`, `"medium"`, or `"high"`. Always set —
    /// rules that don't declare confidence resolve to `"low"`.
    pub confidence: String,
    /// Rule ids that matched the same byte span and were collapsed by the dedup
    /// pass. Lets reporters surface "also: X, Y" without emitting duplicate findings.
    pub alternate_matches: Vec<String>,
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
    /// `true` when the rule has no `keywords` and therefore bypasses the AC prefilter —
    /// its main regex runs against every file. Surface this in tooling so users can spot
    /// perf-regressing custom rules (#1675).
    pub always_runs: bool,
    pub source: Option<String>,
    pub confidence: String,
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
        source: f.source,
        confidence: f.confidence.to_string(),
        alternate_matches: f.alternate_matches,
    }
}

fn load_ruleset(opts: &ScanOptions) -> Result<Arc<CompiledRuleset>> {
    let Some(value) = opts.config.as_ref() else {
        return Err(Error::from_reason("ScanOptions.config is required (pass a parsed gitleaks-shaped object)"));
    };

    let min_conf_str = opts.min_confidence.as_deref();
    let cache_key = hash_ruleset_key(value, min_conf_str);

    if let Ok(cache) = RULESET_CACHE.lock() {
        if let Some((_, arc)) = cache.iter().find(|(k, _)| *k == cache_key) {
            return Ok(Arc::clone(arc));
        }
    }

    let mut cfg: Config =
        serde_json::from_value(value.clone()).map_err(|e| Error::from_reason(format!("config shape: {e}")))?;

    if let Some(floor) = min_conf_str {
        let floor = Confidence::parse(floor).ok_or_else(|| {
            Error::from_reason(format!(
                "min_confidence must be one of 'low' | 'medium' | 'high', got {floor:?}"
            ))
        })?;

        cfg.rules.retain(|raw| {
            raw.confidence
                .as_deref()
                .and_then(Confidence::parse)
                .unwrap_or_default()
                >= floor
        });
    }

    let ruleset = CompiledRuleset::compile(&cfg).map_err(|e| Error::from_reason(format!("compile rules: {e}")))?;
    let arc = Arc::new(ruleset);

    if let Ok(mut cache) = RULESET_CACHE.lock() {
        // Race-tolerant: another thread may have inserted the same key while we
        // were compiling. Duplicate entries waste a slot but don't affect
        // correctness — keep the first one and drop the newcomer.
        if !cache.iter().any(|(k, _)| *k == cache_key) {
            cache.push_back((cache_key, Arc::clone(&arc)));
            while cache.len() > RULESET_CACHE_CAPACITY {
                cache.pop_front();
            }
        }
    }

    Ok(arc)
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
        extra_ignores: opts.extra_ignores.clone().unwrap_or_default(),
        ignore_files: opts.ignore_files.clone().unwrap_or_default().into_iter().map(PathBuf::from).collect(),
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

    let findings: Vec<RawFinding> = if concurrency == 0 {
        // Use rayon's global pool — no per-call pool construction.
        do_scan()
    } else {
        let pool = rayon::ThreadPoolBuilder::new()
            .num_threads(concurrency)
            .build()
            .map_err(|e| Error::from_reason(format!("thread pool: {e}")))?;
        pool.install(do_scan)
    };

    let findings = finalize_findings(findings, &roots);
    Ok(findings.into_iter().map(|f| to_napi_finding(f, redact_secrets)).collect())
}

/// Post-process raw findings: relative paths, priority-based span dedup, exact-duplicate
/// collapse, stable ordering. Used by both `scan()` and `scanFiles()`.
fn finalize_findings(mut findings: Vec<RawFinding>, roots: &[PathBuf]) -> Vec<RawFinding> {
    // #1059 — rewrite `file` relative to the nearest root so baselines are portable across cwd.
    // `scan_text_sync` passes `&[]` and opts out of the rewrite (in-memory scan has no root).
    if !roots.is_empty() {
        let canon_roots = canonicalize_roots(roots);
        for f in &mut findings {
            if let Some(rel) = relative_to_root(&f.file, &canon_roots) {
                f.file = rel;
            }
        }
    }

    // Sort so findings at the same span sit next to each other: then we can dedup + apply
    // priority in a single linear pass.
    findings.sort_by(|a, b| {
        (&a.file, a.start_line, a.start_column, a.start_offset, a.end_offset, std::cmp::Reverse(a.priority), &a.rule_id)
            .cmp(&(
                &b.file,
                b.start_line,
                b.start_column,
                b.start_offset,
                b.end_offset,
                std::cmp::Reverse(b.priority),
                &b.rule_id,
            ))
    });

    // #1054 — collapse exact duplicates (same file + rule + position + secret).
    findings.dedup_by(|a, b| {
        a.file == b.file
            && a.rule_id == b.rule_id
            && a.start_line == b.start_line
            && a.start_column == b.start_column
            && a.end_line == b.end_line
            && a.end_column == b.end_column
            && a.secret == b.secret
    });

    // #1567 / #1997 — when two rules match the **same byte span** on the same file, keep the
    // highest-priority finding. Ties fall back to deterministic rule-id order (already sorted).
    //
    // Behavioural note: different rules extracting different `secretGroup` slices from the
    // same whole-match span collapse to one finding (the higher-priority rule wins). This is
    // intentional — one span = one leak — but it means documenting a specific-over-generic
    // preference is the right way to model priority for custom rules.
    //
    // Path-only findings all emit offsets (0, 0) as a sentinel; we skip the span-dedup for
    // them so two different path-only rules on the same file can coexist (they represent
    // different file-level concerns — e.g. `keepass-kdbx-file` + `password-manager-export-path`).
    let mut deduped: Vec<RawFinding> = Vec::with_capacity(findings.len());
    for f in findings {
        let is_path_only = f.start_offset == 0 && f.end_offset == 0;
        if let Some(last) = deduped.last_mut() {
            if !is_path_only
                && last.file == f.file
                && last.start_offset == f.start_offset
                && last.end_offset == f.end_offset
            {
                // Same span — the sort put the highest priority first. Record the
                // dropped rule on the winner so reporters can show "also: id1, id2".
                if last.rule_id != f.rule_id && !last.alternate_matches.contains(&f.rule_id) {
                    last.alternate_matches.push(f.rule_id);
                }
                continue;
            }
        }
        deduped.push(f);
    }
    deduped
}

/// Canonicalise each root and sort by descending path length so `relative_to_root` picks
/// the deepest-matching root first (e.g. with roots `/a` and `/a/b`, a file under `/a/b/c`
/// strips against `/a/b` → `c`, not `/a` → `b/c`).
fn canonicalize_roots(roots: &[PathBuf]) -> Vec<PathBuf> {
    let mut canon: Vec<PathBuf> =
        roots.iter().map(|r| r.canonicalize().unwrap_or_else(|_| r.clone())).collect();
    canon.sort_by_key(|p| std::cmp::Reverse(p.as_os_str().len()));
    canon
}

fn relative_to_root(file: &str, roots: &[PathBuf]) -> Option<String> {
    let file_path = PathBuf::from(file);
    let file_canon = file_path.canonicalize().unwrap_or(file_path);
    for root in roots {
        if let Ok(stripped) = file_canon.strip_prefix(root) {
            let s = stripped.to_string_lossy();
            // Normalise separators so baselines are identical across platforms.
            let out = s.replace('\\', "/");
            return Some(out);
        }
    }
    None
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
    let raw = crate::detector::scan_text(&ruleset, &path, &content);
    // In-memory scan — no filesystem root, so just dedup + priority (no path rewriting).
    let finalized = finalize_findings(raw, &[]);
    Ok(finalized.into_iter().map(|f| to_napi_finding(f, redact_secrets)).collect())
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
            has_regex: rule.engine.is_some(),
            has_path_filter: rule.path_regex.is_some(),
            always_runs: rule.keywords_lower.is_empty(),
            source: rule.source.clone(),
            confidence: rule.confidence.as_str().to_string(),
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

    let findings: Vec<RawFinding> = if concurrency == 0 {
        do_scan()
    } else {
        let pool = rayon::ThreadPoolBuilder::new()
            .num_threads(concurrency)
            .build()
            .map_err(|e| Error::from_reason(format!("thread pool: {e}")))?;
        pool.install(do_scan)
    };

    // Walker is bypassed here — use cwd as the root so paths normalise relative to it.
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let findings = finalize_findings(findings, &[cwd]);
    Ok(findings.into_iter().map(|f| to_napi_finding(f, redact_secrets)).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn raw_finding(rule_id: &str, priority: i32, start: u32, end: u32) -> RawFinding {
        RawFinding {
            rule_id: rule_id.into(),
            description: String::new(),
            tags: Vec::new(),
            file: "/tmp/fixture.txt".into(),
            start_line: 1,
            end_line: 1,
            start_column: 1,
            end_column: (end - start + 1),
            r#match: "AKIA0123456789ABCDEF".into(),
            secret: "AKIA0123456789ABCDEF".into(),
            entropy: 3.5,
            priority,
            start_offset: start,
            end_offset: end,
            source: None,
            confidence: "low",
            alternate_matches: Vec::new(),
        }
    }

    #[test]
    fn finalize_records_alternate_matches_for_same_span() {
        // Two rules matching the exact same byte span — the higher-priority wins,
        // the loser's rule_id lands in `alternate_matches`.
        let winner = raw_finding("kingfisher.aws.1", 2, 10, 30);
        let loser = raw_finding("aws-access-token", 1, 10, 30);

        let out = finalize_findings(vec![winner, loser], &[]);

        assert_eq!(out.len(), 1, "same-span findings should collapse to one");
        assert_eq!(out[0].rule_id, "kingfisher.aws.1");
        assert_eq!(out[0].alternate_matches, vec!["aws-access-token"]);
    }

    #[test]
    fn finalize_keeps_distinct_spans_untouched() {
        let a = raw_finding("rule.a", 0, 10, 30);
        let b = raw_finding("rule.b", 0, 40, 60);

        let out = finalize_findings(vec![a, b], &[]);

        assert_eq!(out.len(), 2);
        assert!(out.iter().all(|f| f.alternate_matches.is_empty()));
    }

    #[test]
    fn finalize_dedups_three_rules_at_same_span() {
        // Three rules at the same span — the winner accumulates two alternates,
        // losers collapse entirely (no duplicate entries in `alternate_matches`).
        let a = raw_finding("rule.a", 3, 10, 30); // winner
        let b = raw_finding("rule.b", 2, 10, 30);
        let c = raw_finding("rule.c", 1, 10, 30);

        let out = finalize_findings(vec![c, a, b], &[]);

        assert_eq!(out.len(), 1);
        assert_eq!(out[0].rule_id, "rule.a");
        assert_eq!(out[0].alternate_matches.len(), 2);
        assert!(out[0].alternate_matches.contains(&"rule.b".into()));
        assert!(out[0].alternate_matches.contains(&"rule.c".into()));
    }
}
