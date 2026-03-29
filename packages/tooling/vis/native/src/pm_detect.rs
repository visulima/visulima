use napi_derive::napi;
use std::fs;
use std::path::{Path, PathBuf};

#[napi(object)]
pub struct DetectedPackageManager {
    /// The package manager name: "pnpm", "npm", "yarn", or "bun"
    pub name: String,
    /// The version string (from packageManager field or "latest")
    pub version: String,
    /// Whether this is a monorepo/workspace
    pub is_workspace: bool,
}

/// Detects the package manager for the project at the given path.
/// Priority: packageManager field > lockfiles > config files > default (pnpm)
#[napi]
pub fn detect_package_manager(cwd: String) -> DetectedPackageManager {
    let path = PathBuf::from(&cwd);

    // Priority 1: packageManager field in package.json
    if let Some(result) = detect_from_package_json(&path) {
        let is_workspace = detect_workspace(&path, &result.name);
        return DetectedPackageManager {
            name: result.name,
            version: result.version,
            is_workspace,
        };
    }

    // Priority 2: Walk up to find lockfiles
    let mut current = path.clone();
    loop {
        if let Some(result) = detect_from_lockfiles(&current) {
            let is_workspace = detect_workspace(&current, &result.name);
            return DetectedPackageManager {
                name: result.name,
                version: result.version,
                is_workspace,
            };
        }

        if !current.pop() {
            break;
        }
    }

    // Priority 3: Config files
    if let Some(result) = detect_from_config_files(&path) {
        let is_workspace = detect_workspace(&path, &result.name);
        return DetectedPackageManager {
            name: result.name,
            version: result.version,
            is_workspace,
        };
    }

    // Default: pnpm
    let is_workspace = detect_workspace(&path, "pnpm");
    DetectedPackageManager {
        name: "pnpm".to_string(),
        version: "latest".to_string(),
        is_workspace,
    }
}

struct PmInfo {
    name: String,
    version: String,
}

fn detect_from_package_json(dir: &Path) -> Option<PmInfo> {
    let pkg_path = dir.join("package.json");
    let content = fs::read_to_string(pkg_path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;

    let pm_field = json.get("packageManager")?.as_str()?;
    let parts: Vec<&str> = pm_field.splitn(2, '@').collect();

    if parts.len() == 2 {
        let name = parts[0].to_string();
        // Strip any +hash suffix from version
        let version = parts[1].split('+').next().unwrap_or("latest").to_string();

        match name.as_str() {
            "pnpm" | "npm" | "yarn" | "bun" => Some(PmInfo { name, version }),
            _ => None,
        }
    } else {
        None
    }
}

fn detect_from_lockfiles(dir: &Path) -> Option<PmInfo> {
    let checks: &[(&str, &str)] = &[
        ("pnpm-workspace.yaml", "pnpm"),
        ("pnpm-lock.yaml", "pnpm"),
        ("yarn.lock", "yarn"),
        (".yarnrc.yml", "yarn"),
        ("package-lock.json", "npm"),
        ("bun.lock", "bun"),
        ("bun.lockb", "bun"),
    ];

    for (file, pm) in checks {
        if dir.join(file).exists() {
            return Some(PmInfo {
                name: pm.to_string(),
                version: "latest".to_string(),
            });
        }
    }

    None
}

fn detect_from_config_files(dir: &Path) -> Option<PmInfo> {
    let checks: &[(&str, &str)] = &[
        (".pnpmfile.cjs", "pnpm"),
        ("pnpmfile.cjs", "pnpm"),
        ("bunfig.toml", "bun"),
        ("yarn.config.cjs", "yarn"),
    ];

    for (file, pm) in checks {
        if dir.join(file).exists() {
            return Some(PmInfo {
                name: pm.to_string(),
                version: "latest".to_string(),
            });
        }
    }

    None
}

fn detect_workspace(dir: &Path, pm: &str) -> bool {
    match pm {
        "pnpm" => dir.join("pnpm-workspace.yaml").exists(),
        _ => {
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
