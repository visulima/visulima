use napi_derive::napi;
use std::fs;
use std::path::{Path, PathBuf};

#[napi(object, object_from_js = false)]
pub struct DetectedPackageManager {
    /// The package manager name: "pnpm", "npm", "yarn", "bun", or "deno"
    pub name: String,
    /// The version string from packageManager field, or None if unknown
    pub version: Option<String>,
    /// Build metadata (sha256 hash) appended to packageManager field by
    /// corepack. `parts[1].split('+').next()` strips it from `version`;
    /// this field preserves it for callers that want to verify the pin.
    pub build_meta: Option<String>,
    /// Whether this is a monorepo/workspace
    pub is_workspace: bool,
}

/// Internal result from detection helpers -- uses &'static str to avoid allocations.
struct PmInfo {
    name: &'static str,
    version: Option<String>,
    /// Build metadata (e.g. corepack-style integrity hash). Preserved
    /// only by the packageManager-field path; lockfile/config-file
    /// fallbacks have no version, hence no build_meta.
    build_meta: Option<String>,
    /// Cached package.json content if already parsed
    pkg_json: Option<serde_json::Value>,
}

/// Options controlling which detection sources to consult.
///
/// Matches nypm's `detectPackageManager` opts. All flags are
/// `Option<bool>` so callers can omit them; `None` is treated as the
/// default (use the source). Mirrors the JS-side ergonomics where
/// `{}` enables every source.
#[napi(object)]
#[derive(Default)]
pub struct DetectPackageManagerOptions {
    /// Skip reading the `packageManager` field in package.json.
    pub ignore_package_json: Option<bool>,
    /// Skip lockfile walk (pnpm-lock.yaml, yarn.lock, …).
    pub ignore_lock_file: Option<bool>,
    /// Skip the `npm_config_user_agent` env-var fallback. Set by every
    /// PM when running scripts; lets a tool spawned from `pnpm run x`
    /// know it's pnpm even without a lockfile.
    pub ignore_argv: Option<bool>,
}

fn flag(opt: Option<bool>) -> bool {
    opt.unwrap_or(false)
}

/// Detects the package manager for the project at the given path.
/// Priority: packageManager field > lockfiles > config files >
/// `npm_config_user_agent` env var > default (pnpm).
///
/// `opts` lets callers skip individual sources. `None` opts default
/// to "use the source".
///
/// Returns `napi::Result` so any I/O errors surface as JS exceptions.
#[napi(catch_unwind)]
pub fn detect_package_manager(
    cwd: String,
    opts: Option<DetectPackageManagerOptions>,
) -> napi::Result<DetectedPackageManager> {
    let path = PathBuf::from(&cwd);
    let opts = opts.unwrap_or_default();

    // Priority 1: packageManager field in package.json
    if !flag(opts.ignore_package_json) {
        if let Some(info) = detect_from_package_json(&path) {
            let is_workspace = detect_workspace(&path, info.name, info.pkg_json.as_ref());
            return Ok(DetectedPackageManager {
                name: info.name.to_string(),
                version: info.version,
                build_meta: info.build_meta,
                is_workspace,
            });
        }
    }

    // Priority 2: Walk up to find lockfiles
    if !flag(opts.ignore_lock_file) {
        let mut current = path.clone();
        loop {
            if let Some(info) = detect_from_lockfiles(&current) {
                let is_workspace = detect_workspace(&current, info.name, None);
                return Ok(DetectedPackageManager {
                    name: info.name.to_string(),
                    version: None,
                    build_meta: None,
                    is_workspace,
                });
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
            return Ok(DetectedPackageManager {
                name: info.name.to_string(),
                version: None,
                build_meta: None,
                is_workspace,
            });
        }

        if !current.pop() {
            break;
        }
    }

    // Priority 4: npm_config_user_agent env var. Every PM sets this
    // when running scripts (`<pm>/<version> npm/? node/<v> <os> <arch>`),
    // so a child process invoked from `pnpm run x` can still identify
    // its parent even when the workspace has no lockfile yet.
    if !flag(opts.ignore_argv) {
        if let Some(info) = detect_from_user_agent() {
            let is_workspace = detect_workspace(&path, info.name, None);
            return Ok(DetectedPackageManager {
                name: info.name.to_string(),
                version: info.version,
                build_meta: None,
                is_workspace,
            });
        }
    }

    // Default: pnpm
    let is_workspace = detect_workspace(&path, "pnpm", None);
    Ok(DetectedPackageManager {
        name: "pnpm".to_string(),
        version: None,
        build_meta: None,
        is_workspace,
    })
}

fn detect_from_package_json(dir: &Path) -> Option<PmInfo> {
    let pkg_path = dir.join("package.json");
    let content = fs::read_to_string(pkg_path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;

    let pm_field = json.get("packageManager")?.as_str()?;
    let parts: Vec<&str> = pm_field.splitn(2, '@').collect();

    if parts.len() == 2 {
        // `<name>@<version>[+<sha>]` — corepack appends `+sha256-...` to
        // the version. Split once on `+` so the trailing SHA goes to
        // `build_meta` instead of being silently discarded.
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
    // pnpm-workspace.yaml is a workspace config, not a lockfile,
    // but it is the strongest signal for pnpm usage.
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

/// Parse `npm_config_user_agent` to derive the running PM. Format set
/// by every supported PM looks like `<pm>/<version> npm/? node/<v>
/// <os> <arch>`. We only care about the `<pm>/<version>` head.
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

    Some(PmInfo {
        name,
        version: raw_version.map(String::from),
        build_meta: None,
        pkg_json: None,
    })
}

/// Detects if the project is a workspace/monorepo.
/// Reuses already-parsed package.json when available to avoid double reads.
fn detect_workspace(dir: &Path, pm: &str, cached_pkg: Option<&serde_json::Value>) -> bool {
    match pm {
        "pnpm" => dir.join("pnpm-workspace.yaml").exists(),
        "deno" => detect_deno_workspace(dir),
        _ => {
            // Use cached package.json if available
            if let Some(json) = cached_pkg {
                return json.get("workspaces").is_some();
            }

            // Otherwise read from disk
            let pkg_path = dir.join("package.json");
            if let Ok(content) = fs::read_to_string(pkg_path) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    return json.get("workspaces").is_some();
                }
            }
            false
        }
    }
}

/// Deno reads its workspace declaration from a top-level `workspace`
/// array in `deno.json` / `deno.jsonc`. Tolerant of either filename
/// and treats parse errors as "not a workspace" (mirrors the
/// pnpm/npm fallthrough).
fn detect_deno_workspace(dir: &Path) -> bool {
    for file in &["deno.json", "deno.jsonc"] {
        let path = dir.join(file);
        if let Ok(content) = fs::read_to_string(&path) {
            // serde_json doesn't accept JSONC comments. For the
            // common case `deno.json`, this parses fine; for
            // `deno.jsonc`, we fall back to a substring sniff so a
            // trailing-comment workspace declaration still counts.
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
