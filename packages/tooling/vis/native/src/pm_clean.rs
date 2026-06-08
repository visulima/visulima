use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::fs;
use std::path::{Path, PathBuf};

#[napi(object, object_from_js = false)]
pub struct CleanResult {
    /// Directories that were removed
    pub removed: Vec<String>,
    /// Directories that failed to remove (with error messages)
    pub errors: Vec<String>,
    /// Lockfiles that were removed (when --lockfile flag used)
    pub lockfiles_removed: Vec<String>,
}

/// Finds all node_modules directories in the workspace.
/// Walks from the given root, skipping nested node_modules to avoid traversing
/// into the dependency tree.
fn find_node_modules(root: &Path) -> Vec<PathBuf> {
    let mut results = Vec::new();
    let mut dirs_to_visit = vec![root.to_path_buf()];

    while let Some(dir) = dirs_to_visit.pop() {
        let entries = match fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            let path = entry.path();

            if !path.is_dir() {
                continue;
            }

            let name = entry.file_name();
            let name_str = name.to_string_lossy();

            if name_str == "node_modules" {
                results.push(path);
                // Don't recurse into node_modules
            } else if name_str != ".git" && name_str != ".hg" {
                dirs_to_visit.push(path);
            }
        }
    }

    results
}

/// Finds lockfiles in the workspace root.
fn find_lockfiles(root: &Path) -> Vec<PathBuf> {
    let lockfile_names =
        ["pnpm-lock.yaml", "package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "bun.lock", "bun.lockb"];

    lockfile_names.iter().map(|name| root.join(name)).filter(|path| path.exists()).collect()
}

/// Safely removes all node_modules directories in a workspace.
///
/// Uses Rust's `fs::remove_dir_all` which correctly handles symlinks and
/// NTFS junctions on Windows without following them into targets.
///
/// When `remove_lockfile` is true, also removes lockfiles from the root.
#[napi(catch_unwind)]
pub fn clean_workspace(root: String, remove_lockfile: bool) -> napi::Result<CleanResult> {
    let root_path = PathBuf::from(&root);

    if !root_path.exists() {
        return Err(Error::new(Status::InvalidArg, format!("Directory does not exist: {root}")));
    }

    let mut node_modules_dirs = find_node_modules(&root_path);

    // Remove the workspace root's own `node_modules` last. Package
    // node_modules symlink into the root store (pnpm's `.pnpm`), and the
    // running `vis` process resolves its own binary + native addon from the
    // root `node_modules` — clearing it before the package dirs risks pulling
    // those out from under an in-flight clean. `sort_by_key` is stable, so the
    // relative order of the package node_modules is preserved; only the root
    // entry (key `true`) is pushed to the end.
    let root_node_modules = root_path.join("node_modules");
    node_modules_dirs.sort_by_key(|dir| *dir == root_node_modules);

    let mut result = CleanResult { removed: Vec::new(), errors: Vec::new(), lockfiles_removed: Vec::new() };

    for dir in &node_modules_dirs {
        let dir_str = dir.to_string_lossy().to_string();

        match fs::remove_dir_all(dir) {
            Ok(()) => {
                result.removed.push(dir_str);
            }
            Err(e) => {
                result.errors.push(format!("{}: {}", dir_str, e));
            }
        }
    }

    if remove_lockfile {
        let lockfiles = find_lockfiles(&root_path);

        for lockfile in &lockfiles {
            let lockfile_str = lockfile.to_string_lossy().to_string();

            match fs::remove_file(lockfile) {
                Ok(()) => {
                    result.lockfiles_removed.push(lockfile_str);
                }
                Err(e) => {
                    result.errors.push(format!("{}: {}", lockfile_str, e));
                }
            }
        }
    }

    Ok(result)
}
