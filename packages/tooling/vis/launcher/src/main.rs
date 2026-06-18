//! vis Rust launcher (PoC) — the hybrid CLI's native front-end.
//!
//! Fast commands are handled in Rust with no Node boot and no napi addon:
//! - `--version` → baked version string.
//! - `exec` / `dlx` → detect the package manager and spawn it directly
//!   (`securityEnforcementPlugin` gates only install/PM verbs, not these).
//!
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
mod shim;

use std::env;
use std::path::{Path, PathBuf};
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

/// Commands that skip V8 heap tuning — MUST stay in lockstep with bin.ts's
/// `HEAP_TUNING_SKIP` (light commands that do no heavy in-process work). If you
/// change one, change the other; `heap_tuning_skipped` mirrors bin.ts's full
/// condition (the set plus an explicit `--help`/`-h` anywhere).
const HEAP_TUNING_SKIP: &[&str] = &["", "--help", "--version", "-h", "-v", "completion", "dlx", "exec", "x"];

/// Whether the delegated Node spawn should skip heap tuning, matching bin.ts:
/// the first command is in the skip set, or `--help`/`-h` appears anywhere.
fn heap_tuning_skipped(command: &str, argv: &[String]) -> bool {
    HEAP_TUNING_SKIP.contains(&command) || argv.iter().any(|argument| argument == "--help" || argument == "-h")
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

/// Find the real PM binary on PATH, skipping any entry that resolves to our own
/// binary — the recursion guard. The shim symlinks (`.vis/shims/<pm>`) all point
/// at the launcher, so canonicalizing a candidate and comparing it to our
/// `current_exe` skips every shim regardless of how argv0 was spelled.
fn find_real_pm(name: &str) -> Option<PathBuf> {
    let self_exe = env::current_exe().ok().and_then(|p| p.canonicalize().ok());
    let paths = env::var_os("PATH")?;

    // Names to try in each dir: bare on unix; `.cmd`/`.exe` shims on windows.
    #[cfg(windows)]
    let candidates: Vec<String> = vec![format!("{name}.cmd"), format!("{name}.exe"), name.to_owned()];
    #[cfg(not(windows))]
    let candidates: Vec<String> = vec![name.to_owned()];

    for dir in env::split_paths(&paths) {
        for candidate_name in &candidates {
            let candidate = dir.join(candidate_name);

            if !candidate.is_file() {
                continue;
            }

            // Recursion guard: skip if this is (a symlink to) our own binary.
            if let (Some(self_canon), Ok(candidate_canon)) = (&self_exe, candidate.canonicalize()) {
                if &candidate_canon == self_canon {
                    continue;
                }
            }

            return Some(candidate);
        }
    }

    None
}

/// Run the PM-shim flow: decide based on the project's pin + invocation context,
/// then either exec the real PM or refuse with guidance. Never returns.
fn run_shim(invoked: shim::ShimName, args: &[String]) -> ! {
    let cwd = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    // Pin from the packageManager field (authoritative) then lockfile.
    let pinned = pm::pinned(&cwd);
    // nub matches the FIRST token verbatim — a flag before the verb is not treated
    // as the verb, so strictness errs toward refusing.
    let first_verb = args.first().map(String::as_str);
    let nesting = shim::Nesting::from_env(|key| env::var(key).ok());

    match shim::decide(invoked, pinned, first_verb, nesting) {
        shim::ShimDecision::Refuse { invoked, pinned } => {
            eprintln!(
                "vis: this project uses {pin}, but `{got}` was run. Use `{pin}` instead, or run \
                 `vis shim uninstall` to disable the PM guard.",
                pin = pm::binary(pinned),
                got = invoked.as_str(),
            );
            exit(1);
        }
        shim::ShimDecision::Dispatch => match find_real_pm(invoked.as_str()) {
            Some(real) => {
                let mut command = Command::new(real);

                command.args(args);
                run(command, invoked.as_str());
            }
            None => {
                eprintln!("vis: `{}` was not found on PATH (outside the shim dir).", invoked.as_str());
                exit(1);
            }
        },
    }
}

/// Native fast path for `exec`/`dlx` (and `visx` = dlx): detect the PM and spawn
/// it directly, no Node CLI. `tokens` is everything after the verb. Returns
/// without running (falls through to the JS CLI) when the invocation is flag-led
/// or empty — a leading flag is a vis-specific option (`--offline`, `--package`,
/// `-h`, …) the JS resolver must expand, and an empty target needs the JS usage
/// error. On the fast path it runs the PM and never returns.
fn try_pm_fastpath(verb: &str, tokens: &[String]) {
    let (runtime, rest) = split_runtime(tokens);

    if rest.first().is_none_or(|first| first.starts_with('-')) {
        return; // flag-led or empty → caller delegates to JS
    }

    let cwd = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let manager = if runtime.as_deref() == Some("bun") {
        pm::Pm::Bun
    } else {
        pm::detect(&cwd)
    };

    let args = if verb == "exec" {
        pm::exec_args(manager, &rest)
    } else {
        pm::dlx_args(manager, &rest)
    };

    let mut spawn = Command::new(pm::binary(manager));

    spawn.args(&args);
    run(spawn, pm::binary(manager));
}

fn main() {
    let argv: Vec<String> = env::args().collect();

    // visx / vx: the npx-style dlx-only entry. Invoked under that name (its own bin,
    // not `vis`), the whole invocation is `dlx <args>`. Native dlx dispatch (ungated,
    // same as `vis dlx`); flag-led/empty falls through to the lean JS `binx.js`.
    let program_stem = argv.first().map(Path::new).and_then(|p| p.file_stem()).and_then(|s| s.to_str());

    if matches!(program_stem, Some("visx" | "vx")) {
        let first = argv.get(1).map(String::as_str).unwrap_or("");

        if first == "--version" || first == "-v" || first == "-V" {
            println!("{}", env!("VIS_LAUNCHER_VERSION"));
            exit(0);
        }

        try_pm_fastpath("dlx", &argv[1..]);

        // Fall through: delegate to the lean dlx-only JS entry.
        let mut node = Command::new(node_bin());

        node.arg(dist_dir().join("binx.js"));
        node.args(&argv[1..]);
        run(node, "node");
    }

    // PM-shim dispatch: when invoked as npm/pnpm/yarn/npx/pnpx/yarnpkg (via the
    // opt-in `.vis/shims/<pm>` symlinks, NOT as `vis`), run the agreement flow
    // instead of the normal CLI. argv0's file stem is the invoked name.
    let shim_invoked = argv
        .first()
        .map(Path::new)
        .and_then(|path| path.file_stem())
        .and_then(|stem| stem.to_str())
        .and_then(shim::ShimName::parse);

    if let Some(invoked) = shim_invoked {
        run_shim(invoked, &argv[1..]);
    }

    let command = argv.get(1).map(String::as_str).unwrap_or("");

    // Static fast path: version in Rust, no Node.
    if command == "--version" || command == "-v" {
        println!("{}", env!("VIS_LAUNCHER_VERSION"));
        exit(0);
    }

    // Native fast path: exec / dlx → detect the PM and spawn it directly. No Node
    // CLI boot, no napi. `--runtime bun` forces bun (bunx / bun x).
    //
    // Only the clean `<bin> [args]` shape is fast-pathed. A leading flag means a
    // vis-specific option (`--offline`, `--silent`, `--shell`, `--package`, `-h`,
    // …) that the JS resolver expands into PM-specific flags — the launcher's
    // simple mapping would forward it raw to the PM and diverge — so it falls
    // through to the JS CLI below. An empty target also delegates (JS owns the
    // usage error, single source).
    if command == "exec" || command == "dlx" {
        try_pm_fastpath(command, &argv[2..]);
        // Flag-led or empty: fall through to `node dist/bin.js <command> …`.
    }

    // Native fast path: `x <file> [args]` runs the file directly under the
    // resolved runtime — no vis JS dispatcher. Mirrors the lean path's runtime
    // precedence (flag → VIS_RUNTIME → lockfile → node; the vis-config pin is
    // intentionally skipped here too). Only Node >= 22.15 (registerHooks) takes the
    // preload path; bun runs natively; anything else delegates to the JS CLI.
    if command == "x" {
        let (runtime_flag, mut rest) = split_runtime(&argv[2..]);

        // Consume a single `--` separating the file from its args, matching the
        // JS lean parser (`parseLeanXArgs`) so both paths hand the script the same
        // argv. `rest[0]` is the file; a `--` at `rest[1]` is the separator.
        if rest.get(1).map(String::as_str) == Some("--") {
            rest.remove(1);
        }

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
    //
    // A user-set `--max-old-space-size` (via NODE_OPTIONS) is RESPECTED, not
    // overridden — matching cerebro's `applyHeapTuning`, which no-ops when the flag
    // is already present. We then skip our flags AND VIS_HEAP_TUNED so the JS side
    // runs its (also-respecting) tuning: it sees the user's flag and no-ops too.
    //
    // Light commands skip heap tuning entirely, exactly as bin.ts does — so
    // `vis --help` behaves the same with or without the launcher. When we skip, we
    // also leave VIS_HEAP_TUNED unset, so the JS side runs its own (identically
    // skipping) check and no tuning happens either way. A user-set
    // `--max-old-space-size` (via NODE_OPTIONS) is likewise respected, not
    // overridden (matching cerebro's applyHeapTuning, which no-ops when present).
    let dist = dist_dir();
    let mut node = Command::new(node_bin());

    let user_set_heap = env::var("NODE_OPTIONS").is_ok_and(|opts| opts.contains("--max-old-space-size"));
    let skip_heap = heap_tuning_skipped(command, &argv);

    if let (false, false, Some((old_space, semi_space))) = (skip_heap, user_set_heap, heap::flags()) {
        node.arg(format!("--max-old-space-size={old_space}"));
        node.arg(format!("--max-semi-space-size={semi_space}"));
        node.env("VIS_HEAP_TUNED", "1");
    }

    node.arg(dist.join("bin.js"));
    node.args(&argv[1..]);

    run(node, "node");
}

#[cfg(test)]
mod tests {
    use super::heap_tuning_skipped;

    fn v(items: &[&str]) -> Vec<String> {
        items.iter().map(|s| (*s).to_owned()).collect()
    }

    #[test]
    fn skips_light_commands_like_bin_ts() {
        assert!(heap_tuning_skipped("", &v(&[])));
        assert!(heap_tuning_skipped("completion", &v(&["completion"])));
        assert!(heap_tuning_skipped("--help", &v(&["--help"])));
        // --help/-h anywhere in argv skips, matching bin.ts.
        assert!(heap_tuning_skipped("run", &v(&["run", "--help"])));
        assert!(heap_tuning_skipped("audit", &v(&["audit", "-h"])));
    }

    #[test]
    fn tunes_heavy_commands() {
        assert!(!heap_tuning_skipped("run", &v(&["run", "build"])));
        assert!(!heap_tuning_skipped("audit", &v(&["audit"])));
        assert!(!heap_tuning_skipped("sbom", &v(&["sbom"])));
    }
}
