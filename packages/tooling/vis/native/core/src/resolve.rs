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

#[cfg(test)]
mod tests {
    use super::{resolve_exec, ExecOptions};

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
