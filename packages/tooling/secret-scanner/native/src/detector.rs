// Core detection pipeline: AC prefilter -> per-candidate regex -> entropy -> allowlist.
// Port of gitleaks/detect/detect.go.

use std::path::Path;

use crate::entropy::shannon;
use crate::rules::{AllowlistTarget, CompiledAllowlist, CompiledPatternRequirements, CompiledRule, CompiledRuleset, Engine};

/// Bytes of lookback/lookahead around each rule's AC keyword hit when
/// windowed scanning kicks in. Covers the entire span of every kingfisher +
/// gitleaks rule in the bundled ruleset (longest pattern ≈ 500 bytes of
/// lookback in AWS secret detection); 4 KiB leaves headroom for third-party
/// rules that widen their context.
const LOOKBACK_WINDOW_BYTES: usize = 4096;

/// Returns `(start, end)` byte offsets of a valid UTF-8 window around the
/// AC bounding box. Both endpoints are guaranteed to be char boundaries so
/// `&content[start..end]` never panics.
fn window_around(content: &str, span: (usize, usize)) -> (usize, usize) {
    let (min_start, max_end) = span;
    let mut start = min_start.saturating_sub(LOOKBACK_WINDOW_BYTES);
    let mut end = (max_end + LOOKBACK_WINDOW_BYTES).min(content.len());

    while start > 0 && !content.is_char_boundary(start) {
        start -= 1;
    }

    while end < content.len() && !content.is_char_boundary(end) {
        end += 1;
    }

    (start, end)
}

#[derive(Debug, Clone)]
pub struct RawFinding {
    pub rule_id: String,
    pub description: String,
    pub tags: Vec<String>,
    pub file: String,
    pub start_line: u32,
    pub end_line: u32,
    pub start_column: u32,
    pub end_column: u32,
    pub r#match: String,
    pub secret: String,
    pub entropy: f32,
    pub priority: i32,
    /// Byte offsets in the *original* content (pre pre-regex-replace). Used for
    /// overlap-based dedup in `lib.rs` without inflating the NAPI surface.
    pub start_offset: u32,
    pub end_offset: u32,
    /// Provenance: carried from the rule. `None` for legacy rules that don't declare
    /// a source; surfaces as a nullable string on the NAPI side.
    pub source: Option<String>,
    /// Author-declared match quality: "low" | "medium" | "high". Always populated —
    /// rules that don't declare confidence resolve to "low".
    pub confidence: &'static str,
    /// Rule ids that matched the same span and were collapsed by the dedup pass.
    /// Populated in `finalize_findings`; detector emits an empty `Vec`.
    pub alternate_matches: Vec<String>,
}

/// Byte ranges inside `content` marked by `gitleaks:allow-start` ... `gitleaks:allow-end`
/// or `secret-scanner:allow-start` ... `:allow-end` pairs. Any finding whose match falls
/// inside one of these ranges is suppressed.
fn find_allow_regions(content: &str) -> Vec<(usize, usize)> {
    let lc = content.to_ascii_lowercase();
    let mut regions = Vec::new();
    let mut cursor = 0;

    while cursor < lc.len() {
        let rest = &lc[cursor..];
        let start_off =
            [rest.find("gitleaks:allow-start"), rest.find("secret-scanner:allow-start")].into_iter().flatten().min();

        let Some(start_rel) = start_off else { break };
        let start_abs = cursor + start_rel;
        let after_start = start_abs + "gitleaks:allow-start".len().min("secret-scanner:allow-start".len());

        let remaining = &lc[after_start..];
        let end_rel = [remaining.find("gitleaks:allow-end"), remaining.find("secret-scanner:allow-end")]
            .into_iter()
            .flatten()
            .min();

        match end_rel {
            Some(end_rel) => {
                let end_abs = after_start + end_rel;

                regions.push((start_abs, end_abs));
                cursor = end_abs + "gitleaks:allow-end".len().min("secret-scanner:allow-end".len());
            }
            None => break,
        }
    }

    regions
}

fn is_in_allow_region(regions: &[(usize, usize)], offset: usize) -> bool {
    regions.iter().any(|&(start, end)| offset >= start && offset <= end)
}

pub fn scan_text(ruleset: &CompiledRuleset, path: &Path, content: &str) -> Vec<RawFinding> {
    // Normalise to forward slashes so user-authored path regexes (rule `path`
    // and `allowlists.paths`) match consistently on Windows. Without this,
    // a Windows path like `test\fixtures\x.kdbx` would never match `(?:^|/)test/`.
    let path_str = path.to_string_lossy().replace('\\', "/");
    let allow_regions = find_allow_regions(content);

    // 1) Candidate rules via AC keyword prefilter on the whole file. Empty-keywords rules
    //    are pre-marked so they always run. We use a bitmap indexed by rule id — O(rules)
    //    allocation, cache-friendly, and deterministic ordering when iterated.
    //
    //    `ac_spans[i] = Some((min, max))` records the bounding box of every AC keyword
    //    hit for rule `i`. When we later run the rule's regex we expand that box by
    //    `LOOKBACK_WINDOW_BYTES` on each side and scan *only* that slice — saves the
    //    full-file `captures_iter` cost on rules that only need to look near their
    //    own keyword. Rules without keywords (always-runs) keep `ac_spans[i] = None`
    //    and fall back to a whole-file scan.
    let n = ruleset.rules.len();
    let mut candidates = vec![false; n];
    let mut ac_spans: Vec<Option<(usize, usize)>> = vec![None; n];
    for (i, rule) in ruleset.rules.iter().enumerate() {
        if rule.keywords_lower.is_empty() {
            candidates[i] = true;
        }
    }
    if let Some(ac) = &ruleset.keyword_ac {
        // Use overlapping iteration so keywords that share a prefix with another rule's
        // keyword (e.g. `password` vs `passwordProtected`) both activate their rules. With
        // the non-overlapping `find_iter`, the lower-ID pattern starves the longer one and
        // the rule never becomes a candidate.
        for m in ac.find_overlapping_iter(content) {
            let rule_idx = ruleset.keyword_to_rule[m.pattern().as_usize()];
            candidates[rule_idx] = true;

            let hit_start = m.start();
            let hit_end = m.end();

            ac_spans[rule_idx] = Some(match ac_spans[rule_idx] {
                None => (hit_start, hit_end),
                Some((min_start, max_end)) => (min_start.min(hit_start), max_end.max(hit_end)),
            });
        }
    }

    // 2) Second-stage RegexSet intersection for `Engine::Fast` rules. Running
    //    `RegexSet::matches` once is O(content.len()) regardless of pattern
    //    count — the whole reason the set exists — so we skip the per-candidate
    //    `captures_iter` for Fast rules whose regex doesn't actually appear in
    //    this file. Fancy rules stay on the AC-only path (they aren't in the set).
    //
    //    Semantics:
    //      - Fast rule + AC hit + RegexSet hit  → active (fall through to iter)
    //      - Fast rule + AC hit + RegexSet miss → dropped
    //      - Fancy rule + AC hit                → active (unchanged)
    //      - Any rule + AC miss + no keywords   → active (unchanged)
    //
    //    When the RegexSet failed to build (e.g. `dfa_size_limit` overflow) we
    //    skip this step — correctness is preserved via AC alone.
    if let Some(set) = &ruleset.regex_set {
        let hits = set.matches(content.as_bytes());
        let mut fast_in_set = vec![false; n];

        for pattern_idx in hits.iter() {
            if let Some(&rule_idx) = ruleset.regex_set_pattern_to_rule.get(pattern_idx) {
                fast_in_set[rule_idx] = true;
            }
        }

        for (i, rule) in ruleset.rules.iter().enumerate() {
            // `preRegexReplace` rules match against a rewritten buffer — the RegexSet only
            // sees the original content, so a miss there doesn't imply the rule can't fire.
            // Skip the intersection for those rules; they stay active on AC alone.
            let uses_pre_replace = !rule.pre_regex_replace.is_empty();
            if rule.engine.as_ref().is_some_and(Engine::is_fast) && !uses_pre_replace && candidates[i] && !fast_in_set[i] {
                candidates[i] = false;
            }
        }
    }

    // Pre-compute line offsets for fast line/col lookup
    let line_offsets = compute_line_offsets(content);

    let mut out: Vec<RawFinding> = Vec::new();
    for (i, &active) in candidates.iter().enumerate() {
        if !active {
            continue;
        }
        let rule = &ruleset.rules[i];
        // Rule-level path filter
        if let Some(pr) = &rule.path_regex {
            if !pr.is_match(&path_str).unwrap_or(false) {
                continue;
            }
        }
        // Path-only rules: emit a finding for the file itself.
        //
        // We consult **rule-level** allowlists only so authors can suppress matches
        // under specific subtrees (e.g. `paths = ['(?:^|/)test/']`). Global allowlists
        // are scoped to content-shape hygiene (lockfiles, vendored bundles, binary
        // assets) — applying them here would mask the exposure rules whose whole
        // purpose is to flag those very files (e.g. `exposed-lockfile-in-build-output`).
        // Match / secret / line are empty strings; only `paths`-style allowlists are
        // meaningful for a rule that doesn't read content.
        if rule.engine.is_none() && rule.path_regex.is_some() {
            if is_allowlisted(&rule.allowlists, &rule.id, &path_str, "", "", "") {
                continue;
            }

            out.push(RawFinding {
                rule_id: rule.id.clone(),
                description: rule.description.clone(),
                tags: rule.tags.clone(),
                file: path_str.clone(),
                start_line: 1,
                end_line: 1,
                start_column: 1,
                end_column: 1,
                r#match: String::new(),
                secret: String::new(),
                entropy: 0.0,
                priority: rule.priority,
                start_offset: 0,
                end_offset: 0,
                source: rule.source.clone(),
                confidence: rule.confidence.as_str(),
                alternate_matches: Vec::new(),
            });
            continue;
        }

        let Some(engine) = rule.engine.as_ref() else { continue };

        // Per-rule pre-regex text replacement. When a rule declares replacements we build a
        // new scratch `String` and rewrite line offsets for it; otherwise we scan the original
        // `content` in place.
        //
        // Perf note: this runs once *per active rule per file*. With N rules declaring
        // `preRegexReplace` and a content buffer of size M the worst case is O(N·M) in
        // allocation + replace_all work. Fine for ≤ a handful of rules (the intended use).
        // Avoid bulk-applying it on `generic-api-key`-sized allowlists.
        let (text, text_offsets): (std::borrow::Cow<'_, str>, std::borrow::Cow<'_, [usize]>) =
            if rule.pre_regex_replace.is_empty() {
                (std::borrow::Cow::Borrowed(content), std::borrow::Cow::Borrowed(&line_offsets))
            } else {
                let mut buf = content.to_string();
                for (from, to) in &rule.pre_regex_replace {
                    let replaced = from.replace_all(&buf, to.as_str());
                    buf = replaced.into_owned();
                }
                let lo = compute_line_offsets(&buf);
                (std::borrow::Cow::Owned(buf), std::borrow::Cow::Owned(lo))
            };

        let offsets_ref: &[usize] = text_offsets.as_ref();
        let text_ref: &str = text.as_ref();

        // Windowed scanning: when the AC prefilter gave us a bounding box, scan only
        // that region (±LOOKBACK_WINDOW_BYTES) instead of the whole file. Falls back
        // to the full `text_ref` when:
        //   - the rule has no keywords (always-run, `ac_spans[i] = None`);
        //   - the rule uses `preRegexReplace` so offsets from AC hits over the original
        //     `content` don't map cleanly to `text` (the rewritten buffer);
        //   - the computed window spans the whole file anyway.
        //
        // The slice stays at char boundaries via `window_around`, and we translate
        // slice-relative offsets back to absolute via `slice_start` before emission.
        let uses_pre_replace = !rule.pre_regex_replace.is_empty();
        let window = if uses_pre_replace { None } else { ac_spans[i] };
        let (slice_start, slice_end) = match window {
            Some(span) => window_around(text_ref, span),
            None => (0, text_ref.len()),
        };
        let slice = &text_ref[slice_start..slice_end];

        // Dispatch on engine. Both branches feed the same `emit_match` helper — we only
        // differ on how we enumerate spans, because `regex::bytes` and `fancy_regex`
        // disagree on Captures types. Keeping two short loops is faster than wrapping in
        // a trait-object iterator (Box<dyn> allocation per rule per file).
        match engine {
            Engine::Fast(re) => {
                // regex::bytes works on &[u8]; we feed the UTF-8 `slice` directly. Match
                // offsets always fall on char boundaries for valid UTF-8 input, so we
                // slice the original `&str` to recover the match substring without
                // re-validating.
                for caps in re.captures_iter(slice.as_bytes()) {
                    let Some(whole) = caps.get(0) else { continue };
                    let (s_start, s_end) = if rule.secret_group == 0 {
                        (whole.start(), whole.end())
                    } else {
                        caps.get(rule.secret_group as usize)
                            .map(|m| (m.start(), m.end()))
                            .unwrap_or((whole.start(), whole.end()))
                    };

                    emit_match(
                        MatchSpan {
                            match_start: slice_start + whole.start(),
                            match_end: slice_start + whole.end(),
                            secret_start: slice_start + s_start,
                            secret_end: slice_start + s_end,
                        },
                        rule,
                        ruleset,
                        &path_str,
                        text_ref,
                        offsets_ref,
                        &allow_regions,
                        &mut out,
                    );
                }
            }
            Engine::Fancy(re) => {
                for caps_res in re.captures_iter(slice) {
                    let Ok(caps) = caps_res else { continue };
                    let Some(whole) = caps.get(0) else { continue };
                    let (s_start, s_end) = if rule.secret_group == 0 {
                        (whole.start(), whole.end())
                    } else {
                        caps.get(rule.secret_group as usize)
                            .map(|m| (m.start(), m.end()))
                            .unwrap_or((whole.start(), whole.end()))
                    };

                    emit_match(
                        MatchSpan {
                            match_start: slice_start + whole.start(),
                            match_end: slice_start + whole.end(),
                            secret_start: slice_start + s_start,
                            secret_end: slice_start + s_end,
                        },
                        rule,
                        ruleset,
                        &path_str,
                        text_ref,
                        offsets_ref,
                        &allow_regions,
                        &mut out,
                    );
                }
            }
        }
    }

    out
}

/// Byte-offset tuple carried between the engine-specific capture loops and the
/// shared post-match emission path. All offsets index into the **post-replacement**
/// text used by the current rule.
struct MatchSpan {
    match_start: usize,
    match_end: usize,
    secret_start: usize,
    secret_end: usize,
}

#[allow(clippy::too_many_arguments)]
fn emit_match(
    span: MatchSpan,
    rule: &CompiledRule,
    ruleset: &CompiledRuleset,
    path_str: &str,
    text_ref: &str,
    offsets_ref: &[usize],
    allow_regions: &[(usize, usize)],
    out: &mut Vec<RawFinding>,
) {
    let match_str = &text_ref[span.match_start..span.match_end];
    let secret_slice: &str = if span.secret_start == span.match_start && span.secret_end == span.match_end {
        match_str
    } else {
        &text_ref[span.secret_start..span.secret_end]
    };

    // #1828 — drop findings whose secret group is empty or whitespace-only. Covers
    // `FOO=` / `token = ""` and similar generic-rule false positives.
    if secret_slice.trim().is_empty() {
        return;
    }

    // Entropy check
    let ent = shannon(secret_slice);
    if let Some(min) = rule.entropy {
        if ent < min {
            return;
        }
    }

    // Kingfisher-style cheap post-match filters (min length, min digit count,
    // ignore-if-contains). Slots between entropy and allowlist so a failed
    // requirement short-circuits before the more expensive regex/path work.
    if let Some(req) = &rule.pattern_requirements {
        if !check_pattern_requirements(secret_slice, req) {
            return;
        }
    }

    // Line containing the match (for "line" allowlist target)
    let (sl, sc, el, ec) = offset_to_line_col(offsets_ref, span.match_start, span.match_end, text_ref);
    let line = line_slice(text_ref, offsets_ref, sl);

    // Inline allow-comment (same line), block allow-region
    // (gitleaks:allow-start ... gitleaks:allow-end), or detect-secrets-style
    // `pragma: allowlist nextline secret` on the line preceding the match.
    if has_allow_comment(line) || is_in_allow_region(allow_regions, span.match_start) {
        return;
    }

    if sl > 1 {
        let previous = line_slice(text_ref, offsets_ref, sl - 1);

        if has_nextline_pragma(previous) {
            return;
        }
    }

    // Allowlist (rule + global) — respects per-allowlist `targetRules` via the rule id.
    if is_allowlisted(&rule.allowlists, &rule.id, path_str, match_str, secret_slice, line)
        || is_allowlisted(&ruleset.global_allowlists, &rule.id, path_str, match_str, secret_slice, line)
    {
        return;
    }

    out.push(RawFinding {
        rule_id: rule.id.clone(),
        description: rule.description.clone(),
        tags: rule.tags.clone(),
        file: path_str.to_string(),
        start_line: sl,
        end_line: el,
        start_column: sc,
        end_column: ec,
        r#match: match_str.to_string(),
        secret: secret_slice.to_string(),
        entropy: ent,
        priority: rule.priority,
        start_offset: span.match_start as u32,
        end_offset: span.match_end as u32,
        source: rule.source.clone(),
        confidence: rule.confidence.as_str(),
        alternate_matches: Vec::new(),
    });
}

/// Returns true if the line contains a recognised inline allow-comment.
/// Matching is case-insensitive. We accept `gitleaks:allow` (upstream compat),
/// `secret-scanner:allow` (our own), and `pragma: allowlist secret`
/// (detect-secrets compat). All three work regardless of the comment syntax
/// used by the host language (`#`, `//`, `/* */`, `--`, `<!-- -->`, …) — we
/// look for the marker text itself, not the comment delimiters.
fn has_allow_comment(line: &str) -> bool {
    const MARKERS: [&str; 3] = ["gitleaks:allow", "secret-scanner:allow", "pragma: allowlist secret"];
    // Shortest marker bounds the cheap-path length check.
    if line.len() < "gitleaks:allow".len() {
        return false;
    }
    let lc = line.to_ascii_lowercase();
    MARKERS.iter().any(|m| lc.contains(m))
}

/// Returns true when the line carries a `pragma: allowlist nextline secret`
/// marker (detect-secrets compat) — the scanner checks this on the line
/// *before* a potential match, suppressing findings on the line below.
/// Useful for multi-line block-scalar cases where an inline comment on the
/// secret line itself is awkward (YAML) or impossible (PEM body).
///
/// Cheap pre-check: scan the raw bytes for `p`/`P` before paying the
/// `to_ascii_lowercase()` allocation. The vast majority of source lines
/// contain neither, so the allocation only fires on ~1% of lookups.
fn has_nextline_pragma(line: &str) -> bool {
    const MARKER: &str = "pragma: allowlist nextline secret";
    if line.len() < MARKER.len() {
        return false;
    }
    if !line.bytes().any(|b| b == b'p' || b == b'P') {
        return false;
    }
    line.to_ascii_lowercase().contains(MARKER)
}

fn is_allowlisted(lists: &[CompiledAllowlist], rule_id: &str, path: &str, m: &str, secret: &str, line: &str) -> bool {
    for a in lists {
        // #1919 — an allowlist with a non-empty `targetRules` only applies to those rules.
        if !a.target_rules.is_empty() && !a.target_rules.iter().any(|r| r == rule_id) {
            continue;
        }

        let mut matched_any = false;
        let mut matched_all = true;

        let check_paths = !a.paths.is_empty();
        let check_regexes = !a.regexes.is_empty();
        let check_stopwords = !a.stopwords_lower.is_empty();

        let target = match a.regex_target {
            AllowlistTarget::Match => m,
            AllowlistTarget::Secret => secret,
            AllowlistTarget::Line => line,
        };

        let path_hit = check_paths && a.paths.iter().any(|r| r.is_match(path).unwrap_or(false));
        let regex_hit = check_regexes && a.regexes.iter().any(|r| r.is_match(target).unwrap_or(false));
        let stopword_hit = check_stopwords && {
            let lc = secret.to_lowercase();
            a.stopwords_lower.iter().any(|s| lc.contains(s))
        };

        if check_paths {
            matched_any |= path_hit;
            matched_all &= path_hit;
        }
        if check_regexes {
            matched_any |= regex_hit;
            matched_all &= regex_hit;
        }
        if check_stopwords {
            matched_any |= stopword_hit;
            matched_all &= stopword_hit;
        }
        if !check_paths && !check_regexes && !check_stopwords {
            continue;
        }

        if (a.condition_and && matched_all) || (!a.condition_and && matched_any) {
            return true;
        }
    }
    false
}

/// Returns `true` when the captured secret passes every declared requirement.
/// Cheapest checks run first so a failure avoids the allocating paths.
fn check_pattern_requirements(secret: &str, req: &CompiledPatternRequirements) -> bool {
    if let Some(min) = req.min_length {
        if (secret.len() as u32) < min {
            return false;
        }
    }

    if let Some(min) = req.min_digits {
        let digits = secret.bytes().filter(u8::is_ascii_digit).count() as u32;
        if digits < min {
            return false;
        }
    }

    if let Some(min) = req.min_uppercase {
        let upper = secret.bytes().filter(u8::is_ascii_uppercase).count() as u32;
        if upper < min {
            return false;
        }
    }

    if let Some(min) = req.min_lowercase {
        let lower = secret.bytes().filter(u8::is_ascii_lowercase).count() as u32;
        if lower < min {
            return false;
        }
    }

    if !req.ignore_if_contains_lower.is_empty() {
        let lc = secret.to_ascii_lowercase();
        if req.ignore_if_contains_lower.iter().any(|needle| lc.contains(needle)) {
            return false;
        }
    }

    true
}

fn compute_line_offsets(s: &str) -> Vec<usize> {
    let mut v = vec![0usize];
    for (i, b) in s.bytes().enumerate() {
        if b == b'\n' {
            v.push(i + 1);
        }
    }
    v
}

/// Byte offsets → 1-based line + codepoint column. Columns count **characters**, not bytes,
/// so multi-byte UTF-8 sequences line up with what editors/LSPs expect.
///
/// The `.get(…).copied().unwrap_or(0)` guards are belt-and-braces — `compute_line_offsets`
/// always pushes `0` first, so `partition_point` returns ≥ 1 for any valid byte offset. We
/// still avoid bare `[idx]` here: the offsets slice may come from a future caller that
/// forgets the invariant, and a corrupt index on user-controlled content is not worth a
/// panic when emitting `1` is a correct fallback.
fn offset_to_line_col(offsets: &[usize], start: usize, end: usize, content: &str) -> (u32, u32, u32, u32) {
    let sl = offsets.partition_point(|&o| o <= start);
    let el = offsets.partition_point(|&o| o <= end);
    let start_line_offset = offsets.get(sl.saturating_sub(1)).copied().unwrap_or(0);
    let end_line_offset = offsets.get(el.saturating_sub(1)).copied().unwrap_or(0);
    let sc = codepoint_col(content, start_line_offset, start);
    let ec = codepoint_col(content, end_line_offset, end);
    (sl.max(1) as u32, sc, el.max(1) as u32, ec)
}

fn codepoint_col(content: &str, line_start: usize, offset: usize) -> u32 {
    let end = offset.min(content.len());
    if line_start >= end {
        return 1;
    }
    // Character count of the slice `[line_start..offset]`, +1 for 1-based columns.
    (content[line_start..end].chars().count() as u32) + 1
}

fn line_slice<'a>(content: &'a str, offsets: &[usize], line: u32) -> &'a str {
    let idx = (line as usize).saturating_sub(1);
    let start = offsets.get(idx).copied().unwrap_or(0);
    let end = offsets.get(idx + 1).copied().unwrap_or(content.len());
    content[start..end].trim_end_matches('\n')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allow_comment_gitleaks() {
        assert!(has_allow_comment("let x = \"ghp_...\"; // gitleaks:allow"));
        assert!(has_allow_comment("token = \"...\"  # gitleaks:allow"));
    }

    #[test]
    fn allow_comment_our_marker() {
        assert!(has_allow_comment("key = \"...\" // secret-scanner:allow"));
        assert!(has_allow_comment("# SECRET-SCANNER:ALLOW"));
    }

    #[test]
    fn allow_comment_absent() {
        assert!(!has_allow_comment("normal line"));
        assert!(!has_allow_comment("// just a comment"));
        assert!(!has_allow_comment("allow")); // too short
    }

    #[test]
    fn allow_comment_pragma() {
        // detect-secrets compat — same-line marker across comment syntaxes.
        assert!(has_allow_comment("token = \"abc123\"  # pragma: allowlist secret"));
        assert!(has_allow_comment("let x = \"...\"; // PRAGMA: ALLOWLIST SECRET"));
        assert!(has_allow_comment("/* pragma: allowlist secret */ const k = \"…\";"));
        assert!(!has_allow_comment("token = \"abc\" # pragma: allow"));
    }

    #[test]
    fn nextline_pragma_suppresses_following_line() {
        assert!(has_nextline_pragma("# pragma: allowlist nextline secret"));
        assert!(has_nextline_pragma("// PRAGMA: ALLOWLIST NEXTLINE SECRET"));
        assert!(!has_nextline_pragma("# pragma: allowlist secret"));
        assert!(!has_nextline_pragma("normal comment"));
        assert!(!has_nextline_pragma("")); // empty line
    }

    #[test]
    fn allow_region_pair() {
        let src = "head\n# gitleaks:allow-start\nSECRET=abc\n# gitleaks:allow-end\ntail";
        let regions = find_allow_regions(src);
        assert_eq!(regions.len(), 1);
        let secret_off = src.find("SECRET").unwrap();
        assert!(is_in_allow_region(&regions, secret_off));
    }

    #[test]
    fn allow_region_unpaired_is_ignored() {
        let src = "# gitleaks:allow-start\nonly one marker";
        let regions = find_allow_regions(src);
        assert!(regions.is_empty());
    }

    fn reqs(min_digits: Option<u32>, min_length: Option<u32>, ignores: &[&str]) -> CompiledPatternRequirements {
        CompiledPatternRequirements {
            min_digits,
            min_length,
            min_uppercase: None,
            min_lowercase: None,
            ignore_if_contains_lower: ignores.iter().map(|s| s.to_lowercase()).collect(),
        }
    }

    fn reqs_case(min_uppercase: Option<u32>, min_lowercase: Option<u32>) -> CompiledPatternRequirements {
        CompiledPatternRequirements {
            min_digits: None,
            min_length: None,
            min_uppercase,
            min_lowercase,
            ignore_if_contains_lower: Vec::new(),
        }
    }

    #[test]
    fn pattern_requirements_min_digits_enforced() {
        let r = reqs(Some(2), None, &[]);
        assert!(!check_pattern_requirements("ABCDEF", &r));
        assert!(!check_pattern_requirements("ABC1DEF", &r));
        assert!(check_pattern_requirements("AB12CD", &r));
    }

    #[test]
    fn pattern_requirements_min_length_enforced() {
        let r = reqs(None, Some(10), &[]);
        assert!(!check_pattern_requirements("abc", &r));
        assert!(check_pattern_requirements("0123456789", &r));
    }

    #[test]
    fn pattern_requirements_ignore_if_contains_drops_placeholders() {
        let r = reqs(None, None, &["EXAMPLE", "TEST"]);
        assert!(!check_pattern_requirements("AKIA0EXAMPLE01234567", &r));
        assert!(!check_pattern_requirements("my-test-key-01234567", &r));
        assert!(check_pattern_requirements("AKIA1ABCDE0123456789", &r));
    }

    #[test]
    fn pattern_requirements_min_uppercase_enforced() {
        let r = reqs_case(Some(2), None);
        assert!(!check_pattern_requirements("lower0123", &r));
        assert!(!check_pattern_requirements("Abc123", &r));
        assert!(check_pattern_requirements("ABcd", &r));
    }

    #[test]
    fn pattern_requirements_min_lowercase_enforced() {
        let r = reqs_case(None, Some(3));
        assert!(!check_pattern_requirements("AB1234", &r));
        assert!(!check_pattern_requirements("Abc123", &r));
        assert!(check_pattern_requirements("abcDE", &r));
    }

    #[test]
    fn pattern_requirements_combined_short_circuits() {
        let r = reqs(Some(1), Some(6), &["DEMO"]);
        assert!(!check_pattern_requirements("short", &r)); // len fails first
        assert!(!check_pattern_requirements("nodigits", &r)); // digits fails
        assert!(!check_pattern_requirements("DEMO1234", &r)); // ignore matches
        assert!(check_pattern_requirements("real01", &r));
    }
}
