//! Native ports of the small "translate-and-exec" package-manager commands:
//! `remove`, `dedupe`, `link`, `unlink`, `outdated`, `why`. Each detects the PM,
//! maps its vis flags to the PM's invocation via `vis_core::resolve`, and execs it.
//!
//! Flag handling mirrors the fixed exec/pm behavior: known vis flags are consumed
//! wherever they appear; every other token (package names AND unknown flags) is
//! forwarded to the PM in order (the Node handlers were fixed to match).

use std::env;
use std::path::Path;
use std::process::{exit, Command};

use vis_core::detect::detect_package_manager;
use vis_core::resolve::{
    resolve_dedupe, resolve_link, resolve_outdated, resolve_remove, resolve_unlink, resolve_why, OutdatedOptions,
    RemoveOptions, ResolvedCommand, WhyOptions,
};

/// Surface warnings, exec the resolved command, forward its exit status.
fn finish(verb: &str, resolved: ResolvedCommand, cwd: &Path) -> ! {
    for warning in &resolved.warnings {
        eprintln!("vis {verb}: {warning}");
    }

    match Command::new(&resolved.bin).args(&resolved.args).current_dir(cwd).status() {
        Ok(status) => exit(crate::forward_code(status)),
        Err(error) => {
            eprintln!("vis {verb}: failed to run '{}': {error}", resolved.bin);
            exit(127);
        }
    }
}

/// A token is a "known" flag if it matches one of `bools` (a switch) or `values`
/// (consumes the next token). Returns the parsed switches/values plus the
/// forwarded rest (positionals + unknown flags, in order).
struct Parsed {
    switches: Vec<String>,
    values: Vec<(String, String)>,
    rest: Vec<String>,
}

/// Generic flag scan. `bools`/`values` are canonical names; `alias` maps a single
/// token (incl. `-x` aliases) to a canonical name. `=`-forms are supported.
fn scan(args: &[String], alias: &dyn Fn(&str) -> Option<(&'static str, bool)>) -> Parsed {
    let mut switches = Vec::new();
    let mut values = Vec::new();
    let mut rest = Vec::new();
    let mut index = 0;

    while index < args.len() {
        let token = &args[index];

        // `--name=value`
        if let Some(equals) = token.strip_prefix("--").and_then(|body| body.split_once('=')) {
            if let Some((canonical, true)) = alias(&format!("--{}", equals.0)) {
                values.push((canonical.to_owned(), equals.1.to_owned()));
                index += 1;
                continue;
            }
        }

        match alias(token) {
            Some((canonical, false)) => switches.push(canonical.to_owned()),
            Some((canonical, true)) => {
                index += 1;

                if let Some(value) = args.get(index) {
                    values.push((canonical.to_owned(), value.clone()));
                }
            }
            None => rest.push(token.clone()),
        }

        index += 1;
    }

    Parsed { rest, switches, values }
}

fn has(parsed: &Parsed, name: &str) -> bool {
    parsed.switches.iter().any(|switch| switch == name)
}

fn collect(parsed: &Parsed, name: &str) -> Vec<String> {
    parsed.values.iter().filter(|(key, _)| key == name).map(|(_, value)| value.clone()).collect()
}

fn first(parsed: &Parsed, name: &str) -> Option<String> {
    parsed.values.iter().find(|(key, _)| key == name).map(|(_, value)| value.clone())
}

/// Entry point. `verb` is the command name, `args` is everything after it.
pub fn run(verb: &str, args: &[String]) -> ! {
    let cwd = env::current_dir().unwrap_or_else(|_| Path::new(".").to_path_buf());
    let detected = detect_package_manager(&cwd.to_string_lossy(), None);
    let pm = detected.name;
    let version = detected.version.unwrap_or_default();

    let resolved = match verb {
        "remove" => {
            let parsed = scan(args, &|token| match token {
                "-D" | "--save-dev" => Some(("save-dev", false)),
                "-g" | "--global" => Some(("global", false)),
                "-r" | "--recursive" => Some(("recursive", false)),
                "-w" | "--workspace-root" => Some(("workspace-root", false)),
                "-F" | "--filter" => Some(("filter", true)),
                _ => None,
            });

            resolve_remove(
                &pm,
                &version,
                RemoveOptions {
                    filter: collect(&parsed, "filter"),
                    global: has(&parsed, "global"),
                    packages: parsed.rest.clone(),
                    recursive: has(&parsed, "recursive"),
                    save_dev: has(&parsed, "save-dev"),
                    workspace_root: has(&parsed, "workspace-root"),
                },
            )
        }
        "dedupe" => {
            let check = args.iter().any(|token| token == "--check");

            resolve_dedupe(&pm, &version, check)
        }
        "link" => {
            // `link` takes a single optional target (first positional).
            let target = args.iter().find(|token| !token.starts_with('-')).cloned();

            resolve_link(&pm, &version, target)
        }
        "unlink" => {
            let parsed = scan(args, &|token| match token {
                "-r" | "--recursive" => Some(("recursive", false)),
                _ => None,
            });

            resolve_unlink(&pm, &version, parsed.rest.clone(), has(&parsed, "recursive"))
        }
        "outdated" => {
            let parsed = scan(args, &|token| match token {
                "--long" => Some(("long", false)),
                "-r" | "--recursive" => Some(("recursive", false)),
                "-w" | "--workspace-root" => Some(("workspace-root", false)),
                "-P" | "--prod" => Some(("prod", false)),
                "-D" | "--dev" => Some(("dev", false)),
                "--no-optional" => Some(("no-optional", false)),
                "--compatible" => Some(("compatible", false)),
                "-g" | "--global" => Some(("global", false)),
                "--format" => Some(("format", true)),
                "-F" | "--filter" => Some(("filter", true)),
                _ => None,
            });

            resolve_outdated(
                &pm,
                &version,
                OutdatedOptions {
                    compatible: has(&parsed, "compatible"),
                    dev: has(&parsed, "dev"),
                    filter: collect(&parsed, "filter"),
                    format: first(&parsed, "format").unwrap_or_else(|| "table".to_owned()),
                    global: has(&parsed, "global"),
                    long: has(&parsed, "long"),
                    no_optional: has(&parsed, "no-optional"),
                    packages: parsed.rest.clone(),
                    prod: has(&parsed, "prod"),
                    recursive: has(&parsed, "recursive"),
                    workspace_root: has(&parsed, "workspace-root"),
                },
            )
        }
        "why" => {
            let parsed = scan(args, &|token| match token {
                "--json" => Some(("json", false)),
                "--long" => Some(("long", false)),
                "--parseable" => Some(("parseable", false)),
                "-r" | "--recursive" => Some(("recursive", false)),
                "-D" | "--dev" => Some(("dev", false)),
                "-P" | "--prod" => Some(("prod", false)),
                "--no-optional" => Some(("no-optional", false)),
                "-g" | "--global" => Some(("global", false)),
                "--depth" => Some(("depth", true)),
                "-F" | "--filter" => Some(("filter", true)),
                _ => None,
            });

            resolve_why(
                &pm,
                &version,
                WhyOptions {
                    depth: first(&parsed, "depth").and_then(|value| value.parse::<i32>().ok()),
                    dev: has(&parsed, "dev"),
                    filter: collect(&parsed, "filter"),
                    global: has(&parsed, "global"),
                    json: has(&parsed, "json"),
                    long: has(&parsed, "long"),
                    no_optional: has(&parsed, "no-optional"),
                    packages: parsed.rest.clone(),
                    parseable: has(&parsed, "parseable"),
                    prod: has(&parsed, "prod"),
                    recursive: has(&parsed, "recursive"),
                },
            )
        }
        _ => unreachable!("unknown pm-family verb: {verb}"),
    };

    match resolved {
        Ok(command) => finish(verb, command, &cwd),
        Err(message) => {
            eprintln!("vis {verb}: {message}");
            exit(1);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{has, scan};

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|item| (*item).to_owned()).collect()
    }

    fn remove_alias(token: &str) -> Option<(&'static str, bool)> {
        match token {
            "-D" | "--save-dev" => Some(("save-dev", false)),
            "-F" | "--filter" => Some(("filter", true)),
            _ => None,
        }
    }

    #[test]
    fn consumes_known_flags_forwards_the_rest() {
        let parsed = scan(&args(&["-D", "lodash", "--unknown", "react"]), &remove_alias);

        assert!(has(&parsed, "save-dev"));
        // Packages AND the unknown flag are forwarded, in order.
        assert_eq!(parsed.rest, ["lodash", "--unknown", "react"]);
    }

    #[test]
    fn value_flag_both_forms() {
        let spaced = scan(&args(&["-F", "@scope/a", "pkg"]), &remove_alias);
        let equals = scan(&args(&["--filter=@scope/b", "pkg"]), &remove_alias);

        assert_eq!(super::collect(&spaced, "filter"), ["@scope/a"]);
        assert_eq!(super::collect(&equals, "filter"), ["@scope/b"]);
        assert_eq!(spaced.rest, ["pkg"]);
        assert_eq!(equals.rest, ["pkg"]);
    }
}
