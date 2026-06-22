//! Native `vis x <file> [args...]` — the file runner.
//!
//! Follows nub's model: a Rust front-end that spawns the project's Node with the
//! TS/`.env`/polyfill preload (`--import dist/runtime/preload.js`), or Bun. This
//! is a CHILD process (the Node lean path runs the target in-process); the
//! behaviour is equivalent for a file runner, and skipping the vis boot is the win.
//!
//! Edge cases that genuinely need the in-process / re-exec path are delegated back
//! to the Node lean path unchanged:
//!   - `--node` escape hatch (env-stripped plain Node),
//!   - `VIS_UNFLAG` / Yarn PnP (need Node *start* flags → re-exec),
//!   - `VIS_AUGMENT_SUBPROCESS` (NODE_OPTIONS propagation).
//!
//! Runtime resolution mirrors the lean path: `--runtime` / `VIS_RUNTIME` /
//! lockfile detection (the vis-config `runtime:` pin is intentionally not read,
//! same trade-off the lean path documents).

use std::env;
use std::path::{Path, PathBuf};
use std::process::{exit, Command};

use vis_core::detect::detect_package_manager;

enum Runtime {
    Bun,
    Node,
}

struct Parsed {
    node: bool,
    runtime_flag: Option<String>,
    file: Option<String>,
    script_args: Vec<String>,
}

/// Parse the tokens after `vis x`. Mirrors `parseLeanXArgs`: `--node` / `--runtime`
/// are recognised only BEFORE the file; the first other token is the file and
/// everything after it is forwarded to the script (a single leading `--` between
/// the file and its args is consumed).
fn parse(args: &[String]) -> Parsed {
    let mut node = false;
    let mut runtime_flag = None;
    let mut file = None;
    let mut script_args = Vec::new();
    let mut index = 0;

    while index < args.len() {
        let token = &args[index];

        if file.is_some() {
            script_args.push(token.clone());
            index += 1;
            continue;
        }

        match token.as_str() {
            "--node" => node = true,
            "--runtime" => {
                runtime_flag = args.get(index + 1).cloned();
                index += 1;
            }
            other if other.starts_with("--runtime=") => {
                runtime_flag = Some(other["--runtime=".len()..].to_owned());
            }
            other => {
                file = Some(other.to_owned());
            }
        }

        index += 1;
    }

    if script_args.first().map(String::as_str) == Some("--") {
        script_args.remove(0);
    }

    Parsed { file, node, runtime_flag, script_args }
}

/// Resolve node vs bun: explicit `--runtime`/`VIS_RUNTIME` wins, else a bun
/// lockfile (`bun.lock`/`bun.lockb`, via the PM detector) selects bun, else node.
fn resolve_runtime(flag: Option<&str>, cwd: &str) -> Runtime {
    let explicit = flag.map(str::to_owned).or_else(|| env::var("VIS_RUNTIME").ok());

    if let Some(runtime) = explicit.as_deref() {
        return if runtime == "bun" { Runtime::Bun } else { Runtime::Node };
    }

    if detect_package_manager(cwd, None).name == "bun" {
        Runtime::Bun
    } else {
        Runtime::Node
    }
}

/// True when the runner needs the Node in-process / re-exec path (start flags or
/// loader propagation), which the native child-spawn can't provide.
fn needs_node_path(node_flag: bool, cwd: &Path) -> bool {
    node_flag
        || env::var_os("VIS_UNFLAG").is_some()
        || env::var_os("VIS_AUGMENT_SUBPROCESS").is_some()
        || cwd.join(".pnp.cjs").exists()
}

/// The TS/.env/polyfill preload, derived from the JS fallback entry
/// (`<pkg>/dist/bin.js` → `<pkg>/dist/runtime/preload.js`).
fn preload_path() -> Option<PathBuf> {
    let entry = env::var_os("VIS_FALLBACK_ENTRY")?;

    Path::new(&entry).parent().map(|dist| dist.join("runtime").join("preload.js"))
}

fn spawn_and_exit(mut command: Command) -> ! {
    match command.status() {
        Ok(status) => exit(crate::forward_code(status)),
        Err(error) => {
            eprintln!("vis x: failed to launch runtime: {error}");
            exit(127);
        }
    }
}

/// Entry point. `args` is the full invocation including the leading `x` (so the
/// Node-fallback path can replay it verbatim). Never returns.
pub fn run(args: &[String]) -> ! {
    let rest = if args.len() > 1 { &args[1..] } else { &[] };
    let parsed = parse(rest);

    let file = match parsed.file {
        Some(file) => file,
        None => {
            eprintln!("No file specified. Usage: vis x <file> [args...]");
            exit(1);
        }
    };

    let cwd = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));

    // Edge cases → hand the whole invocation back to the Node lean path.
    if needs_node_path(parsed.node, &cwd) {
        crate::delegate(args);
    }

    let absolute = if Path::new(&file).is_absolute() { file } else { cwd.join(&file).to_string_lossy().into_owned() };

    match resolve_runtime(parsed.runtime_flag.as_deref(), &cwd.to_string_lossy()) {
        Runtime::Bun => {
            let mut command = Command::new("bun");

            command.arg("run").arg(&absolute).args(&parsed.script_args).current_dir(&cwd);
            spawn_and_exit(command);
        }
        Runtime::Node => {
            let preload = match preload_path() {
                Some(preload) => preload,
                None => {
                    // No launcher contract (run directly) — fall back to Node.
                    crate::delegate(args);
                }
            };

            let node = env::var("VIS_NODE").unwrap_or_else(|_| "node".to_owned());
            let mut command = Command::new(node);

            command.arg("--import").arg(&preload).arg(&absolute).args(&parsed.script_args).current_dir(&cwd);
            spawn_and_exit(command);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::parse;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|item| (*item).to_owned()).collect()
    }

    #[test]
    fn first_positional_is_the_file_rest_forwarded() {
        let parsed = parse(&args(&["app.ts", "--watch", "x"]));

        assert_eq!(parsed.file.as_deref(), Some("app.ts"));
        assert_eq!(parsed.script_args, ["--watch", "x"]);
        assert!(!parsed.node);
    }

    #[test]
    fn runtime_flag_before_file_in_both_forms() {
        assert_eq!(parse(&args(&["--runtime", "bun", "f.ts"])).runtime_flag.as_deref(), Some("bun"));
        assert_eq!(parse(&args(&["--runtime=bun", "f.ts"])).runtime_flag.as_deref(), Some("bun"));
    }

    #[test]
    fn node_flag_before_file() {
        let parsed = parse(&args(&["--node", "f.ts", "a"]));

        assert!(parsed.node);
        assert_eq!(parsed.file.as_deref(), Some("f.ts"));
        assert_eq!(parsed.script_args, ["a"]);
    }

    #[test]
    fn leading_double_dash_between_file_and_args_is_consumed() {
        let parsed = parse(&args(&["f.ts", "--", "--watch"]));

        assert_eq!(parsed.file.as_deref(), Some("f.ts"));
        assert_eq!(parsed.script_args, ["--watch"]);
    }

    #[test]
    fn flags_after_the_file_belong_to_the_script() {
        let parsed = parse(&args(&["f.ts", "--runtime", "bun"]));

        assert_eq!(parsed.file.as_deref(), Some("f.ts"));
        assert_eq!(parsed.runtime_flag, None);
        assert_eq!(parsed.script_args, ["--runtime", "bun"]);
    }
}
