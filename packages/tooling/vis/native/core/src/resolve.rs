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

#[cfg(test)]
mod tests {
    use super::{resolve_exec, resolve_pm_command, ExecOptions};

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
}
