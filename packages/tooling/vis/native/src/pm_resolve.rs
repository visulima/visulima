use napi::bindgen_prelude::*;
use napi_derive::napi;

#[napi(object, object_from_js = false)]
pub struct ResolvedCommand {
    pub bin: String,
    pub args: Vec<String>,
    pub warnings: Vec<String>,
}

/// Validates that the PM name is one of the supported values.
fn validate_pm(pm: &str) -> napi::Result<()> {
    match pm {
        "pnpm" | "npm" | "yarn" | "bun" => Ok(()),
        _ => Err(Error::new(
            Status::InvalidArg,
            format!("Unsupported package manager: '{pm}'. Supported: pnpm, npm, yarn, bun"),
        )),
    }
}

/// Parses the leading integer from a version string (e.g. "11.0.0-rc.0" -> Some(11)).
/// Returns `None` when the version string does not start with a decimal digit
/// (e.g. "latest", "workspace:*").
fn parse_major(version: &str) -> Option<u32> {
    let end = version.find(|c: char| !c.is_ascii_digit()).unwrap_or(version.len());
    version[..end].parse::<u32>().ok()
}

/// Returns `Some(true)` when the pnpm major version is >= 11, `Some(false)`
/// when it is < 11, and `None` when the version string cannot be parsed
/// (e.g. "latest").
fn is_pnpm_v11_plus(version: &str) -> Option<bool> {
    parse_major(version).map(|major| major >= 11)
}

// ── Install ──────────────────────────────────────────────────────────

#[napi(object)]
pub struct InstallOptions {
    pub frozen_lockfile: bool,
    pub prod: bool,
    pub dev: bool,
    pub no_optional: bool,
    pub force: bool,
    pub ignore_scripts: bool,
    pub lockfile_only: bool,
    pub offline: bool,
    pub silent: bool,
    pub recursive: bool,
    pub workspace_root: bool,
    pub filter: Vec<String>,
}

#[napi(catch_unwind)]
pub fn resolve_install(pm: String, version: String, opts: InstallOptions) -> napi::Result<ResolvedCommand> {
    validate_pm(&pm)?;
    let mut args = Vec::new();
    let mut warnings = Vec::new();

    match pm.as_str() {
        "pnpm" => {
            for f in &opts.filter {
                args.push("--filter".into());
                args.push(f.clone());
            }
            if opts.workspace_root {
                args.push("-w".into());
            }
            args.push("install".into());
            if opts.frozen_lockfile {
                args.push("--frozen-lockfile".into());
            }
            if opts.prod {
                args.push("--prod".into());
            }
            if opts.dev {
                args.push("--dev".into());
            }
            if opts.no_optional {
                args.push("--no-optional".into());
            }
            if opts.force {
                args.push("--force".into());
            }
            if opts.ignore_scripts {
                args.push("--ignore-scripts".into());
            }
            if opts.lockfile_only {
                args.push("--lockfile-only".into());
            }
            if opts.offline {
                args.push("--offline".into());
            }
            if opts.silent {
                args.push("--silent".into());
            }
        }
        "npm" => {
            if opts.frozen_lockfile && opts.lockfile_only {
                warnings.push("npm ci and --package-lock-only are contradictory. Using ci.".into());
            }
            args.push(if opts.frozen_lockfile { "ci".into() } else { "install".into() });
            if opts.prod {
                args.push("--omit=dev".into());
            }
            if opts.no_optional {
                args.push("--omit=optional".into());
            }
            for f in &opts.filter {
                args.push("--workspace".into());
                args.push(f.clone());
            }
            if opts.recursive {
                args.push("--workspaces".into());
            }
            if opts.workspace_root {
                args.push("--include-workspace-root".into());
            }
            if opts.ignore_scripts {
                args.push("--ignore-scripts".into());
            }
            if opts.force {
                args.push("--force".into());
            }
            if !opts.frozen_lockfile && opts.lockfile_only {
                args.push("--package-lock-only".into());
            }
            if opts.offline {
                args.push("--offline".into());
            }
            if opts.silent {
                args.push("--loglevel".into());
                args.push("silent".into());
            }
        }
        "yarn" => {
            if version.starts_with("1.") {
                args.push("install".into());
                if opts.frozen_lockfile {
                    args.push("--frozen-lockfile".into());
                }
                if opts.prod {
                    args.push("--production".into());
                }
                if opts.ignore_scripts {
                    args.push("--ignore-scripts".into());
                }
                if opts.force {
                    args.push("--force".into());
                }
                if opts.offline {
                    args.push("--offline".into());
                }
                if opts.silent {
                    args.push("--silent".into());
                }
            } else {
                args.push("install".into());
                if opts.frozen_lockfile {
                    args.push("--immutable".into());
                }
                if opts.ignore_scripts {
                    args.push("--mode".into());
                    args.push("skip-build".into());
                }
                if opts.lockfile_only {
                    args.push("--mode".into());
                    args.push("update-lockfile".into());
                }
                if opts.prod {
                    warnings.push("yarn berry --prod requires .yarnrc.yml configuration.".into());
                }
                if opts.offline {
                    args.push("--cached".into());
                }
            }
        }
        "bun" => {
            args.push("install".into());
            if opts.frozen_lockfile {
                args.push("--frozen-lockfile".into());
            }
            if opts.prod {
                args.push("--production".into());
            }
            if opts.force {
                args.push("--force".into());
            }
            if opts.ignore_scripts {
                args.push("--ignore-scripts".into());
            }
            if opts.no_optional {
                args.push("--no-optional".into());
            }
        }
        _ => unreachable!(), // validate_pm already checked
    }

    Ok(ResolvedCommand { bin: pm, args, warnings })
}

// ── Add ──────────────────────────────────────────────────────────────

#[napi(object)]
pub struct AddOptions {
    pub packages: Vec<String>,
    pub save_dev: bool,
    pub exact: bool,
    pub peer: bool,
    pub optional: bool,
    pub global: bool,
    pub workspace: bool,
    pub workspace_root: bool,
    pub filter: Vec<String>,
}

#[napi(catch_unwind)]
pub fn resolve_add(pm: String, version: String, opts: AddOptions) -> napi::Result<ResolvedCommand> {
    validate_pm(&pm)?;
    let mut args = Vec::new();
    let mut warnings = Vec::new();

    // Global packages use npm exclusively (except bun)
    if opts.global && pm != "bun" {
        args.push("install".into());
        args.push("--global".into());
        if opts.save_dev {
            args.push("--save-dev".into());
        }
        if opts.exact {
            args.push("--save-exact".into());
        }
        args.extend(opts.packages);
        return Ok(ResolvedCommand { bin: "npm".into(), args, warnings });
    }

    match pm.as_str() {
        "pnpm" => {
            for f in &opts.filter {
                args.push("--filter".into());
                args.push(f.clone());
            }
            if opts.workspace_root {
                args.push("-w".into());
            }
            args.push("add".into());
            if opts.save_dev {
                args.push("-D".into());
            }
            if opts.exact {
                args.push("-E".into());
            }
            if opts.peer {
                args.push("--save-peer".into());
            }
            if opts.optional {
                args.push("-O".into());
            }
            if opts.global {
                args.push("-g".into());
            }
            if opts.workspace {
                args.push("--workspace".into());
            }
            args.extend(opts.packages);
        }
        "npm" => {
            args.push("install".into());
            if opts.save_dev {
                args.push("--save-dev".into());
            }
            if opts.exact {
                args.push("--save-exact".into());
            }
            if opts.peer {
                args.push("--save-peer".into());
            }
            if opts.optional {
                args.push("--save-optional".into());
            }
            if opts.global {
                args.push("--global".into());
            }
            for f in &opts.filter {
                args.push("--workspace".into());
                args.push(f.clone());
            }
            if opts.workspace_root {
                args.push("-w".into());
            }
            args.extend(opts.packages);
        }
        "yarn" => {
            if version.starts_with("1.") {
                if opts.global {
                    args.push("global".into());
                }
                if !opts.filter.is_empty() {
                    args.push("workspace".into());
                    args.push(opts.filter[0].clone());
                }
                args.push("add".into());
                if opts.save_dev {
                    args.push("--dev".into());
                }
                if opts.exact {
                    args.push("--exact".into());
                }
                if opts.peer {
                    args.push("--peer".into());
                }
                if opts.optional {
                    args.push("--optional".into());
                }
                if opts.workspace_root {
                    args.push("-W".into());
                }
                args.extend(opts.packages);
            } else {
                if opts.global {
                    warnings.push("yarn berry does not support global packages. Using npm.".into());
                    let mut a = vec!["install".into(), "--global".into()];
                    a.extend(opts.packages);
                    return Ok(ResolvedCommand { bin: "npm".into(), args: a, warnings });
                }
                args.push("add".into());
                if opts.save_dev {
                    args.push("--dev".into());
                }
                if opts.exact {
                    args.push("--exact".into());
                }
                if opts.peer {
                    args.push("--peer".into());
                }
                if opts.optional {
                    args.push("--optional".into());
                }
                args.extend(opts.packages);
            }
        }
        "bun" => {
            args.push("add".into());
            if opts.save_dev {
                args.push("--dev".into());
            }
            if opts.exact {
                args.push("--exact".into());
            }
            if opts.peer {
                args.push("--peer".into());
            }
            if opts.optional {
                args.push("--optional".into());
            }
            if opts.global {
                args.push("--global".into());
            }
            args.extend(opts.packages);
        }
        _ => unreachable!(),
    }

    Ok(ResolvedCommand { bin: pm, args, warnings })
}

// ── Remove ───────────────────────────────────────────────────────────

#[napi(object)]
pub struct RemoveOptions {
    pub packages: Vec<String>,
    pub save_dev: bool,
    pub global: bool,
    pub recursive: bool,
    pub workspace_root: bool,
    pub filter: Vec<String>,
}

#[napi(catch_unwind)]
pub fn resolve_remove(pm: String, version: String, opts: RemoveOptions) -> napi::Result<ResolvedCommand> {
    validate_pm(&pm)?;
    let mut args = Vec::new();
    let warnings = Vec::new();

    if opts.global && pm != "bun" {
        let mut a = vec!["uninstall".into(), "--global".into()];
        a.extend(opts.packages);
        return Ok(ResolvedCommand { bin: "npm".into(), args: a, warnings });
    }

    match pm.as_str() {
        "pnpm" => {
            for f in &opts.filter {
                args.push("--filter".into());
                args.push(f.clone());
            }
            if opts.workspace_root {
                args.push("-w".into());
            }
            args.push("remove".into());
            if opts.save_dev {
                args.push("-D".into());
            }
            if opts.global {
                args.push("-g".into());
            }
            if opts.recursive {
                args.push("--recursive".into());
            }
            args.extend(opts.packages);
        }
        "npm" => {
            args.push("uninstall".into());
            if opts.save_dev {
                args.push("--save-dev".into());
            }
            if opts.global {
                args.push("--global".into());
            }
            for f in &opts.filter {
                args.push("--workspace".into());
                args.push(f.clone());
            }
            if opts.recursive {
                args.push("--workspaces".into());
            }
            if opts.workspace_root {
                args.push("-w".into());
            }
            args.extend(opts.packages);
        }
        "yarn" => {
            if version.starts_with("1.") {
                if !opts.filter.is_empty() {
                    args.push("workspace".into());
                    args.push(opts.filter[0].clone());
                }
                args.push("remove".into());
                args.extend(opts.packages);
            } else {
                if opts.recursive {
                    args.push("workspaces".into());
                    args.push("foreach".into());
                    args.push("--all".into());
                    for f in &opts.filter {
                        args.push("--include".into());
                        args.push(f.clone());
                    }
                }
                args.push("remove".into());
                args.extend(opts.packages);
            }
        }
        "bun" => {
            args.push("remove".into());
            if opts.global {
                args.push("--global".into());
            }
            args.extend(opts.packages);
        }
        _ => unreachable!(),
    }

    Ok(ResolvedCommand { bin: pm, args, warnings })
}

// ── Dedupe ───────────────────────────────────────────────────────────

#[napi(catch_unwind)]
pub fn resolve_dedupe(pm: String, version: String, check: bool) -> napi::Result<ResolvedCommand> {
    validate_pm(&pm)?;
    let mut args = Vec::new();
    let mut warnings = Vec::new();

    match pm.as_str() {
        "pnpm" => {
            args.push("dedupe".into());
            if check {
                args.push("--check".into());
            }
        }
        "npm" => {
            args.push("dedupe".into());
            if check {
                args.push("--dry-run".into());
            }
        }
        "yarn" => {
            if version.starts_with("1.") {
                warnings.push("yarn v1 does not support dedupe. Upgrade to yarn berry (v2+).".into());
                return Ok(ResolvedCommand { bin: "yarn".into(), args: vec!["install".into()], warnings });
            }
            args.push("dedupe".into());
            if check {
                args.push("--check".into());
            }
        }
        "bun" => {
            warnings.push("bun does not support dedupe operations.".into());
            return Ok(ResolvedCommand { bin: "bun".into(), args: vec!["install".into()], warnings });
        }
        _ => unreachable!(),
    }

    Ok(ResolvedCommand { bin: pm, args, warnings })
}

// ── Why ──────────────────────────────────────────────────────────────

#[napi(object)]
pub struct WhyOptions {
    pub packages: Vec<String>,
    pub json: bool,
    pub long: bool,
    pub parseable: bool,
    pub recursive: bool,
    pub dev: bool,
    pub prod: bool,
    pub no_optional: bool,
    pub global: bool,
    /// Depth limit. Uses Option<i32> directly (napi supports it).
    pub depth: Option<i32>,
    pub filter: Vec<String>,
}

#[napi(catch_unwind)]
pub fn resolve_why(pm: String, version: String, opts: WhyOptions) -> napi::Result<ResolvedCommand> {
    validate_pm(&pm)?;
    let mut args = Vec::new();
    let mut warnings = Vec::new();

    match pm.as_str() {
        "pnpm" => {
            for f in &opts.filter {
                args.push("--filter".into());
                args.push(f.clone());
            }
            args.push("why".into());
            if opts.json {
                args.push("--json".into());
            }
            if opts.long {
                args.push("--long".into());
            }
            if opts.parseable {
                args.push("--parseable".into());
            }
            if opts.recursive {
                args.push("--recursive".into());
            }
            if opts.dev {
                args.push("--dev".into());
            }
            if opts.prod {
                args.push("--prod".into());
            }
            if opts.no_optional {
                args.push("--no-optional".into());
            }
            if opts.global {
                args.push("--global".into());
            }
            if let Some(d) = opts.depth {
                args.push("--depth".into());
                args.push(d.to_string());
            }
            args.extend(opts.packages);
        }
        "npm" => {
            args.push("explain".into());
            if opts.json {
                args.push("--json".into());
            }
            for f in &opts.filter {
                args.push("--workspace".into());
                args.push(f.clone());
            }
            if opts.long {
                warnings.push("npm does not support --long for explain.".into());
            }
            args.extend(opts.packages);
        }
        "yarn" => {
            args.push("why".into());
            if version.starts_with("1.") {
                if opts.packages.len() > 1 {
                    warnings.push("yarn v1 only supports querying one package at a time.".into());
                }
                if let Some(p) = opts.packages.first() {
                    args.push(p.clone());
                }
            } else {
                if opts.recursive {
                    args.push("-R".into());
                }
                args.extend(opts.packages);
            }
            if opts.json {
                args.push("--json".into());
            }
        }
        "bun" => {
            args.push("why".into());
            if let Some(d) = opts.depth {
                args.push("--depth".into());
                args.push(d.to_string());
            }
            args.extend(opts.packages);
        }
        _ => unreachable!(),
    }

    Ok(ResolvedCommand { bin: pm, args, warnings })
}

// ── Outdated ─────────────────────────────────────────────────────────

#[napi(object)]
pub struct OutdatedOptions {
    pub packages: Vec<String>,
    pub long: bool,
    pub format: String,
    pub recursive: bool,
    pub filter: Vec<String>,
    pub workspace_root: bool,
    pub prod: bool,
    pub dev: bool,
    pub no_optional: bool,
    pub compatible: bool,
    pub global: bool,
}

#[napi(catch_unwind)]
pub fn resolve_outdated(pm: String, version: String, opts: OutdatedOptions) -> napi::Result<ResolvedCommand> {
    validate_pm(&pm)?;
    let mut args = Vec::new();
    let mut warnings = Vec::new();

    match pm.as_str() {
        "pnpm" => {
            for f in &opts.filter {
                args.push("--filter".into());
                args.push(f.clone());
            }
            args.push("outdated".into());
            if opts.long {
                args.push("--long".into());
            }
            if opts.recursive {
                args.push("--recursive".into());
            }
            if opts.workspace_root {
                args.push("--include-workspace-root".into());
            }
            if opts.prod {
                args.push("--prod".into());
            }
            if opts.dev {
                args.push("--dev".into());
            }
            if opts.no_optional {
                args.push("--no-optional".into());
            }
            if opts.compatible {
                args.push("--compatible".into());
            }
            match opts.format.as_str() {
                "json" => {
                    args.push("--format".into());
                    args.push("json".into());
                }
                "list" => {
                    args.push("--format".into());
                    args.push("list".into());
                }
                _ => {}
            }
            args.extend(opts.packages);
        }
        "npm" => {
            args.push("outdated".into());
            if opts.long {
                args.push("--long".into());
            }
            match opts.format.as_str() {
                "json" => {
                    args.push("--json".into());
                }
                "list" => {
                    args.push("--parseable".into());
                }
                _ => {}
            }
            for f in &opts.filter {
                args.push("--workspace".into());
                args.push(f.clone());
            }
            if opts.recursive {
                args.push("--all".into());
            }
            if opts.global {
                args.push("--global".into());
            }
            args.extend(opts.packages);
        }
        "yarn" => {
            if version.starts_with("1.") {
                args.push("outdated".into());
                args.extend(opts.packages);
            } else {
                warnings.push("yarn berry uses 'yarn upgrade-interactive' instead of outdated.".into());
                args.push("upgrade-interactive".into());
            }
        }
        "bun" => {
            args.push("outdated".into());
            for f in &opts.filter {
                args.push("--filter".into());
                args.push(f.clone());
            }
            args.extend(opts.packages);
        }
        _ => unreachable!(),
    }

    Ok(ResolvedCommand { bin: pm, args, warnings })
}

// ── Link / Unlink ────────────────────────────────────────────────────

/// Returns `true` when the target looks like a filesystem path (absolute,
/// relative, or Windows-style) rather than a bare package name.
fn is_path_like(target: &str) -> bool {
    target.starts_with('/')
        || target.starts_with('\\')
        || target.starts_with("./")
        || target.starts_with(".\\")
        || target.starts_with("../")
        || target.starts_with("..\\")
        || target == "."
        || target == ".."
        // Windows drive-letter (e.g. "C:/foo")
        || (target.len() >= 3
            && target.as_bytes()[1] == b':'
            && (target.as_bytes()[2] == b'/' || target.as_bytes()[2] == b'\\'))
}

#[napi(catch_unwind)]
pub fn resolve_link(
    pm: String,
    version: String,
    target: Option<String>,
) -> napi::Result<ResolvedCommand> {
    validate_pm(&pm)?;
    let mut args = vec!["link".to_string()];
    let mut warnings = Vec::new();

    // pnpm v11 removes arg-less `pnpm link` and global-store name resolution.
    // Only `pnpm link <path>` continues to work.
    if pm == "pnpm" {
        match is_pnpm_v11_plus(&version) {
            Some(true) => match &target {
                None => {
                    warnings.push(
                        "pnpm v11 removed arg-less `pnpm link`. Pass an explicit path, e.g. `vis link ./packages/my-pkg`."
                            .into(),
                    );
                }
                Some(t) if !is_path_like(t) => {
                    warnings.push(format!(
                        "pnpm v11 removed global-store name resolution for `pnpm link {t}`. Use a relative or absolute path instead."
                    ));
                }
                _ => {}
            },
            None => {
                // Unknown version — we can't tell if v11 restrictions apply.
                // Warn generically for non-path targets so users know it may fail.
                match &target {
                    None => {
                        warnings.push(
                            "pnpm version unknown. Arg-less `pnpm link` was removed in v11; pass an explicit path to be safe."
                                .into(),
                        );
                    }
                    Some(t) if !is_path_like(t) => {
                        warnings.push(format!(
                            "pnpm version unknown. Global-store name resolution for `pnpm link {t}` was removed in v11; use a path to be safe."
                        ));
                    }
                    _ => {}
                }
            }
            Some(false) => { /* v10 and below: all link forms are supported */ }
        }
    }

    if let Some(t) = target {
        args.push(t);
    }

    Ok(ResolvedCommand {
        bin: pm,
        args,
        warnings,
    })
}

#[napi(catch_unwind)]
pub fn resolve_unlink(
    pm: String,
    version: String,
    packages: Vec<String>,
    recursive: bool,
) -> napi::Result<ResolvedCommand> {
    validate_pm(&pm)?;
    let mut args = Vec::new();
    let mut warnings = Vec::new();

    match pm.as_str() {
        "pnpm" => {
            args.push("unlink".into());
            if recursive {
                args.push("--recursive".into());
            }
            args.extend(packages);
        }
        "npm" => {
            args.push("unlink".into());
            if recursive {
                warnings.push("npm does not support --recursive for unlink.".into());
            }
            args.extend(packages);
        }
        "yarn" => {
            args.push("unlink".into());
            if recursive && !version.starts_with("1.") {
                args.push("--all".into());
            } else if recursive {
                warnings.push("yarn v1 does not support recursive unlink.".into());
            }
            args.extend(packages);
        }
        "bun" => {
            args.push("unlink".into());
            if recursive {
                warnings.push("bun does not support --recursive for unlink.".into());
            }
            args.extend(packages);
        }
        _ => unreachable!(),
    }

    Ok(ResolvedCommand { bin: pm, args, warnings })
}

// ── Dlx ──────────────────────────────────────────────────────────────

#[napi(object)]
pub struct DlxOptions {
    pub package: String,
    pub args: Vec<String>,
    pub additional_packages: Vec<String>,
    pub shell_mode: bool,
    pub silent: bool,
}

#[napi(catch_unwind)]
pub fn resolve_dlx(pm: String, version: String, opts: DlxOptions) -> napi::Result<ResolvedCommand> {
    validate_pm(&pm)?;
    let mut args = Vec::new();
    let mut warnings = Vec::new();
    let mut bin = pm.clone();

    match pm.as_str() {
        "pnpm" => {
            args.push("dlx".into());
            for pkg in &opts.additional_packages {
                args.push("--package".into());
                args.push(pkg.clone());
            }
            if opts.shell_mode {
                args.push("-c".into());
            }
            if opts.silent {
                args.push("--silent".into());
            }
            args.push(opts.package);
            args.extend(opts.args);
        }
        "npm" => {
            args.push("exec".into());
            args.push("--yes".into());
            for pkg in &opts.additional_packages {
                args.push(format!("--package={pkg}"));
            }
            args.push(format!("--package={}", opts.package));
            if opts.shell_mode {
                args.push("-c".into());
            }
            if opts.silent {
                args.push("--loglevel".into());
                args.push("silent".into());
            }
            // Extract binary name: handle scoped packages like @scope/pkg@1.0
            let without_version = opts
                .package
                .split('@')
                .enumerate()
                .take_while(|(i, _)| *i < 2) // keep @scope/pkg, drop @version
                .map(|(_, s)| s)
                .collect::<Vec<_>>()
                .join("@");
            let bin_name = without_version.rsplit('/').next().unwrap_or(&opts.package).to_string();
            args.push("--".into());
            args.push(if bin_name.is_empty() { opts.package.clone() } else { bin_name });
            args.extend(opts.args);
        }
        "yarn" => {
            if version.starts_with("1.") {
                warnings.push("yarn v1 does not support dlx. Falling back to npx.".into());
                bin = "npx".into();
                args.push("--yes".into());
                for pkg in &opts.additional_packages {
                    args.push("--package".into());
                    args.push(pkg.clone());
                }
                if opts.silent {
                    args.push("--quiet".into());
                }
                args.push(opts.package);
                args.extend(opts.args);
            } else {
                args.push("dlx".into());
                for pkg in &opts.additional_packages {
                    args.push("-p".into());
                    args.push(pkg.clone());
                }
                if opts.shell_mode {
                    warnings.push("yarn berry does not support shell mode for dlx.".into());
                }
                if opts.silent {
                    args.push("--quiet".into());
                }
                args.push(opts.package);
                args.extend(opts.args);
            }
        }
        "bun" => {
            args.push("x".into());
            for pkg in &opts.additional_packages {
                args.push("--package".into());
                args.push(pkg.clone());
            }
            args.push(opts.package);
            args.extend(opts.args);
        }
        _ => unreachable!(),
    }

    Ok(ResolvedCommand { bin, args, warnings })
}

// ── Exec ─────────────────────────────────────────────────────────────

#[napi(object)]
pub struct ExecOptions {
    pub command: String,
    pub args: Vec<String>,
    pub shell_mode: bool,
    pub recursive: bool,
    pub workspace_root: bool,
    pub parallel: bool,
    pub reverse: bool,
    pub filter: Vec<String>,
}

#[napi(catch_unwind)]
pub fn resolve_exec(pm: String, version: String, opts: ExecOptions) -> napi::Result<ResolvedCommand> {
    validate_pm(&pm)?;
    let mut args = Vec::new();
    let mut warnings = Vec::new();
    let mut bin = pm.clone();

    match pm.as_str() {
        "pnpm" => {
            for f in &opts.filter {
                args.push("--filter".into());
                args.push(f.clone());
            }
            args.push("exec".into());
            if opts.recursive {
                args.push("--recursive".into());
            }
            if opts.workspace_root {
                args.push("-w".into());
            }
            if opts.parallel {
                args.push("--parallel".into());
            }
            if opts.shell_mode {
                args.push("-c".into());
            }
            args.push(opts.command);
            args.extend(opts.args);
        }
        "npm" => {
            args.push("exec".into());
            for f in &opts.filter {
                args.push("--workspace".into());
                args.push(f.clone());
            }
            if opts.recursive {
                args.push("--workspaces".into());
            }
            if opts.workspace_root {
                args.push("--include-workspace-root".into());
            }
            if opts.shell_mode {
                args.push("-c".into());
            }
            args.push("--".into());
            args.push(opts.command);
            args.extend(opts.args);
        }
        "yarn" => {
            if version.starts_with("1.") {
                warnings.push("yarn v1 does not support exec. Falling back to npx.".into());
                bin = "npx".into();
                args.push(opts.command);
                args.extend(opts.args);
            } else {
                if opts.recursive || !opts.filter.is_empty() {
                    args.push("workspaces".into());
                    args.push("foreach".into());
                    args.push("--all".into());
                    for f in &opts.filter {
                        args.push("--include".into());
                        args.push(f.clone());
                    }
                    if opts.parallel {
                        args.push("--parallel".into());
                    }
                }
                args.push("exec".into());
                args.push(opts.command);
                args.extend(opts.args);
            }
        }
        "bun" => {
            bin = "bunx".into();
            args.push(opts.command);
            args.extend(opts.args);
        }
        _ => unreachable!(),
    }

    Ok(ResolvedCommand { bin, args, warnings })
}

// ── PM utilities ─────────────────────────────────────────────────────

#[napi(catch_unwind)]
pub fn resolve_pm_command(
    pm: String,
    version: String,
    subcommand: String,
    extra_args: Vec<String>,
) -> napi::Result<ResolvedCommand> {
    validate_pm(&pm)?;
    let mut args = Vec::new();
    let mut warnings = Vec::new();

    // Commands that always delegate to npm
    let npm_only = ["deprecate", "fund", "ping", "search", "token"];
    if npm_only.contains(&subcommand.as_str()) {
        if pm != "npm" {
            warnings.push(format!("'{subcommand}' is not natively supported by {pm}. Delegating to npm."));
        }
        args.push(subcommand);
        args.extend(extra_args);
        return Ok(ResolvedCommand { bin: "npm".into(), args, warnings });
    }

    // Cache: special handling
    if subcommand == "cache" {
        match pm.as_str() {
            "pnpm" => {
                let sub = extra_args.first().map(|s| s.as_str());
                match sub {
                    Some("dir") => {
                        args.push("store".into());
                        args.push("path".into());
                    }
                    Some("clean") => {
                        args.push("store".into());
                        args.push("prune".into());
                        args.extend(extra_args.into_iter().skip(1));
                    }
                    _ => {
                        args.push("store".into());
                        args.extend(extra_args);
                    }
                }
                return Ok(ResolvedCommand { bin: "pnpm".into(), args, warnings });
            }
            "bun" => {
                args.push("pm".into());
                args.push("cache".into());
                args.extend(extra_args);
                return Ok(ResolvedCommand { bin: "bun".into(), args, warnings });
            }
            _ => {
                args.push("cache".into());
                args.extend(extra_args);
                return Ok(ResolvedCommand { bin: pm, args, warnings });
            }
        }
    }

    // list/ls
    if subcommand == "list" || subcommand == "ls" {
        match pm.as_str() {
            "bun" => {
                args.push("pm".into());
                args.push("ls".into());
                args.extend(extra_args);
                return Ok(ResolvedCommand { bin: "bun".into(), args, warnings });
            }
            _ => {
                args.push("list".into());
                args.extend(extra_args);
                return Ok(ResolvedCommand { bin: pm, args, warnings });
            }
        }
    }

    // pack (tarball, not bundling)
    if subcommand == "pack" {
        match pm.as_str() {
            "bun" => {
                args.push("pm".into());
                args.push("pack".into());
                args.extend(extra_args);
                return Ok(ResolvedCommand { bin: "bun".into(), args, warnings });
            }
            _ => {
                args.push("pack".into());
                args.extend(extra_args);
                return Ok(ResolvedCommand { bin: pm, args, warnings });
            }
        }
    }

    // view/info — registry metadata lookup. Each PM spells it differently:
    //   npm/pnpm  → `<pm> view <extra>`      (both also accept `info` as alias)
    //   yarn v1   → `yarn info <extra>`      (no `view` subcommand)
    //   yarn v2+  → `yarn npm info <extra>`  (bare `yarn view` does not exist in berry)
    //   bun       → `bun pm view <extra>`    (two-word subcommand; bun ≥ 1.3)
    if subcommand == "view" || subcommand == "info" {
        match pm.as_str() {
            "yarn" => {
                if version.starts_with("1.") {
                    args.push("info".into());
                } else {
                    args.push("npm".into());
                    args.push("info".into());
                }
                args.extend(extra_args);
            }
            "bun" => {
                args.push("pm".into());
                args.push("view".into());
                args.extend(extra_args);
            }
            _ => {
                args.push("view".into());
                args.extend(extra_args);
            }
        }
        return Ok(ResolvedCommand { bin: pm, args, warnings });
    }

    // Unsupported checks
    if subcommand == "prune" && (pm == "yarn" || pm == "bun") {
        warnings.push(format!("{pm} does not support 'prune'. It prunes automatically on install."));
    }
    if subcommand == "rebuild" && (pm == "yarn" || pm == "bun") {
        warnings.push(format!("{pm} does not support 'rebuild'."));
    }

    // Default pass-through
    args.push(subcommand);
    args.extend(extra_args);

    Ok(ResolvedCommand { bin: pm, args, warnings })
}
