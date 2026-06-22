//! Package-manager command resolution. De-napi'd copy of the relevant slice of
//! the addon's `pm_resolve.rs` (keep in sync). Each `resolve_*` maps a vis verb +
//! the detected PM/version + options to the concrete `{bin, args}` to spawn.

/// The resolved command to spawn, plus any non-fatal warnings to surface.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ResolvedCommand {
    pub bin: String,
    pub args: Vec<String>,
    pub warnings: Vec<String>,
}

/// Validates that the PM name is one of the supported values.
fn validate_pm(pm: &str) -> Result<(), String> {
    match pm {
        "pnpm" | "npm" | "yarn" | "bun" | "deno" => Ok(()),
        _ => Err(format!("Unsupported package manager: '{pm}'. Supported: pnpm, npm, yarn, bun, deno")),
    }
}

/// Options for `resolve_exec`, mirroring the addon's `ExecOptions`.
#[derive(Default)]
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

/// Resolve `vis exec <command>` to the PM-specific invocation. Faithful copy of
/// the addon's `resolve_exec`.
pub fn resolve_exec(pm: &str, version: &str, opts: ExecOptions) -> Result<ResolvedCommand, String> {
    validate_pm(pm)?;

    let mut args = Vec::new();
    let mut warnings = Vec::new();
    let mut bin = pm.to_owned();

    match pm {
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
        "deno" => {
            args.push("task".into());

            if opts.shell_mode {
                warnings.push("deno task does not support shell mode.".into());
            }

            if opts.recursive || !opts.filter.is_empty() || opts.parallel || opts.reverse {
                warnings.push("deno task has no workspace fan-out flags (--recursive / --filter / --parallel / --reverse) — ignoring.".into());
            }

            args.push(opts.command);
            args.extend(opts.args);
        }
        _ => unreachable!(),
    }

    Ok(ResolvedCommand { bin, args, warnings })
}

/// Resolve `vis pm <subcommand> [args]` to the PM-specific invocation. Faithful
/// copy of the addon's `resolve_pm_command` (per-PM mapping for cache/list/pack/
/// view + npm-only verbs, with a default pass-through).
pub fn resolve_pm_command(
    pm: &str,
    version: &str,
    subcommand: &str,
    extra_args: Vec<String>,
) -> Result<ResolvedCommand, String> {
    validate_pm(pm)?;

    let mut args = Vec::new();
    let mut warnings = Vec::new();

    // Commands that always delegate to npm.
    let npm_only = ["deprecate", "fund", "ping", "search", "token"];

    if npm_only.contains(&subcommand) {
        if pm != "npm" {
            warnings.push(format!("'{subcommand}' is not natively supported by {pm}. Delegating to npm."));
        }

        args.push(subcommand.to_owned());
        args.extend(extra_args);

        return Ok(ResolvedCommand { args, bin: "npm".into(), warnings });
    }

    if subcommand == "cache" {
        match pm {
            "pnpm" => {
                match extra_args.first().map(String::as_str) {
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

                return Ok(ResolvedCommand { args, bin: "pnpm".into(), warnings });
            }
            "bun" => {
                args.push("pm".into());
                args.push("cache".into());
                args.extend(extra_args);

                return Ok(ResolvedCommand { args, bin: "bun".into(), warnings });
            }
            "deno" => {
                match extra_args.first().map(String::as_str) {
                    Some("dir") => {
                        args.push("info".into());
                        warnings
                            .push("deno has no `cache dir`; printing `deno info` (DENO_DIR is in the output).".into());
                    }
                    Some("clean") => {
                        warnings.push(
                            "deno has no `cache clean`. Remove DENO_DIR (default: ~/.cache/deno) manually.".into(),
                        );
                        args.push("--help".into());
                    }
                    _ => {
                        args.push("cache".into());
                        args.extend(extra_args);
                    }
                }

                return Ok(ResolvedCommand { args, bin: "deno".into(), warnings });
            }
            _ => {
                args.push("cache".into());
                args.extend(extra_args);

                return Ok(ResolvedCommand { args, bin: pm.to_owned(), warnings });
            }
        }
    }

    if subcommand == "list" || subcommand == "ls" {
        match pm {
            "bun" => {
                args.push("pm".into());
                args.push("ls".into());
                args.extend(extra_args);

                return Ok(ResolvedCommand { args, bin: "bun".into(), warnings });
            }
            "deno" => {
                warnings.push("deno has no `list`; falling back to `deno info`.".into());
                args.push("info".into());
                args.extend(extra_args);

                return Ok(ResolvedCommand { args, bin: "deno".into(), warnings });
            }
            _ => {
                args.push("list".into());
                args.extend(extra_args);

                return Ok(ResolvedCommand { args, bin: pm.to_owned(), warnings });
            }
        }
    }

    if subcommand == "pack" {
        match pm {
            "bun" => {
                args.push("pm".into());
                args.push("pack".into());
                args.extend(extra_args);

                return Ok(ResolvedCommand { args, bin: "bun".into(), warnings });
            }
            "deno" => {
                warnings.push(
                    "deno does not support `pack`. Use `deno publish --dry-run` to preview a JSR publish.".into(),
                );
                args.push("publish".into());
                args.push("--dry-run".into());

                return Ok(ResolvedCommand { args, bin: "deno".into(), warnings });
            }
            _ => {
                args.push("pack".into());
                args.extend(extra_args);

                return Ok(ResolvedCommand { args, bin: pm.to_owned(), warnings });
            }
        }
    }

    if subcommand == "view" || subcommand == "info" {
        match pm {
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
            "deno" => {
                args.push("info".into());

                for arg in &extra_args {
                    if arg.starts_with("npm:")
                        || arg.starts_with("jsr:")
                        || arg.starts_with("https://")
                        || arg.starts_with("http://")
                        || arg.starts_with("file:")
                        || arg.starts_with('-')
                    {
                        args.push(arg.clone());
                    } else {
                        args.push(format!("npm:{arg}"));
                    }
                }
            }
            _ => {
                args.push("view".into());
                args.extend(extra_args);
            }
        }

        return Ok(ResolvedCommand { args, bin: pm.to_owned(), warnings });
    }

    if subcommand == "prune" && (pm == "yarn" || pm == "bun" || pm == "deno") {
        warnings.push(format!("{pm} does not support 'prune'. It prunes automatically on install."));
    }

    if subcommand == "rebuild" && (pm == "yarn" || pm == "bun" || pm == "deno") {
        warnings.push(format!("{pm} does not support 'rebuild'."));
    }

    args.push(subcommand.to_owned());
    args.extend(extra_args);

    Ok(ResolvedCommand { args, bin: pm.to_owned(), warnings })
}

/// Leading integer of a version string (`"11.0.0-rc.0"` -> `Some(11)`), or None
/// when it doesn't start with a digit (`"latest"`).
fn parse_major(version: &str) -> Option<u32> {
    let end = version.find(|c: char| !c.is_ascii_digit()).unwrap_or(version.len());

    version[..end].parse::<u32>().ok()
}

/// `Some(true)` for pnpm >= 11, `Some(false)` below, `None` if unparseable.
fn is_pnpm_v11_plus(version: &str) -> Option<bool> {
    parse_major(version).map(|major| major >= 11)
}

/// True when the target looks like a filesystem path rather than a bare name.
fn is_path_like(target: &str) -> bool {
    target.starts_with('/')
        || target.starts_with('\\')
        || target.starts_with("./")
        || target.starts_with(".\\")
        || target.starts_with("../")
        || target.starts_with("..\\")
        || target == "."
        || target == ".."
        || (target.len() >= 3
            && target.as_bytes()[1] == b':'
            && (target.as_bytes()[2] == b'/' || target.as_bytes()[2] == b'\\'))
}

/// Options for `resolve_remove` (mirrors the addon's `RemoveOptions`).
#[derive(Default)]
pub struct RemoveOptions {
    pub packages: Vec<String>,
    pub save_dev: bool,
    pub global: bool,
    pub recursive: bool,
    pub workspace_root: bool,
    pub filter: Vec<String>,
}

/// Resolve `vis remove <packages>`. Faithful copy of the addon's `resolve_remove`.
pub fn resolve_remove(pm: &str, version: &str, opts: RemoveOptions) -> Result<ResolvedCommand, String> {
    validate_pm(pm)?;

    let mut args = Vec::new();
    let mut warnings = Vec::new();

    if opts.global && pm != "bun" && pm != "deno" {
        let mut global = vec!["uninstall".to_owned(), "--global".to_owned()];
        global.extend(opts.packages);

        return Ok(ResolvedCommand { args: global, bin: "npm".into(), warnings });
    }

    match pm {
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
        "deno" => {
            if opts.global {
                args.push("uninstall".into());
                args.push("-g".into());
            } else {
                args.push("remove".into());

                if opts.save_dev {
                    warnings.push(
                        "deno remove has no --save-dev flag; section is inferred from where the package lives.".into(),
                    );
                }

                if !opts.filter.is_empty() || opts.recursive || opts.workspace_root {
                    warnings.push("deno remove operates on the current workspace; --filter / --recursive / --workspace-root are ignored.".into());
                }
            }

            args.extend(opts.packages);
        }
        _ => unreachable!(),
    }

    Ok(ResolvedCommand { args, bin: pm.to_owned(), warnings })
}

/// Resolve `vis dedupe`. Faithful copy of the addon's `resolve_dedupe`.
pub fn resolve_dedupe(pm: &str, version: &str, check: bool) -> Result<ResolvedCommand, String> {
    validate_pm(pm)?;

    let mut args = Vec::new();
    let mut warnings = Vec::new();

    match pm {
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

                return Ok(ResolvedCommand { args: vec!["install".into()], bin: "yarn".into(), warnings });
            }

            args.push("dedupe".into());

            if check {
                args.push("--check".into());
            }
        }
        "bun" => {
            warnings.push("bun does not support dedupe operations.".into());

            return Ok(ResolvedCommand { args: vec!["install".into()], bin: "bun".into(), warnings });
        }
        "deno" => {
            warnings.push("deno does not support dedupe operations. Falling back to `deno install`.".into());

            return Ok(ResolvedCommand { args: vec!["install".into()], bin: "deno".into(), warnings });
        }
        _ => unreachable!(),
    }

    Ok(ResolvedCommand { args, bin: pm.to_owned(), warnings })
}

/// Resolve `vis link [target]`. Faithful copy of the addon's `resolve_link`.
pub fn resolve_link(pm: &str, version: &str, target: Option<String>) -> Result<ResolvedCommand, String> {
    validate_pm(pm)?;

    if pm == "deno" {
        let mut warnings = vec![
            "deno does not support `link`. Use `deno add ./relative/path` to depend on a local package.".to_owned(),
        ];

        if target.is_some() {
            warnings.push("Ignoring link target on deno.".into());
        }

        return Ok(ResolvedCommand { args: vec!["--help".into()], bin: "deno".into(), warnings });
    }

    let mut args = vec!["link".to_owned()];
    let mut warnings = Vec::new();

    if pm == "pnpm" {
        match is_pnpm_v11_plus(version) {
            Some(true) => match &target {
                None => warnings.push(
                    "pnpm v11 removed arg-less `pnpm link`. Pass an explicit path, e.g. `vis link ./packages/my-pkg`."
                        .into(),
                ),
                Some(t) if !is_path_like(t) => {
                    warnings.push(format!("pnpm v11 removed global-store name resolution for `pnpm link {t}`. Use a relative or absolute path instead."));
                }
                _ => {}
            },
            None => match &target {
                None => warnings.push(
                    "pnpm version unknown. Arg-less `pnpm link` was removed in v11; pass an explicit path to be safe."
                        .into(),
                ),
                Some(t) if !is_path_like(t) => {
                    warnings.push(format!("pnpm version unknown. Global-store name resolution for `pnpm link {t}` was removed in v11; use a path to be safe."));
                }
                _ => {}
            },
            Some(false) => {}
        }
    }

    if let Some(t) = target {
        args.push(t);
    }

    Ok(ResolvedCommand { args, bin: pm.to_owned(), warnings })
}

/// Resolve `vis unlink <packages>`. Faithful copy of the addon's `resolve_unlink`.
pub fn resolve_unlink(
    pm: &str,
    version: &str,
    packages: Vec<String>,
    recursive: bool,
) -> Result<ResolvedCommand, String> {
    validate_pm(pm)?;

    let mut args = Vec::new();
    let mut warnings = Vec::new();

    match pm {
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
        "deno" => {
            warnings.push("deno does not support `unlink`. Falling back to `deno remove` (use `vis remove -g` for global binaries).".into());
            args.push("remove".into());

            if recursive {
                warnings.push("deno remove has no --recursive flag.".into());
            }

            args.extend(packages);
        }
        _ => unreachable!(),
    }

    Ok(ResolvedCommand { args, bin: pm.to_owned(), warnings })
}

/// Options for `resolve_outdated` (mirrors the addon's `OutdatedOptions`).
#[derive(Default)]
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

/// Resolve `vis outdated`. Faithful copy of the addon's `resolve_outdated`.
pub fn resolve_outdated(pm: &str, version: &str, opts: OutdatedOptions) -> Result<ResolvedCommand, String> {
    validate_pm(pm)?;

    let mut args = Vec::new();
    let mut warnings = Vec::new();

    match pm {
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
                "json" => args.push("--json".into()),
                "list" => args.push("--parseable".into()),
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
        "deno" => {
            args.push("outdated".into());

            if opts.compatible {
                args.push("--compatible".into());
            }

            if opts.format == "json" {
                warnings.push("deno outdated does not support JSON output.".into());
            }

            if !opts.filter.is_empty() {
                warnings.push("deno outdated has no --filter flag.".into());
            }

            if opts.global {
                warnings.push("deno outdated has no --global flag.".into());
            }

            args.extend(opts.packages);
        }
        _ => unreachable!(),
    }

    Ok(ResolvedCommand { args, bin: pm.to_owned(), warnings })
}

/// Options for `resolve_why` (mirrors the addon's `WhyOptions`).
#[derive(Default)]
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
    pub depth: Option<i32>,
    pub filter: Vec<String>,
}

/// Resolve `vis why <packages>`. Faithful copy of the addon's `resolve_why`.
pub fn resolve_why(pm: &str, version: &str, opts: WhyOptions) -> Result<ResolvedCommand, String> {
    validate_pm(pm)?;

    let mut args = Vec::new();
    let mut warnings = Vec::new();

    match pm {
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
        "deno" => {
            warnings.push(
                "deno does not have a `why` subcommand; falling back to `deno info` (module dependency graph).".into(),
            );
            args.push("info".into());

            if opts.json {
                args.push("--json".into());
            }

            args.extend(opts.packages);
        }
        _ => unreachable!(),
    }

    Ok(ResolvedCommand { args, bin: pm.to_owned(), warnings })
}

#[cfg(test)]
mod tests {
    use super::{
        resolve_dedupe, resolve_exec, resolve_link, resolve_outdated, resolve_pm_command, resolve_remove,
        resolve_unlink, resolve_why, ExecOptions, OutdatedOptions, RemoveOptions, WhyOptions,
    };

    fn argv(list: &[&str]) -> Vec<String> {
        list.iter().map(|item| (*item).to_owned()).collect()
    }

    #[test]
    fn pm_cache_dir_maps_to_pnpm_store_path() {
        let resolved = resolve_pm_command("pnpm", "9.0.0", "cache", argv(&["dir"])).unwrap();

        assert_eq!(resolved.bin, "pnpm");
        assert_eq!(resolved.args, ["store", "path"]);
    }

    #[test]
    fn pm_passthrough_forwards_flags() {
        let resolved = resolve_pm_command("pnpm", "9.0.0", "publish", argv(&["--dry-run"])).unwrap();

        assert_eq!(resolved.bin, "pnpm");
        assert_eq!(resolved.args, ["publish", "--dry-run"]);
    }

    #[test]
    fn pm_npm_only_verb_delegates_to_npm() {
        let resolved = resolve_pm_command("pnpm", "9.0.0", "ping", argv(&[])).unwrap();

        assert_eq!(resolved.bin, "npm");
        assert!(!resolved.warnings.is_empty());
    }

    fn exec(command: &str) -> ExecOptions {
        ExecOptions { command: command.to_owned(), ..Default::default() }
    }

    #[test]
    fn pnpm_exec_basic() {
        let resolved = resolve_exec("pnpm", "9.0.0", exec("eslint")).unwrap();

        assert_eq!(resolved.bin, "pnpm");
        assert_eq!(resolved.args, ["exec", "eslint"]);
    }

    #[test]
    fn pnpm_exec_with_filter_and_recursive() {
        let opts = ExecOptions {
            command: "eslint".to_owned(),
            args: vec![".".to_owned()],
            filter: vec!["@scope/pkg".to_owned()],
            recursive: true,
            ..Default::default()
        };

        let resolved = resolve_exec("pnpm", "9.0.0", opts).unwrap();

        assert_eq!(resolved.bin, "pnpm");
        assert_eq!(resolved.args, ["--filter", "@scope/pkg", "exec", "--recursive", "eslint", "."]);
    }

    #[test]
    fn npm_exec_inserts_separator() {
        let resolved = resolve_exec("npm", "10.0.0", exec("tsc")).unwrap();

        assert_eq!(resolved.bin, "npm");
        assert_eq!(resolved.args, ["exec", "--", "tsc"]);
    }

    #[test]
    fn yarn_v1_falls_back_to_npx() {
        let resolved = resolve_exec("yarn", "1.22.0", exec("eslint")).unwrap();

        assert_eq!(resolved.bin, "npx");
        assert_eq!(resolved.args, ["eslint"]);
        assert!(!resolved.warnings.is_empty());
    }

    #[test]
    fn bun_uses_bunx() {
        let resolved = resolve_exec("bun", "1.1.0", exec("eslint")).unwrap();

        assert_eq!(resolved.bin, "bunx");
        assert_eq!(resolved.args, ["eslint"]);
    }

    #[test]
    fn unsupported_pm_errors() {
        assert!(resolve_exec("cargo", "1.0.0", exec("x")).is_err());
    }

    #[test]
    fn remove_pnpm_with_dev_and_global_maps_to_npm() {
        let opts = RemoveOptions { packages: vec!["lodash".to_owned()], global: true, ..Default::default() };
        let resolved = resolve_remove("pnpm", "9.0.0", opts).unwrap();

        // Global removal goes to npm uninstall --global.
        assert_eq!(resolved.bin, "npm");
        assert_eq!(resolved.args, ["uninstall", "--global", "lodash"]);

        let local = RemoveOptions { packages: vec!["lodash".to_owned()], save_dev: true, ..Default::default() };
        let resolved = resolve_remove("pnpm", "9.0.0", local).unwrap();

        assert_eq!(resolved.args, ["remove", "-D", "lodash"]);
    }

    #[test]
    fn dedupe_check_maps_per_pm() {
        assert_eq!(resolve_dedupe("pnpm", "9.0.0", true).unwrap().args, ["dedupe", "--check"]);
        assert_eq!(resolve_dedupe("npm", "10.0.0", true).unwrap().args, ["dedupe", "--dry-run"]);
        // bun has no dedupe -> install fallback with a warning.
        let bun = resolve_dedupe("bun", "1.1.0", false).unwrap();

        assert_eq!(bun.args, ["install"]);
        assert!(!bun.warnings.is_empty());
    }

    #[test]
    fn link_pnpm_v11_warns_on_bare_name() {
        let resolved = resolve_link("pnpm", "11.0.0", Some("my-pkg".to_owned())).unwrap();

        assert_eq!(resolved.args, ["link", "my-pkg"]);
        assert!(!resolved.warnings.is_empty(), "v11 bare-name link should warn");

        // A path target on v11 does not warn.
        assert!(resolve_link("pnpm", "11.0.0", Some("./packages/p".to_owned())).unwrap().warnings.is_empty());
    }

    #[test]
    fn unlink_recursive_per_pm() {
        assert_eq!(
            resolve_unlink("pnpm", "9.0.0", vec!["p".to_owned()], true).unwrap().args,
            ["unlink", "--recursive", "p"]
        );
        // npm has no recursive unlink -> warning, no flag.
        let npm = resolve_unlink("npm", "10.0.0", vec!["p".to_owned()], true).unwrap();

        assert_eq!(npm.args, ["unlink", "p"]);
        assert!(!npm.warnings.is_empty());
    }

    #[test]
    fn outdated_format_and_filter() {
        let opts =
            OutdatedOptions { filter: vec!["@scope/a".to_owned()], format: "json".to_owned(), ..Default::default() };
        let resolved = resolve_outdated("pnpm", "9.0.0", opts).unwrap();

        assert_eq!(resolved.args, ["--filter", "@scope/a", "outdated", "--format", "json"]);
    }

    #[test]
    fn why_npm_uses_explain() {
        let opts = WhyOptions { packages: vec!["lodash".to_owned()], json: true, ..Default::default() };
        let resolved = resolve_why("npm", "10.0.0", opts).unwrap();

        assert_eq!(resolved.bin, "npm");
        assert_eq!(resolved.args, ["explain", "--json", "lodash"]);
    }
}
