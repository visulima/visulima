//! Native `vis exec <command> [args...]` — run a local `node_modules/.bin`
//! command via the project's package manager (no remote fallback).
//!
//! Matches the Node *lean* exec path (`src/cli-exec.ts` → `src/commands/exec`):
//! the runtime is resolved from `--runtime` / `VIS_RUNTIME` / lockfile detection,
//! and `vis.config.ts` is intentionally NOT read (same trade-off the lean path
//! documents). Flag surface mirrors `src/commands/exec/index.ts`.

use std::env;
use std::process::{exit, Command};

use vis_core::detect::detect_package_manager;
use vis_core::resolve::{resolve_exec, ExecOptions};

struct Parsed {
    runtime: Option<String>,
    opts: ExecOptions,
}

/// Entry point. `args` is everything after the `exec` subcommand. Never returns.
pub fn run(args: &[String]) -> ! {
    let Parsed { runtime, opts } = match parse(args) {
        Ok(parsed) => parsed,
        Err(message) => {
            eprintln!("vis exec: {message}");
            exit(1);
        }
    };

    if opts.command.is_empty() {
        eprintln!("vis exec: No command specified. Usage: vis exec <command> [args...]");
        exit(1);
    }

    let cwd = env::current_dir().map(|path| path.to_string_lossy().into_owned()).unwrap_or_else(|_| ".".to_owned());
    let (pm, version) = resolve_pm(runtime.as_deref(), &cwd);

    let resolved = match resolve_exec(&pm, &version, opts) {
        Ok(resolved) => resolved,
        Err(message) => {
            eprintln!("vis exec: {message}");
            exit(1);
        }
    };

    for warning in &resolved.warnings {
        eprintln!("vis exec: {warning}");
    }

    match Command::new(&resolved.bin).args(&resolved.args).current_dir(&cwd).status() {
        Ok(status) => exit(crate::forward_code(status)),
        Err(error) => {
            eprintln!("vis exec: failed to run '{}': {error}", resolved.bin);
            exit(127);
        }
    }
}

/// Resolve the package manager + version to drive `resolve_exec`. A `bun` runtime
/// (flag or VIS_RUNTIME) forces bun; otherwise the PM is detected from the cwd.
fn resolve_pm(runtime: Option<&str>, cwd: &str) -> (String, String) {
    let runtime = runtime.map(str::to_owned).or_else(|| env::var("VIS_RUNTIME").ok());

    if runtime.as_deref() == Some("bun") {
        return ("bun".to_owned(), String::new());
    }

    let detected = detect_package_manager(cwd, None);

    (detected.name, detected.version.unwrap_or_default())
}

/// Parse exec's flags. Mirrors cerebro's `stopAtFirstUnknown`: vis options are
/// consumed only until the first positional (the command) or a `--` separator;
/// everything from the command onward is forwarded verbatim to it.
fn parse(args: &[String]) -> Result<Parsed, String> {
    let mut opts = ExecOptions::default();
    let mut runtime = None;
    let mut command_found = false;
    let mut index = 0;

    while index < args.len() {
        let argument = &args[index];

        if command_found {
            opts.args.push(argument.clone());
            index += 1;
            continue;
        }

        match argument.as_str() {
            "--" => {
                index += 1;

                if let Some(command) = args.get(index) {
                    opts.command = command.clone();
                    command_found = true;
                    index += 1;
                }

                continue;
            }
            "-c" | "--shell-mode" => opts.shell_mode = true,
            "-r" | "--recursive" => opts.recursive = true,
            "-w" | "--workspace-root" => opts.workspace_root = true,
            "--parallel" => opts.parallel = true,
            "--reverse" => opts.reverse = true,
            "-F" | "--filter" => {
                index += 1;
                opts.filter.push(args.get(index).ok_or("--filter requires a value")?.clone());
            }
            other if other.starts_with("--filter=") => opts.filter.push(other["--filter=".len()..].to_owned()),
            other if other.starts_with("--runtime=") => runtime = Some(other["--runtime=".len()..].to_owned()),
            "--runtime" => {
                index += 1;
                runtime = Some(args.get(index).ok_or("--runtime requires a value")?.clone());
            }
            // First positional (or any unknown token) is the command; cerebro
            // stops option parsing here and forwards the rest to it.
            other => {
                opts.command = other.to_owned();
                command_found = true;
            }
        }

        index += 1;
    }

    Ok(Parsed { opts, runtime })
}

#[cfg(test)]
mod tests {
    use super::parse;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|item| (*item).to_owned()).collect()
    }

    #[test]
    fn first_positional_is_the_command() {
        let parsed = parse(&args(&["eslint"])).unwrap();

        assert_eq!(parsed.opts.command, "eslint");
        assert!(parsed.opts.args.is_empty());
    }

    #[test]
    fn vis_flags_before_the_command_are_consumed() {
        let parsed = parse(&args(&["-r", "-w", "eslint"])).unwrap();

        assert!(parsed.opts.recursive);
        assert!(parsed.opts.workspace_root);
        assert_eq!(parsed.opts.command, "eslint");
    }

    #[test]
    fn filter_takes_a_value_in_both_forms() {
        let parsed = parse(&args(&["-F", "@scope/a", "--filter=@scope/b", "eslint"])).unwrap();

        assert_eq!(parsed.opts.filter, ["@scope/a", "@scope/b"]);
        assert_eq!(parsed.opts.command, "eslint");
    }

    #[test]
    fn double_dash_separates_the_command() {
        let parsed = parse(&args(&["-r", "--", "eslint", "."])).unwrap();

        assert!(parsed.opts.recursive);
        assert_eq!(parsed.opts.command, "eslint");
        assert_eq!(parsed.opts.args, ["."]);
    }

    #[test]
    fn runtime_flag_in_both_forms() {
        assert_eq!(parse(&args(&["--runtime", "bun", "x"])).unwrap().runtime.as_deref(), Some("bun"));
        assert_eq!(parse(&args(&["--runtime=bun", "x"])).unwrap().runtime.as_deref(), Some("bun"));
    }

    #[test]
    fn tokens_after_the_command_are_forwarded_verbatim() {
        // NOTE: the native parser forwards post-command tokens (including
        // flag-like ones) to the command. Parity with cerebro's
        // `stopAtFirstUnknown` is unverified — which is why `exec` is not yet
        // routed natively (see bin/vis.mjs NATIVE_COMMANDS).
        let parsed = parse(&args(&["eslint", "--fix", "src"])).unwrap();

        assert_eq!(parsed.opts.command, "eslint");
        assert_eq!(parsed.opts.args, ["--fix", "src"]);
    }
}
