//! Native port of the `vis __pm-shim <pm> [args...]` dispatcher.
//!
//! The `.vis/shims/<pm>` wrappers call `vis __pm-shim <pm> [args]`; this enforces
//! the project's pinned package manager (a "PM guard") and then execs the real
//! tool. The JS implementation lives in `src/commands/shim/dispatch.ts`; this is a
//! behaviourally identical, zero-Node reimplementation. The pure decision logic
//! (`decide`) mirrors `decideShim` and is covered by the same cases as the JS
//! unit tests.

use std::env;
use std::path::{Path, PathBuf};
use std::process::{exit, Command};

use vis_core::detect::pinned_package_manager;

/// A recognised shim: the canonical package-manager name it maps to, and whether
/// it is a one-off runner (npx/pnpx) that should always pass through the guard.
struct ShimEntry {
    pm: &'static str,
    runner: bool,
}

fn shim_entry(invoked: &str) -> Option<ShimEntry> {
    let (pm, runner) = match invoked {
        "npm" => ("npm", false),
        "npx" => ("npm", true),
        "pnpm" => ("pnpm", false),
        "pnpx" => ("pnpm", true),
        "yarn" | "yarnpkg" => ("yarn", false),
        _ => return None,
    };

    Some(ShimEntry { pm, runner })
}

/// Verbs that are transparent to the guard even on a PM mismatch (they scaffold
/// or run arbitrary tooling rather than mutate this project's deps).
const TRANSPARENT_VERBS: [&str; 4] = ["create", "dlx", "exec", "init"];

#[derive(Debug, PartialEq, Eq)]
enum Decision {
    Dispatch,
    Refuse,
}

/// Pure guard decision — mirrors `decideShim`. Unknown shims always dispatch (the
/// caller surfaces the error). A top-level mismatch against the pinned PM is
/// refused unless the invocation is a runner, a transparent verb, or nested
/// inside another PM.
fn decide(invoked: &str, pinned: Option<&str>, first_verb: Option<&str>, nested: bool) -> Decision {
    let entry = match shim_entry(invoked) {
        Some(entry) => entry,
        None => return Decision::Dispatch,
    };

    let transparent = entry.runner || first_verb.is_some_and(|verb| TRANSPARENT_VERBS.contains(&verb));
    let mismatch = matches!(pinned, Some(pinned) if pinned != entry.pm);

    if mismatch && !transparent && !nested {
        Decision::Refuse
    } else {
        Decision::Dispatch
    }
}

/// True when a package manager is already running (it sets these env vars),
/// meaning this invocation is nested and the guard should stand down.
fn is_nested() -> bool {
    env::var_os("npm_config_user_agent").is_some() || env::var_os("npm_execpath").is_some()
}

/// Find the real package-manager executable on PATH, skipping the `.vis/shims`
/// directory so the wrapper never re-invokes itself.
fn find_real_pm(invoked: &str) -> Option<PathBuf> {
    let candidates: Vec<String> = if cfg!(windows) {
        vec![format!("{invoked}.cmd"), format!("{invoked}.exe"), invoked.to_owned()]
    } else {
        vec![invoked.to_owned()]
    };

    for directory in env::split_paths(&env::var_os("PATH")?) {
        if directory.as_os_str().is_empty() {
            continue;
        }

        let trimmed = directory.to_string_lossy().trim_end_matches(['/', '\\']).to_owned();

        if trimmed.ends_with(".vis/shims") || trimmed.ends_with(".vis\\shims") {
            continue;
        }

        for candidate in &candidates {
            let full = directory.join(candidate);

            if full.is_file() {
                return Some(full);
            }
        }
    }

    None
}

/// Exec the real PM with inherited stdio, propagating its exit status (shell
/// convention `128 + signal` for signal-terminated children). Never returns.
fn exec_real(real: &Path, args: &[String]) -> ! {
    match Command::new(real).args(args).status() {
        Ok(status) => exit(crate::forward_code(status)),
        Err(_) => exit(1),
    }
}

/// Entry point for `vis __pm-shim <pm> [args...]`. Never returns.
pub fn dispatch(invoked: &str, args: &[String]) -> ! {
    if shim_entry(invoked).is_none() {
        eprintln!("vis: {invoked} is not a known package-manager shim.");
        exit(1);
    }

    let cwd = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let pinned = pinned_package_manager(&cwd.to_string_lossy());

    if decide(invoked, pinned.as_deref(), args.first().map(String::as_str), is_nested()) == Decision::Refuse {
        let pinned = pinned.as_deref().unwrap_or("");

        eprintln!(
            "vis: this project uses {pinned}, but `{invoked}` was run. Use `{pinned}` instead, or run `vis shim uninstall` to disable the PM guard."
        );
        exit(1);
    }

    match find_real_pm(invoked) {
        Some(real) => exec_real(&real, args),
        None => {
            eprintln!("vis: `{invoked}` was not found on PATH (outside the shim dir).");
            exit(1);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{decide, Decision};

    #[test]
    fn dispatches_on_agreement() {
        assert_eq!(decide("pnpm", Some("pnpm"), Some("install"), false), Decision::Dispatch);
    }

    #[test]
    fn refuses_top_level_mismatch() {
        assert_eq!(decide("npm", Some("pnpm"), Some("install"), false), Decision::Refuse);
    }

    #[test]
    fn falls_through_on_nested_mismatch() {
        assert_eq!(decide("npm", Some("pnpm"), Some("install"), true), Decision::Dispatch);
    }

    #[test]
    fn transparent_verbs_pass_despite_mismatch() {
        assert_eq!(decide("npm", Some("pnpm"), Some("create"), false), Decision::Dispatch);
    }

    #[test]
    fn runner_shims_always_dispatch() {
        assert_eq!(decide("npx", Some("pnpm"), Some("anything"), false), Decision::Dispatch);
    }

    #[test]
    fn dispatches_when_no_pin() {
        assert_eq!(decide("yarn", None, Some("install"), false), Decision::Dispatch);
    }

    #[test]
    fn unknown_shim_dispatches() {
        assert_eq!(decide("bun", Some("pnpm"), Some("install"), false), Decision::Dispatch);
    }
}
