//! Native `vis pm <subcommand> [args...]` — package-manager utility passthrough
//! (cache, publish, audit, list, view, config, …).
//!
//! Matches the Node handler (src/commands/pm/handler.ts): detect the PM, map the
//! subcommand via `resolve_pm_command`, and exec it. `pm` defines no options, so
//! everything after the subcommand is forwarded to the PM (the Node handler was
//! fixed to do the same instead of dropping flags).

use std::env;
use std::process::{exit, Command};

use vis_core::detect::detect_package_manager;
use vis_core::resolve::resolve_pm_command;

const USAGE: &str = "vis pm: No subcommand specified. Available: cache, publish, audit, list, view, config, whoami, login, logout, pack, owner, dist-tag, search, fund, ping, token, deprecate, rebuild, prune, plugin";

/// Entry point. `args` is everything after the `pm` subcommand. Never returns.
pub fn run(args: &[String]) -> ! {
    let subcommand = match args.first() {
        Some(subcommand) => subcommand.as_str(),
        None => {
            eprintln!("{USAGE}");
            exit(1);
        }
    };

    let extra = if args.len() > 1 { args[1..].to_vec() } else { Vec::new() };

    let cwd = env::current_dir().map(|path| path.to_string_lossy().into_owned()).unwrap_or_else(|_| ".".to_owned());
    let detected = detect_package_manager(&cwd, None);

    let resolved = match resolve_pm_command(&detected.name, &detected.version.unwrap_or_default(), subcommand, extra) {
        Ok(resolved) => resolved,
        Err(message) => {
            eprintln!("vis pm: {message}");
            exit(1);
        }
    };

    for warning in &resolved.warnings {
        eprintln!("vis pm: {warning}");
    }

    match Command::new(&resolved.bin).args(&resolved.args).current_dir(&cwd).status() {
        Ok(status) => exit(crate::forward_code(status)),
        Err(error) => {
            eprintln!("vis pm: failed to run '{}': {error}", resolved.bin);
            exit(127);
        }
    }
}
