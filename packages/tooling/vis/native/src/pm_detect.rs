use napi_derive::napi;
use std::fs;
use std::path::{Path, PathBuf};

#[napi(object, object_from_js = false)]
pub struct DetectedPackageManager {
    /// The package manager name: "pnpm", "npm", "yarn", or "bun"
    pub name: String,
    /// The version string from packageManager field, or None if unknown
    pub version: Option<String>,
    /// Whether this is a monorepo/workspace
    pub is_workspace: bool,
}

/// Internal result from detection helpers -- uses &'static str to avoid allocations.
struct PmInfo {
    name: &'static str,
    version: Option<String>,
    /// Cached package.json content if already parsed
    pkg_json: Option<serde_json::Value>,
}

/// Detects the package manager for the project at the given path.
/// Priority: packageManager field > lockfiles > config files > default (pnpm)
///
/// Returns `napi::Result` so any I/O errors surface as JS exceptions.
#[napi(catch_unwind)]
pub fn detect_package_manager(cwd: String) -> napi::Result<DetectedPackageManager> {
    let path = PathBuf::from(&cwd);

    // Priority 1: packageManager field in package.json
    if let Some(info) = detect_from_package_json(&path) {
        let is_workspace = detect_workspace(&path, info.name, info.pkg_json.as_ref());
        return Ok(DetectedPackageManager {
            name: info.name.to_string(),
            version: info.version,
            is_workspace,
        });
    }

    // Priority 2: Walk up to find lockfiles
    let mut current = path.clone();
    loop {
        if let Some(info) = detect_from_lockfiles(&current) {
            let is_workspace = detect_workspace(&current, info.name, None);
            return Ok(DetectedPackageManager {
                name: info.name.to_string(),
                version: None,
                is_workspace,
            });
        }

        if !current.pop() {
            break;
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
                is_workspace,
            });
        }

        if !current.pop() {
            break;
        }
    }

    // Default: pnpm
    let is_workspace = detect_workspace(&path, "pnpm", None);
    Ok(DetectedPackageManager {
        name: "pnpm".to_string(),
        version: None,
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
        let version = parts[1].split('+').next().map(String::from);
        let name: &'static str = match parts[0] {
            "pnpm" => "pnpm",
            "npm" => "npm",
            "yarn" => "yarn",
            "bun" => "bun",
            _ => return None,
        };

        Some(PmInfo { name, version, pkg_json: Some(json) })
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
    ];

    for (file, pm) in checks {
        if dir.join(file).exists() {
            return Some(PmInfo { name: pm, version: None, pkg_json: None });
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
    ];

    for (file, pm) in checks {
        if dir.join(file).exists() {
            return Some(PmInfo { name: pm, version: None, pkg_json: None });
        }
    }

    None
}

/// Detects if the project is a workspace/monorepo.
/// Reuses already-parsed package.json when available to avoid double reads.
fn detect_workspace(dir: &Path, pm: &str, cached_pkg: Option<&serde_json::Value>) -> bool {
    match pm {
        "pnpm" => dir.join("pnpm-workspace.yaml").exists(),
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
