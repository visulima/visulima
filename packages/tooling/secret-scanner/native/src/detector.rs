// Core detection pipeline: AC prefilter -> per-candidate regex -> entropy -> allowlist.
// Port of gitleaks/detect/detect.go.

use std::path::Path;

use crate::entropy::shannon;
use crate::rules::{AllowlistTarget, CompiledAllowlist, CompiledRuleset};

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
    let path_str = path.to_string_lossy().to_string();
    let allow_regions = find_allow_regions(content);

    // 1) Candidate rules via AC keyword prefilter on the whole file. Empty-keywords rules
    //    are pre-marked so they always run. We use a bitmap indexed by rule id — O(rules)
    //    allocation, cache-friendly, and deterministic ordering when iterated.
    let n = ruleset.rules.len();
    let mut candidates = vec![false; n];
    for (i, rule) in ruleset.rules.iter().enumerate() {
        if rule.keywords_lower.is_empty() {
            candidates[i] = true;
        }
    }
    if let Some(ac) = &ruleset.keyword_ac {
        for m in ac.find_iter(content) {
            candidates[ruleset.keyword_to_rule[m.pattern().as_usize()]] = true;
        }
    }

    // Pre-compute line offsets for fast line/col lookup
    let line_offsets = line_offsets(content);

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
        // Path-only rules: emit a finding for the file itself
        if rule.regex.is_none() && rule.path_regex.is_some() {
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
            });
            continue;
        }

        let Some(re) = &rule.regex else { continue };

        for caps_res in re.captures_iter(content) {
            let caps = match caps_res {
                Ok(c) => c,
                Err(_) => continue,
            };
            let whole = match caps.get(0) {
                Some(m) => m,
                None => continue,
            };
            let match_str = whole.as_str();
            // Resolve the secret slice (borrows from `content`) without allocating so we can
            // do entropy + allowlist checks cheaply, then allocate once we're emitting.
            let secret_slice: &str = if rule.secret_group == 0 {
                match_str
            } else {
                caps.get(rule.secret_group as usize).map(|m| m.as_str()).unwrap_or(match_str)
            };

            // Entropy check
            let ent = shannon(secret_slice);
            if let Some(min) = rule.entropy {
                if ent < min {
                    continue;
                }
            }

            // Line containing the match (for "line" allowlist target)
            let (sl, sc, el, ec) = offset_to_line_col(&line_offsets, whole.start(), whole.end());
            let line = line_slice(content, &line_offsets, sl);

            // Inline allow-comment (same line) or block allow-region
            // (gitleaks:allow-start ... gitleaks:allow-end).
            if has_allow_comment(line) || is_in_allow_region(&allow_regions, whole.start()) {
                continue;
            }

            // Allowlist (rule + global)
            if is_allowlisted(&rule.allowlists, &path_str, match_str, secret_slice, line)
                || is_allowlisted(&ruleset.global_allowlists, &path_str, match_str, secret_slice, line)
            {
                continue;
            }

            out.push(RawFinding {
                rule_id: rule.id.clone(),
                description: rule.description.clone(),
                tags: rule.tags.clone(),
                file: path_str.clone(),
                start_line: sl,
                end_line: el,
                start_column: sc,
                end_column: ec,
                r#match: match_str.to_string(),
                secret: secret_slice.to_string(),
                entropy: ent,
            });
        }
    }

    out
}

/// Returns true if the line contains a recognised inline allow-comment.
/// Matching is case-insensitive. We accept `gitleaks:allow` (upstream compat)
/// and `secret-scanner:allow` (our own). Both work regardless of the comment
/// syntax used by the host language (`#`, `//`, `/* */`, `--`, etc.).
fn has_allow_comment(line: &str) -> bool {
    const MARKERS: [&str; 2] = ["gitleaks:allow", "secret-scanner:allow"];
    // Avoid the lowercase allocation when the line is short and definitely can't match.
    if line.len() < "gitleaks:allow".len() {
        return false;
    }
    let lc = line.to_ascii_lowercase();
    MARKERS.iter().any(|m| lc.contains(m))
}

fn is_allowlisted(lists: &[CompiledAllowlist], path: &str, m: &str, secret: &str, line: &str) -> bool {
    for a in lists {
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

fn line_offsets(s: &str) -> Vec<usize> {
    let mut v = vec![0usize];
    for (i, b) in s.bytes().enumerate() {
        if b == b'\n' {
            v.push(i + 1);
        }
    }
    v
}

fn offset_to_line_col(offsets: &[usize], start: usize, end: usize) -> (u32, u32, u32, u32) {
    let sl = offsets.partition_point(|&o| o <= start);
    let el = offsets.partition_point(|&o| o <= end);
    let sc = start - offsets[sl - 1] + 1;
    let ec = end - offsets[el - 1] + 1;
    (sl as u32, sc as u32, el as u32, ec as u32)
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
}
