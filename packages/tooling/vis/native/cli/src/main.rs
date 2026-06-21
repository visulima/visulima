//! `vis` native CLI front-end — the startup + dispatch shell.
//!
//! This binary is the fast entry point for the `vis` CLI during the incremental
//! Rust migration. It answers the commands that are implemented natively and
//! delegates everything else, verbatim, to the existing Node CLI (`dist/bin.js`)
//! so behaviour is byte-identical to the pure-JS tool while commands are ported
//! over one at a time.
//!
//! ## Delegation contract
//!
//! The JS launcher (`bin/vis.mjs`) resolves the platform binary and the Node
//! environment, then sets:
//!
//! | env var              | meaning                                            |
//! | -------------------- | -------------------------------------------------- |
//! | `VIS_NODE`           | absolute path to the Node executable to spawn      |
//! | `VIS_FALLBACK_ENTRY` | absolute path to the JS entry (`dist/bin.js`)      |
//! | `VIS_VERSION`        | the `@visulima/vis` package version string         |
//!
//! When the binary is run directly (no launcher), `VIS_NODE` falls back to
//! `node` from `PATH`; `VIS_FALLBACK_ENTRY` has no safe default and delegation
//! fails loudly if it is unset.

use std::env;
use std::process::{exit, Command, ExitStatus};

mod exec;
mod pm_shim;

/// Internal, additive diagnostic command. Used to validate the
/// launcher → binary → native-output path without touching any existing
/// command surface.
const NATIVE_INFO: &str = "__native-info";

/// `EX_SOFTWARE` from sysexits.h — internal error (cannot delegate).
const EX_SOFTWARE: i32 = 70;

fn main() {
    // argv[0] is the binary path; the remainder is the `vis` invocation,
    // forwarded verbatim by the JS launcher.
    let args: Vec<String> = env::args().skip(1).collect();
    let first = args.first().map(String::as_str).unwrap_or("");

    match first {
        NATIVE_INFO => native_info(),
        // `--version` / `-V` print the bare semver (same as cerebro's version
        // command). NOTE: `-v` is cerebro's *verbose* flag, not version, so it is
        // intentionally NOT routed here and falls through to Node.
        "--version" | "-V" => print_version(),
        // `vis __pm-shim <pm> [args...]` — the package-manager guard + exec,
        // ported fully native (no Node in the loop).
        "__pm-shim" => {
            let invoked = args.get(1).map(String::as_str).unwrap_or("");
            let rest = if args.len() > 2 { &args[2..] } else { &[] };

            pm_shim::dispatch(invoked, rest);
        }
        // `vis exec <command>` — run a local bin via the project PM. Matches the
        // Node lean exec path (runtime/lockfile detection, no config load).
        "exec" => exec::run(if args.len() > 1 { &args[1..] } else { &[] }),
        // Native command routing is added here as commands are ported off Node.
        // Every unmatched invocation is delegated unchanged to the Node CLI.
        _ => delegate(&args),
    }
}

/// Print the bare package version (`<semver>\n`, matching cerebro). The launcher
/// injects VIS_VERSION from package.json; the crate version is a dev fallback for
/// direct invocation.
fn print_version() {
    match env::var("VIS_VERSION") {
        Ok(version) => println!("{version}"),
        Err(_) => println!("{}", env!("CARGO_PKG_VERSION")),
    }
}

/// Print front-end diagnostics. Purely additive — it has no Node counterpart, so
/// it cannot regress existing behaviour.
fn native_info() {
    let unset = || "<unset>".to_owned();

    println!("vis native front-end");
    println!("  binary-version : {}", env!("CARGO_PKG_VERSION"));
    println!("  os             : {}", env::consts::OS);
    println!("  arch           : {}", env::consts::ARCH);
    println!("  node           : {}", env::var("VIS_NODE").unwrap_or_else(|_| unset()));
    println!("  fallback-entry : {}", env::var("VIS_FALLBACK_ENTRY").unwrap_or_else(|_| unset()));
    println!("  pkg-version    : {}", env::var("VIS_VERSION").unwrap_or_else(|_| unset()));
}

/// Hand the full argv off to the Node CLI, inheriting stdio and forwarding the
/// child's exit status. Never returns.
fn delegate(args: &[String]) -> ! {
    let node = env::var("VIS_NODE").unwrap_or_else(|_| "node".to_owned());

    let entry = match env::var("VIS_FALLBACK_ENTRY") {
        Ok(path) => path,
        Err(_) => {
            eprintln!("vis: VIS_FALLBACK_ENTRY is not set; cannot delegate to the Node CLI.");
            exit(EX_SOFTWARE);
        }
    };

    // stdio is inherited by default, so the child shares the controlling
    // terminal and process group — Ctrl-C / SIGINT reach it directly.
    match Command::new(&node).arg(&entry).args(args).status() {
        Ok(status) => exit(forward_code(status)),
        Err(error) => {
            eprintln!("vis: failed to launch Node CLI ('{node}'): {error}");
            exit(EX_SOFTWARE);
        }
    }
}

/// Translate a child `ExitStatus` into the exit code this process should adopt,
/// following the shell convention of `128 + signal` for signal-terminated
/// children.
fn forward_code(status: ExitStatus) -> i32 {
    if let Some(code) = status.code() {
        return code;
    }

    #[cfg(unix)]
    {
        use std::os::unix::process::ExitStatusExt;

        if let Some(signal) = status.signal() {
            return 128 + signal;
        }
    }

    1
}
