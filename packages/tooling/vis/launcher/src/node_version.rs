//! Cheap, cached Node version detection.
//!
//! Two launcher features need the Node version: the `x` preload path (entry
//! interception via `module.registerHooks` needs Node >= 22.15) and the unflag
//! feature matrix (version-keyed flags). Probing it costs a `node -v` spawn, so we
//! cache the result on disk keyed by the node binary's path + mtime — a Node
//! upgrade changes the mtime and invalidates the cache, but the steady state is
//! one stat() and a small file read, no spawn.

use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::UNIX_EPOCH;

/// A parsed `major.minor.patch`. Only major/minor are compared in practice.
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct NodeVersion {
    pub major: u32,
    pub minor: u32,
    pub patch: u32,
}

impl NodeVersion {
    /// True when this version has synchronous `module.registerHooks` (Node 22.15+
    /// on the 22 line, or any 23+). The 22.14.x floor lacks it.
    pub fn has_register_hooks(self) -> bool {
        if self.major == 22 {
            self.minor >= 15
        } else {
            self.major > 22
        }
    }

    fn parse(text: &str) -> Option<NodeVersion> {
        // Accepts "v24.15.0" or "24.15.0".
        let trimmed = text.trim().trim_start_matches('v');
        let mut parts = trimmed.split('.');
        let major = parts.next()?.parse().ok()?;
        let minor = parts.next()?.parse().ok()?;
        // Patch may carry a pre-release suffix ("0-nightly..."); take the leading digits.
        let patch = parts
            .next()
            .map(|raw| raw.split(|c: char| !c.is_ascii_digit()).next().unwrap_or("0"))
            .unwrap_or("0")
            .parse()
            .unwrap_or(0);

        Some(NodeVersion { major, minor, patch })
    }
}

/// Resolve `node_bin` to an absolute path: returned as-is if it already is one or
/// contains a separator, otherwise searched on `PATH`. Needed so the cache key
/// (path + mtime) is stable — `fs::metadata("node")` on the bare command fails.
fn resolve_bin(node_bin: &str) -> PathBuf {
    let candidate = PathBuf::from(node_bin);

    if candidate.is_absolute() || node_bin.contains(std::path::MAIN_SEPARATOR) {
        return candidate;
    }

    if let Some(paths) = env::var_os("PATH") {
        for dir in env::split_paths(&paths) {
            let full = dir.join(node_bin);

            if full.is_file() {
                return full;
            }
        }
    }

    candidate
}

/// Resolve the node binary's mtime (seconds since epoch), for cache keying.
fn node_mtime(node_bin: &str) -> Option<u64> {
    let modified = fs::metadata(resolve_bin(node_bin)).ok()?.modified().ok()?;

    modified.duration_since(UNIX_EPOCH).ok().map(|d| d.as_secs())
}

fn cache_path() -> Option<PathBuf> {
    // ~/.vis/cache/node-version. HOME on unix, USERPROFILE on windows.
    let home = env::var("HOME").or_else(|_| env::var("USERPROFILE")).ok()?;
    let mut path = PathBuf::from(home);

    path.push(".vis");
    path.push("cache");
    path.push("node-version");

    Some(path)
}

/// Cache line format: `<mtime> <major.minor.patch>` (single line). Returns the
/// cached version only if the stored mtime still matches `node_bin`'s.
fn read_cache(node_bin: &str) -> Option<NodeVersion> {
    let current_mtime = node_mtime(node_bin)?;
    let contents = fs::read_to_string(cache_path()?).ok()?;
    let mut parts = contents.split_whitespace();
    let stored_mtime: u64 = parts.next()?.parse().ok()?;

    if stored_mtime != current_mtime {
        return None;
    }

    NodeVersion::parse(parts.next()?)
}

fn write_cache(node_bin: &str, version: NodeVersion) {
    if let (Some(mtime), Some(path)) = (node_mtime(node_bin), cache_path()) {
        if let Some(dir) = path.parent() {
            let _ = fs::create_dir_all(dir);
        }

        let line = format!("{} {}.{}.{}", mtime, version.major, version.minor, version.patch);
        let _ = fs::write(path, line);
    }
}

/// Detect the Node version for `node_bin`, using the disk cache when valid. Returns
/// `None` if node can't be run or its output can't be parsed (callers then take the
/// conservative path — e.g. delegate `x` to the JS CLI).
pub fn detect(node_bin: &str) -> Option<NodeVersion> {
    if let Some(cached) = read_cache(node_bin) {
        return Some(cached);
    }

    let output = Command::new(node_bin).arg("--version").output().ok()?;

    if !output.status.success() {
        return None;
    }

    let version = NodeVersion::parse(&String::from_utf8_lossy(&output.stdout))?;

    write_cache(node_bin, version);

    Some(version)
}

#[cfg(test)]
mod tests {
    use super::NodeVersion;

    #[test]
    fn parses_and_gates_register_hooks() {
        assert!(NodeVersion::parse("v24.15.0").unwrap().has_register_hooks());
        assert!(NodeVersion::parse("22.15.0").unwrap().has_register_hooks());
        assert!(!NodeVersion::parse("v22.14.0").unwrap().has_register_hooks());
        assert!(NodeVersion::parse("v23.0.0").unwrap().has_register_hooks());

        let v = NodeVersion::parse("v22.14.0").unwrap();
        assert_eq!((v.major, v.minor, v.patch), (22, 14, 0));
        // pre-release patch suffix tolerated
        assert_eq!(NodeVersion::parse("v25.0.0-nightly").unwrap().patch, 0);
    }
}
