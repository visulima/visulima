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

mod flags;
mod heap;
mod node_version;
mod pm;

use std::env;
use std::path::PathBuf;
use std::process::{exit, Command};

use node_version::NodeVersion;

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

/// Runtimes the launcher's `x` fast path handles natively. Anything else (deno,
/// unknown) returns None so the JS CLI resolves and errors.
enum XRuntime {
    Node,
    Bun,
}

/// Resolve the `vis x` runtime with the lean path's precedence: explicit
/// `--runtime`, then `VIS_RUNTIME`, then a bun lockfile (→ bun), else node.
fn resolve_x_runtime(flag: Option<&str>, cwd: &std::path::Path) -> Option<XRuntime> {
    let explicit = flag.map(str::to_owned).or_else(|| env::var("VIS_RUNTIME").ok());

    match explicit.as_deref() {
        Some("node") => return Some(XRuntime::Node),
        Some("bun") => return Some(XRuntime::Bun),
        Some(_) => return None, // deno/unknown → delegate to JS for resolution/errors
        None => {}
    }

    // No explicit choice: a bun lockfile implies the bun runtime, otherwise node.
    if matches!(pm::detect(cwd), pm::Pm::Bun) {
        Some(XRuntime::Bun)
    } else {
        Some(XRuntime::Node)
    }
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

    // Native fast path: `x <file> [args]` runs the file directly under the
    // resolved runtime — no vis JS dispatcher. Mirrors the lean path's runtime
    // precedence (flag → VIS_RUNTIME → lockfile → node; the vis-config pin is
    // intentionally skipped here too). Only Node >= 22.15 (registerHooks) takes the
    // preload path; bun runs natively; anything else delegates to the JS CLI.
    if command == "x" {
        let (runtime_flag, rest) = split_runtime(&argv[2..]);

        if !rest.is_empty() {
            let cwd = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));

            match resolve_x_runtime(runtime_flag.as_deref(), &cwd) {
                Some(XRuntime::Bun) => {
                    // bun transpiles TS/JSX natively and autoloads .env itself.
                    let mut bun = Command::new("bun");

                    bun.arg("run");
                    bun.args(&rest);
                    run(bun, "bun");
                }
                Some(XRuntime::Node) => {
                    let node_bin = node_bin();
                    let version = node_version::detect(&node_bin);

                    if version.map(NodeVersion::has_register_hooks).unwrap_or(false) {
                        // node [unflags] --import <preload> <file> [args]: the preload
                        // registers the oxc loader + autoloads .env, then Node runs
                        // <file> as its own entry (process.argv = [node, file, …]).
                        let preload = dist_dir().join("runtime").join("preload.js");
                        let mut node = Command::new(node_bin);

                        // Opt-in unflag layer: version-gated experimental flags for
                        // the user script (no-op unless VIS_UNFLAG is set).
                        if let (Ok(spec), Some(v)) = (env::var("VIS_UNFLAG"), version) {
                            node.args(flags::unflag_args(&spec, v));
                        }

                        node.arg("--import");
                        node.arg(&preload);
                        node.args(&rest);
                        run(node, "node");
                    }
                    // Node < 22.15 (or version unknown): fall through to the JS CLI,
                    // whose in-process path has the 22.14 temp-file fallback.
                }
                // Unknown/other runtime: let the JS CLI resolve + error cleanly.
                None => {}
            }
        }
        // Empty/fallthrough: delegate to `node dist/bin.js x …` below.
    }

    // Everything else: spawn Node on the JS CLI. When RAM is detectable we apply
    // the heap flags here (mirroring cerebro) and set VIS_HEAP_TUNED so the JS side
    // skips its re-exec — heap tuned once, no second boot. When RAM is undetectable
    // (e.g. Windows for now) we leave VIS_HEAP_TUNED unset so the JS side tunes
    // itself: correct, just one extra boot.
    let dist = dist_dir();
    let mut node = Command::new(node_bin());

    if let Some((old_space, semi_space)) = heap::flags() {
        node.arg(format!("--max-old-space-size={old_space}"));
        node.arg(format!("--max-semi-space-size={semi_space}"));
        node.env("VIS_HEAP_TUNED", "1");
    }

    node.arg(dist.join("bin.js"));
    node.args(&argv[1..]);

    run(node, "node");
}
