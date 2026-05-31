use napi::bindgen_prelude::*;
use napi_derive::napi;
use rayon::prelude::*;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use xxhash_rust::xxh3::xxh3_128;

/// Ignored directory names during file collection.
const IGNORED_DIRS: &[&str] = &["node_modules", ".git", "dist", "coverage", ".cache"];

/// Computes the xxh3-128 hash of a single file.
/// Returns the hex-encoded hash string.
///
/// Uses xxHash xxh3 (same as Nx) for maximum hashing throughput.
/// xxh3 is ~5-10x faster than SHA-256 on modern CPUs with SIMD.
#[napi(catch_unwind)]
pub fn hash_file(file_path: String) -> Result<String> {
    let content = fs::read(&file_path)
        .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to read file {}: {}", file_path, e)))?;

    Ok(hash_bytes(&content))
}

/// Collects all files in a directory recursively, ignoring common non-source directories.
/// Returns a list of absolute file paths.
#[napi(catch_unwind)]
pub fn collect_files(dir: String) -> Result<Vec<String>> {
    let path = Path::new(&dir);

    if !path.exists() {
        return Ok(Vec::new());
    }

    if path.is_file() {
        return Ok(vec![dir]);
    }

    let files: Vec<String> = WalkDir::new(path)
        .into_iter()
        .filter_entry(|entry| {
            // Only apply the IGNORED_DIRS name filter to directories.
            // A regular file named `.cache`, `dist`, `coverage`, etc.
            // is a legitimate workspace artifact whose contents must
            // contribute to cache keys; the previous filter dropped
            // them silently and made cache hashes ignore real changes.
            if !entry.file_type().is_dir() {
                return true;
            }
            let name = entry.file_name().to_str().unwrap_or("");
            !IGNORED_DIRS.contains(&name)
        })
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
        .map(|entry| entry.path().to_string_lossy().to_string())
        .collect();

    Ok(files)
}

/// A single file hash result.
#[napi(object, object_from_js = false)]
pub struct FileHash {
    pub path: String,
    pub hash: String,
}

/// Collects all files in a directory and computes xxh3-128 hashes for each,
/// using parallel processing via rayon for maximum throughput.
///
/// Returns a list of { path, hash } objects where path is relative to workspace_root.
#[napi(catch_unwind)]
pub fn hash_files_in_directory(dir: String, workspace_root: String) -> Result<Vec<FileHash>> {
    let dir_path = Path::new(&dir);

    if !dir_path.exists() {
        return Ok(Vec::new());
    }

    if dir_path.is_file() {
        let content = fs::read(dir_path)
            .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to read file: {}", e)))?;

        let hash = hash_bytes(&content);
        let rel = make_relative(&dir, &workspace_root);

        return Ok(vec![FileHash { path: rel, hash }]);
    }

    let files: Vec<PathBuf> = WalkDir::new(dir_path)
        .into_iter()
        .filter_entry(|entry| {
            // Same as collect_files: only filter on name for dirs.
            if !entry.file_type().is_dir() {
                return true;
            }
            let name = entry.file_name().to_str().unwrap_or("");
            !IGNORED_DIRS.contains(&name)
        })
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
        .map(|entry| entry.path().to_owned())
        .collect();

    let results: Vec<FileHash> = files
        .par_iter()
        .map(|file_path| {
            let abs = file_path.to_string_lossy().to_string();
            let rel = make_relative(&abs, &workspace_root);
            let hash = read_and_hash(file_path);

            FileHash { path: rel, hash }
        })
        .collect();

    Ok(results)
}

/// Computes xxh3-128 hashes for multiple files in parallel.
/// Takes absolute file paths, returns relative_path + hash pairs.
#[napi(catch_unwind)]
pub fn hash_files_batch(file_paths: Vec<String>, workspace_root: String) -> Result<Vec<FileHash>> {
    let results: Vec<FileHash> = file_paths
        .par_iter()
        .map(|file_path| {
            let rel = make_relative(file_path, &workspace_root);
            let hash = read_and_hash(Path::new(file_path));

            FileHash { path: rel, hash }
        })
        .collect();

    Ok(results)
}

/// Makes a path relative to the workspace root. Always emits forward slashes
/// so JS-side consumers see consistent path keys across POSIX and Windows.
fn make_relative(path: &str, workspace_root: &str) -> String {
    let path_fwd = path.replace('\\', "/");
    let root_fwd = workspace_root.replace('\\', "/");
    let normalized_root = if root_fwd.ends_with('/') { root_fwd } else { format!("{}/", root_fwd) };

    if path_fwd.starts_with(&normalized_root) {
        path_fwd[normalized_root.len()..].to_string()
    } else {
        path_fwd
    }
}

/// Core hashing function using xxh3-128.
/// Produces a 32-character hex string (128-bit hash).
fn hash_bytes(data: &[u8]) -> String {
    let h = xxh3_128(data);
    hex::encode(h.to_be_bytes())
}

/// Read a file and hash its contents, returning a deterministic
/// sentinel hash if the read fails. Previously the read error was
/// swallowed via `.ok()?` in a `filter_map`, silently dropping the
/// file from the hash batch — which made cache keys non-deterministic
/// in the face of transient races (parallel write, broken symlink,
/// permission denied). The sentinel is keyed off the absolute path so
/// two unreadable files still produce distinct hashes; the constant
/// prefix lets a careful reader distinguish "could not read" from a
/// successful xxh3-128 hash, which is always 32 hex chars.
fn read_and_hash(file_path: &Path) -> String {
    match fs::read(file_path) {
        Ok(content) => hash_bytes(&content),
        Err(_) => {
            let path_bytes = file_path.to_string_lossy();
            let h = xxh3_128(path_bytes.as_bytes());
            format!("ERR:{}", hex::encode(h.to_be_bytes()))
        }
    }
}

/// Computes an xxh3-128 hash from a string.
/// Useful for hashing command strings, JSON, etc.
#[napi(catch_unwind)]
pub fn hash_string(input: String) -> String {
    hash_bytes(input.as_bytes())
}

/// Computes a combined xxh3-128 hash from multiple strings.
/// Strings are concatenated and hashed, producing a single deterministic hash.
#[napi(catch_unwind)]
pub fn hash_strings(inputs: Vec<String>) -> String {
    let mut combined = Vec::new();
    for input in &inputs {
        combined.extend_from_slice(input.as_bytes());
    }
    hash_bytes(&combined)
}

pub(crate) mod hex {
    const HEX_CHARS: &[u8; 16] = b"0123456789abcdef";

    pub fn encode(bytes: impl AsRef<[u8]>) -> String {
        let bytes = bytes.as_ref();
        let mut result = String::with_capacity(bytes.len() * 2);
        for &byte in bytes {
            result.push(HEX_CHARS[(byte >> 4) as usize] as char);
            result.push(HEX_CHARS[(byte & 0x0f) as usize] as char);
        }
        result
    }
}
