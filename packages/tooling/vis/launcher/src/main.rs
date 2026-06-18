//! vis Rust launcher (PoC) — the hybrid CLI's native front-end.
//!
//! Fast commands are handled in Rust with no Node boot and no napi addon:
//!   - `--version` → baked version string.
//!   - `exec` / `dlx` → detect the package manager and spawn it directly
//!     (`securityEnforcementPlugin` gates only install/PM verbs, not these).
//! Everything else spawns Node on the bundled JS CLI (`dist/bin.js`), setting
//! `VIS_HEAP_TUNED` so the JS side skips its heap re-exec. This mirrors how nub's
//! Rust binary fronts Node — fast paths native, heavy/orchestration delegated.
//!
//! Resolution (PoC): Node = `$VIS_NODE` or `node`; dist = `$VIS_DIST_DIR` or a
//! dev fallback next to the binary. The published bin-shim sets `$VIS_DIST_DIR`.

mod pm;

use std::env;
use std::path::PathBuf;
use std::process::{exit, Command};

fn dist_dir() -> PathBuf {
    if let Ok(dir) = env::var("VIS_DIST_DIR") {
        return PathBuf::from(dir);
    }

    if let Ok(exe) = env::current_exe() {
        if let Some(launcher_dir) = exe.ancestors().nth(3) {
            return launcher_dir.join("..").join("dist");
        }
    }

    PathBuf::from("dist")
}

fn node_bin() -> String {
    env::var("VIS_NODE").unwrap_or_else(|_| "node".to_owned())
}

/// Spawn a command, inherit stdio, exit with its code. Never returns on success.
fn run(mut command: Command, what: &str) -> ! {
    match command.status() {
        Ok(status) => exit(status.code().unwrap_or(1)),
        Err(error) => {
            eprintln!("vis: failed to launch {what} ({error}).");
            exit(1);
        }
    }
}

/// Split `vis exec/dlx` tokens into an optional `--runtime` value (only honoured
/// before the bin) and the rest (bin + its args), which pass through verbatim.
fn split_runtime(tokens: &[String]) -> (Option<String>, Vec<String>) {
    let mut runtime = None;
    let mut index = 0;

    while index < tokens.len() {
        let token = &tokens[index];

        if let Some(value) = token.strip_prefix("--runtime=") {
            runtime = Some(value.to_owned());
            index += 1;
        } else if token == "--runtime" {
            runtime = tokens.get(index + 1).cloned();
            index += 2;
        } else {
            break;
        }
    }

    (runtime, tokens[index..].to_vec())
}

fn main() {
    let argv: Vec<String> = env::args().collect();
    let command = argv.get(1).map(String::as_str).unwrap_or("");

    // Static fast path: version in Rust, no Node.
    if command == "--version" || command == "-v" {
        println!("{}", env!("VIS_LAUNCHER_VERSION"));
        exit(0);
    }

    // Native fast path: exec / dlx → detect the PM and spawn it directly. No Node
    // CLI boot, no napi. `--runtime bun` forces bun (bunx / bun x).
    if command == "exec" || command == "dlx" {
        let (runtime, rest) = split_runtime(&argv[2..]);

        if rest.is_empty() {
            eprintln!("vis: no {command} target. Usage: vis {command} <name> [args...]");
            exit(1);
        }

        let cwd = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let manager = if runtime.as_deref() == Some("bun") {
            pm::Pm::Bun
        } else {
            pm::detect(&cwd)
        };

        let args = if command == "exec" {
            pm::exec_args(manager, &rest)
        } else {
            pm::dlx_args(manager, &rest)
        };

        let mut spawn = Command::new(pm::binary(manager));

        spawn.args(&args);
        run(spawn, pm::binary(manager));
    }

    // Everything else: spawn Node on the JS CLI; heap flags handled here so the JS
    // side skips its re-exec (it honours VIS_HEAP_TUNED).
    let dist = dist_dir();
    let mut node = Command::new(node_bin());

    node.arg(dist.join("bin.js"));
    node.args(&argv[1..]);
    node.env("VIS_HEAP_TUNED", "1");

    run(node, "node");
}
