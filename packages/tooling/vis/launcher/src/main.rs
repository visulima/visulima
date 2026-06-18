//! vis Rust launcher (PoC).
//!
//! A thin native front-end for the `vis` CLI. Static commands that need no
//! JavaScript (`--version`) are answered directly in Rust — instant, no Node
//! boot. Everything else spawns Node on the bundled JS CLI, inheriting stdio and
//! propagating the exit code. This mirrors how nub's Rust binary fronts Node.
//!
//! Resolution is intentionally simple for the PoC:
//!   - Node binary: `$VIS_NODE` or `node` on PATH.
//!   - JS dist dir: `$VIS_DIST_DIR`, else `<exe>/../../../dist` (dev layout).
//! The published layout (launcher in a per-platform package, dist in the main
//! package) is handled by the JS shim that sets `$VIS_DIST_DIR` — see the RFC.

use std::env;
use std::path::PathBuf;
use std::process::{exit, Command};

fn dist_dir() -> PathBuf {
    if let Ok(dir) = env::var("VIS_DIST_DIR") {
        return PathBuf::from(dir);
    }

    // Dev fallback: target/release/vis → up to the launcher crate dir, then ../dist.
    if let Ok(exe) = env::current_exe() {
        // exe = .../launcher/target/release/vis ; nth(3) = .../launcher
        if let Some(launcher_dir) = exe.ancestors().nth(3) {
            return launcher_dir.join("..").join("dist");
        }
    }

    PathBuf::from("dist")
}

fn node_bin() -> String {
    env::var("VIS_NODE").unwrap_or_else(|_| "node".to_owned())
}

fn main() {
    let argv: Vec<String> = env::args().collect();
    let command = argv.get(1).map(String::as_str).unwrap_or("");

    // Static fast path: print the version in Rust, no Node spawn.
    if command == "--version" || command == "-v" {
        println!("{}", env!("VIS_LAUNCHER_VERSION"));
        exit(0);
    }

    // Everything else: spawn Node on the JS CLI. Heap flags are set HERE so the
    // JS side never re-execs for heap tuning (it honours VIS_HEAP_TUNED).
    let dist = dist_dir();
    let mut node = Command::new(node_bin());

    node.arg(dist.join("bin.js"));
    node.args(&argv[1..]);
    node.env("VIS_HEAP_TUNED", "1");

    match node.status() {
        Ok(status) => exit(status.code().unwrap_or(1)),
        Err(error) => {
            eprintln!("vis: failed to launch node ({error}). Is Node on PATH?");
            exit(1);
        }
    }
}
