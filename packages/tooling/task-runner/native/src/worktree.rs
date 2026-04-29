use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{OnceLock, RwLock};

/// Cache of (workspace_root → main worktree root) results, keyed by canonicalized path.
/// `None` means "this workspace is not a linked worktree" (use the workspace root as-is).
/// `Some(path)` is the main worktree root.
fn cache() -> &'static RwLock<HashMap<PathBuf, Option<PathBuf>>> {
    static CACHE: OnceLock<RwLock<HashMap<PathBuf, Option<PathBuf>>>> = OnceLock::new();
    CACHE.get_or_init(|| RwLock::new(HashMap::new()))
}

/// Detects whether the given workspace is a linked git worktree, and if so,
/// returns the path to the main worktree root.
///
/// Returns:
/// - `Ok(Some(main_root))` when `<workspace_root>/.git` is a *file* (gitlink) —
///   shells out to `git rev-parse --git-common-dir` and resolves to its parent.
/// - `Ok(None)` for primary checkouts, missing `.git`, shallow checkouts where
///   `git rev-parse` fails, or when the `git` binary is not available.
///
/// Results are memoized per canonicalized workspace_root for the lifetime of
/// the process. Symlinks in the input path are resolved before lookup so that
/// `/tmp/foo` and `/private/tmp/foo` share a cache entry.
#[napi(catch_unwind)]
pub fn get_main_worktree_root(workspace_root: String) -> Result<Option<String>> {
    let canonical = canonicalize(&workspace_root);

    {
        let read = cache().read().map_err(|e| {
            Error::new(Status::GenericFailure, format!("worktree cache poisoned: {}", e))
        })?;

        if let Some(cached) = read.get(&canonical) {
            return Ok(cached.as_ref().map(|p| p.to_string_lossy().into_owned()));
        }
    }

    let resolved = detect_main_worktree(&canonical);

    {
        let mut write = cache().write().map_err(|e| {
            Error::new(Status::GenericFailure, format!("worktree cache poisoned: {}", e))
        })?;

        write.insert(canonical, resolved.clone());
    }

    Ok(resolved.map(|p| p.to_string_lossy().into_owned()))
}

/// Returns true when `<workspace_root>/.git` exists and is a regular file
/// (the gitlink pointer used by `git worktree add`). False for primary
/// checkouts (where `.git` is a directory) and for non-git directories.
#[napi(catch_unwind)]
pub fn is_linked_worktree(workspace_root: String) -> Result<bool> {
    let git = Path::new(&workspace_root).join(".git");

    Ok(git.is_file())
}

/// Clears the memoization cache. Primarily useful for tests; production code
/// should never call this since worktree topology does not change at runtime.
#[napi(catch_unwind)]
pub fn reset_worktree_cache() {
    if let Ok(mut write) = cache().write() {
        write.clear();
    }
}

fn detect_main_worktree(workspace_root: &Path) -> Option<PathBuf> {
    let git_path = workspace_root.join(".git");

    // Follow symlinks so a symlinked `.git` (pointing at a real gitlink file
    // or a real `.git` directory) is classified the same way as the target.
    // This keeps `detect_main_worktree` consistent with `is_linked_worktree`,
    // which uses `Path::is_file` (also follows symlinks).
    let metadata = fs::metadata(&git_path).ok()?;

    // Primary checkout: `.git` is a directory. Treat workspace_root as the
    // canonical root — no shared cache lookup needed.
    if metadata.file_type().is_dir() {
        return None;
    }

    // Linked worktree: `.git` is a file (gitlink). Ask git for the common dir
    // (which is `<main>/.git`) and use its parent as the main worktree root.
    if !metadata.file_type().is_file() {
        return None;
    }

    let output = Command::new("git")
        .args(["rev-parse", "--git-common-dir"])
        .current_dir(workspace_root)
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8(output.stdout).ok()?;
    let common_dir = stdout.trim();

    if common_dir.is_empty() {
        return None;
    }

    let common_dir_path = if Path::new(common_dir).is_absolute() {
        PathBuf::from(common_dir)
    } else {
        workspace_root.join(common_dir)
    };

    let main_root = common_dir_path.parent()?.to_path_buf();
    let canonical_main = canonicalize_existing(&main_root)?;

    if canonical_main == workspace_root {
        return None;
    }

    Some(canonical_main)
}

fn canonicalize(path: &str) -> PathBuf {
    fs::canonicalize(path).unwrap_or_else(|_| PathBuf::from(path))
}

fn canonicalize_existing(path: &Path) -> Option<PathBuf> {
    fs::canonicalize(path).ok()
}
