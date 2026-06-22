//! Package-manager detection. De-napi'd copy of the addon's `pm_detect.rs`
//! (keep in sync). Priority: packageManager field > lockfiles > config files >
//! `npm_config_user_agent` env var > default (pnpm).

use std::fs;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug)]
pub struct DetectedPackageManager {
    /// The package manager name: "pnpm", "npm", "yarn", "bun", or "deno".
    pub name: String,
    /// The version string from the packageManager field, or None if unknown.
    pub version: Option<String>,
    /// Build metadata (sha256 hash) appended to packageManager by corepack.
    pub build_meta: Option<String>,
    /// Whether this is a monorepo/workspace.
    pub is_workspace: bool,
}

/// Internal result from detection helpers -- uses &'static str to avoid allocations.
struct PmInfo {
    name: &'static str,
    version: Option<String>,
    build_meta: Option<String>,
    pkg_json: Option<serde_json::Value>,
}

/// Options controlling which detection sources to consult. All flags are
/// `Option<bool>` so callers can omit them; `None` is treated as the default
/// (use the source).
#[derive(Default)]
pub struct DetectPackageManagerOptions {
    pub ignore_package_json: Option<bool>,
    pub ignore_lock_file: Option<bool>,
    pub ignore_argv: Option<bool>,
}

fn flag(opt: Option<bool>) -> bool {
    opt.unwrap_or(false)
}

/// Detects the package manager for the project at the given path.
pub fn detect_package_manager(cwd: &str, opts: Option<DetectPackageManagerOptions>) -> DetectedPackageManager {
    let path = PathBuf::from(cwd);
    let opts = opts.unwrap_or_default();

    // Priority 1: packageManager field in package.json
    if !flag(opts.ignore_package_json) {
        if let Some(info) = detect_from_package_json(&path) {
            let is_workspace = detect_workspace(&path, info.name, info.pkg_json.as_ref());

            return DetectedPackageManager {
                name: info.name.to_string(),
                version: info.version,
                build_meta: info.build_meta,
                is_workspace,
            };
        }
    }

    // Priority 2: Walk up to find lockfiles
    if !flag(opts.ignore_lock_file) {
        let mut current = path.clone();

        loop {
            if let Some(info) = detect_from_lockfiles(&current) {
                let is_workspace = detect_workspace(&current, info.name, None);

                return DetectedPackageManager {
                    name: info.name.to_string(),
                    version: None,
                    build_meta: None,
                    is_workspace,
                };
            }

            if !current.pop() {
                break;
            }
        }
    }

    // Priority 3: Config files (walk up like lockfiles)
    let mut current = path.clone();

    loop {
        if let Some(info) = detect_from_config_files(&current) {
            let is_workspace = detect_workspace(&current, info.name, None);

            return DetectedPackageManager {
                name: info.name.to_string(),
                version: None,
                build_meta: None,
                is_workspace,
            };
        }

        if !current.pop() {
            break;
        }
    }

    // Priority 4: npm_config_user_agent env var
    if !flag(opts.ignore_argv) {
        if let Some(info) = detect_from_user_agent() {
            let is_workspace = detect_workspace(&path, info.name, None);

            return DetectedPackageManager {
                name: info.name.to_string(),
                version: info.version,
                build_meta: None,
                is_workspace,
            };
        }
    }

    // Default: pnpm
    let is_workspace = detect_workspace(&path, "pnpm", None);

    DetectedPackageManager { name: "pnpm".to_string(), version: None, build_meta: None, is_workspace }
}

/// Resolve the *pinned* package manager for the PM guard: walk upward and return
/// the first explicit pin — a `package.json#packageManager` field or a lockfile —
/// or None when nothing pins one (no default, unlike `detect_package_manager`).
/// Shared with `pm_shim` so the guard and the rest of the CLI agree on the
/// detection sources (parser + lockfile set).
pub fn pinned_package_manager(cwd: &str) -> Option<String> {
    let mut current = Some(PathBuf::from(cwd));

    while let Some(directory) = current {
        if let Some(info) = detect_from_package_json(&directory) {
            return Some(info.name.to_string());
        }

        if let Some(info) = detect_from_lockfiles(&directory) {
            return Some(info.name.to_string());
        }

        current = directory.parent().map(Path::to_path_buf).filter(|parent| parent != &directory);
    }

    None
}

fn detect_from_package_json(dir: &Path) -> Option<PmInfo> {
    let content = fs::read_to_string(dir.join("package.json")).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;

    let pm_field = json.get("packageManager")?.as_str()?;
    let parts: Vec<&str> = pm_field.splitn(2, '@').collect();

    if parts.len() == 2 {
        let mut ver_iter = parts[1].splitn(2, '+');
        let version = ver_iter.next().map(String::from);
        let build_meta = ver_iter.next().map(String::from);
        let name: &'static str = match parts[0] {
            "pnpm" => "pnpm",
            "npm" => "npm",
            "yarn" => "yarn",
            "bun" => "bun",
            "deno" => "deno",
            _ => return None,
        };

        Some(PmInfo { name, version, build_meta, pkg_json: Some(json) })
    } else {
        None
    }
}

fn detect_from_lockfiles(dir: &Path) -> Option<PmInfo> {
    let checks: &[(&str, &'static str)] = &[
        ("pnpm-workspace.yaml", "pnpm"),
        ("pnpm-lock.yaml", "pnpm"),
        ("yarn.lock", "yarn"),
        (".yarnrc.yml", "yarn"),
        ("package-lock.json", "npm"),
        ("npm-shrinkwrap.json", "npm"),
        ("bun.lock", "bun"),
        ("bun.lockb", "bun"),
        ("deno.lock", "deno"),
    ];

    for (file, pm) in checks {
        if dir.join(file).exists() {
            return Some(PmInfo { name: pm, version: None, build_meta: None, pkg_json: None });
        }
    }

    None
}

fn detect_from_config_files(dir: &Path) -> Option<PmInfo> {
    let checks: &[(&str, &'static str)] = &[
        (".pnpmfile.cjs", "pnpm"),
        ("pnpmfile.cjs", "pnpm"),
        ("bunfig.toml", "bun"),
        ("yarn.config.cjs", "yarn"),
        ("deno.json", "deno"),
        ("deno.jsonc", "deno"),
    ];

    for (file, pm) in checks {
        if dir.join(file).exists() {
            return Some(PmInfo { name: pm, version: None, build_meta: None, pkg_json: None });
        }
    }

    None
}

/// Parse `npm_config_user_agent` to derive the running PM
/// (`<pm>/<version> npm/? node/<v> <os> <arch>`).
fn detect_from_user_agent() -> Option<PmInfo> {
    let ua = std::env::var("npm_config_user_agent").ok()?;
    let head = ua.split_whitespace().next()?;
    let mut parts = head.splitn(2, '/');
    let raw_name = parts.next()?;
    let raw_version = parts.next();

    let name: &'static str = match raw_name {
        "pnpm" => "pnpm",
        "npm" => "npm",
        "yarn" => "yarn",
        "bun" => "bun",
        "deno" => "deno",
        _ => return None,
    };

    Some(PmInfo { name, version: raw_version.map(String::from), build_meta: None, pkg_json: None })
}

/// Detects if the project is a workspace/monorepo. Reuses already-parsed
/// package.json when available to avoid double reads.
fn detect_workspace(dir: &Path, pm: &str, cached_pkg: Option<&serde_json::Value>) -> bool {
    match pm {
        "pnpm" => dir.join("pnpm-workspace.yaml").exists(),
        "deno" => detect_deno_workspace(dir),
        _ => {
            if let Some(json) = cached_pkg {
                return json.get("workspaces").is_some();
            }

            if let Ok(content) = fs::read_to_string(dir.join("package.json")) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    return json.get("workspaces").is_some();
                }
            }

            false
        }
    }
}

/// Deno reads its workspace declaration from a top-level `workspace` array in
/// `deno.json` / `deno.jsonc`.
fn detect_deno_workspace(dir: &Path) -> bool {
    for file in &["deno.json", "deno.jsonc"] {
        if let Ok(content) = fs::read_to_string(dir.join(file)) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if json.get("workspace").is_some() {
                    return true;
                }
            } else if content.contains("\"workspace\"") {
                return true;
            }
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::{detect_package_manager, DetectPackageManagerOptions};

    fn ignore_env() -> Option<DetectPackageManagerOptions> {
        // Tests must not pick up the ambient npm_config_user_agent of the runner.
        Some(DetectPackageManagerOptions { ignore_argv: Some(true), ..Default::default() })
    }

    #[test]
    fn defaults_to_pnpm_with_no_signals() {
        let dir = std::env::temp_dir().join(format!("vis-core-detect-default-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();

        let detected = detect_package_manager(dir.to_str().unwrap(), ignore_env());

        std::fs::remove_dir_all(&dir).ok();

        assert_eq!(detected.name, "pnpm");
        assert_eq!(detected.version, None);
    }

    #[test]
    fn reads_package_manager_field_with_build_meta() {
        let dir = std::env::temp_dir().join(format!("vis-core-detect-pm-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("package.json"), "{\"packageManager\":\"yarn@4.1.0+sha256.abc\"}").unwrap();

        let detected = detect_package_manager(dir.to_str().unwrap(), ignore_env());

        std::fs::remove_dir_all(&dir).ok();

        assert_eq!(detected.name, "yarn");
        assert_eq!(detected.version.as_deref(), Some("4.1.0"));
        assert_eq!(detected.build_meta.as_deref(), Some("sha256.abc"));
    }

    #[test]
    fn pinned_package_manager_returns_none_without_a_pin() {
        use super::pinned_package_manager;

        let dir = std::env::temp_dir().join(format!("vis-core-pinned-none-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("package.json"), "{\"name\":\"x\"}").unwrap();

        let pinned = pinned_package_manager(dir.to_str().unwrap());

        std::fs::remove_dir_all(&dir).ok();

        // No packageManager field and no lockfile in this isolated temp dir -> no pin.
        assert_eq!(pinned, None);
    }

    #[test]
    fn pinned_package_manager_reads_lockfile() {
        use super::pinned_package_manager;

        let dir = std::env::temp_dir().join(format!("vis-core-pinned-lock-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("yarn.lock"), "# yarn\n").unwrap();

        let pinned = pinned_package_manager(dir.to_str().unwrap());

        std::fs::remove_dir_all(&dir).ok();

        assert_eq!(pinned.as_deref(), Some("yarn"));
    }

    #[test]
    fn detects_pnpm_from_lockfile() {
        let dir = std::env::temp_dir().join(format!("vis-core-detect-lock-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("pnpm-lock.yaml"), "lockfileVersion: 9\n").unwrap();

        let detected = detect_package_manager(dir.to_str().unwrap(), ignore_env());

        std::fs::remove_dir_all(&dir).ok();

        assert_eq!(detected.name, "pnpm");
    }
}
