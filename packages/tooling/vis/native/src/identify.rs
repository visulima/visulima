use std::path::PathBuf;

use napi_derive::napi;
use prek_identify::{parse_shebang as prek_parse_shebang, tags as prek_tags, tags_from_path as prek_tags_from_path};

fn classify(path: &str) -> Vec<String> {
    let path = PathBuf::from(path);

    match prek_tags_from_path(&path) {
        Ok(set) => set.iter().map(|tag| tag.to_string()).collect(),
        Err(_) => Vec::new(),
    }
}

/// Classifies a single file path using `prek-identify`. Returns the set of
/// tags (extensions, interpreters, metadata) that pre-commit / prek would
/// associate with the file. Errors collapse to an empty vector so callers
/// don't need try/catch — the vis hook runtime treats "unclassified" and
/// "no tags" identically.
#[napi]
pub fn tags_from_path(path: String) -> Vec<String> {
    classify(&path)
}

/// Batch variant of [`tags_from_path`]. Returns one tag list per input
/// path in the same order. Errors for individual paths collapse to empty
/// vectors so partial classification failures don't fail the whole batch
/// (the same behavior pre-commit applies when stat-ing a deleted staged
/// file mid-run).
#[napi]
pub fn tags_from_paths(paths: Vec<String>) -> Vec<Vec<String>> {
    paths.iter().map(|p| classify(p)).collect()
}

/// Parses the shebang line of an executable file, returning the
/// interpreter argv (e.g. `["python3"]`, `["env", "node"]`). Returns an
/// empty vector when the file has no shebang or cannot be read — mirrors
/// pre-commit's behavior of treating "no shebang" as "no interpreter
/// tags" rather than as an error.
#[napi]
pub fn parse_shebang(path: String) -> Vec<String> {
    let path = PathBuf::from(path);

    prek_parse_shebang(&path).unwrap_or_default()
}

/// Returns the full prek-identify tag universe. Used by the vis migrator
/// to validate `types:` / `types_or:` / `exclude_types:` filters in
/// migrated `.pre-commit-config.yaml` files — anything outside this set
/// (and outside the vis-specific overlay) is surfaced as a warning.
#[napi]
pub fn all_known_tags() -> Vec<String> {
    prek_tags::ALL_TAGS.iter().map(|t| t.to_string()).collect()
}
