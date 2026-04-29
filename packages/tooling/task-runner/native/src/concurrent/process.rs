use std::time::Instant;

use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;

use super::process_group;
use super::types::{ConcurrentCloseEvent, ConcurrentCommandConfig, ProcessEvent};

/// Spawn a child process and stream its output.
///
/// SAFETY: Commands executed here originate from package.json scripts,
/// not from untrusted user input. Shell execution is required to support
/// shell features (pipes, redirects, env expansion) that package scripts rely on.
///
/// This function spawns the process, starts async tasks for reading stdout/stderr,
/// and spawns a task that waits for both I/O streams to drain AND the process to
/// exit before sending a `CompletionMessage` on the provided channel.
/// This guarantees all stdout/stderr events arrive before the close event.
pub fn spawn_process(
    index: u32,
    config: &ConcurrentCommandConfig,
    event_tx: mpsc::UnboundedSender<ProcessEvent>,
    completion_tx: mpsc::UnboundedSender<CompletionMessage>,
    shell_path: Option<&str>,
) -> Result<ProcessInfo, std::io::Error> {
    let mut cmd = build_command(config, shell_path);
    let mut child = cmd.spawn()?;
    let start_time = Instant::now();

    let pid = child.id();

    // Spawn stdout reader -- returns JoinHandle so we can wait for it
    let stdout_handle: Option<JoinHandle<()>> = child.stdout.take().map(|stdout| {
        let tx = event_tx.clone();
        let idx = index;
        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = tx.send(ProcessEvent::stdout(idx, line));
            }
        })
    });

    // Spawn stderr reader -- returns JoinHandle so we can wait for it
    let stderr_handle: Option<JoinHandle<()>> = child.stderr.take().map(|stderr| {
        let tx = event_tx.clone();
        let idx = index;
        tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = tx.send(ProcessEvent::stderr(idx, line));
            }
        })
    });

    // Spawn completion waiter -- waits for BOTH I/O drain AND process exit
    // This ensures all stdout/stderr events arrive before the close event.
    let command_str = config.command.clone();
    let name = config.name.clone();
    tokio::spawn(async move {
        let status = child.wait().await;
        let duration = start_time.elapsed();
        let duration_ms = duration.as_secs_f64() * 1000.0;

        // Wait for stdout/stderr readers to finish draining
        // This is critical: pipes may still have buffered data after the process exits
        if let Some(h) = stdout_handle {
            let _ = h.await;
        }
        if let Some(h) = stderr_handle {
            let _ = h.await;
        }

        let exit_code = match status {
            Ok(s) => {
                #[cfg(unix)]
                {
                    use std::os::unix::process::ExitStatusExt;
                    s.code().unwrap_or_else(|| {
                        s.signal().map(|sig| -(sig as i32)).unwrap_or(-1)
                    })
                }
                #[cfg(windows)]
                {
                    s.code().unwrap_or(-1)
                }
            }
            Err(_) => -1,
        };

        let close_event = ConcurrentCloseEvent {
            index,
            command: command_str,
            name,
            exit_code,
            killed: false, // Updated by runner if it initiated the kill
            duration_ms,
        };

        let _ = completion_tx.send(CompletionMessage { index, close_event });
    });

    // Windows: create Job Object and assign the child process for tree killing
    #[cfg(windows)]
    let job = {
        let job = process_group::JobObject::new().ok();
        if let (Some(ref j), Some(p)) = (&job, pid) {
            let _ = j.assign_process_by_pid(p);
        }
        job
    };

    Ok(ProcessInfo {
        index,
        pid,
        #[cfg(windows)]
        job,
    })
}

/// Message sent when a process completes (after all I/O is drained).
pub struct CompletionMessage {
    pub index: u32,
    pub close_event: ConcurrentCloseEvent,
}

/// Info about a spawned process (for tracking/killing).
pub struct ProcessInfo {
    pub index: u32,
    pub pid: Option<u32>,
    /// Windows: Job Object that owns the process tree.
    /// When terminated or dropped, kills all child processes.
    #[cfg(windows)]
    pub job: Option<process_group::JobObject>,
}

/// Build a tokio Command configured for execution.
///
/// When `shell` is true (default), wraps the command in a shell invocation.
/// When `shell` is false, splits the command string and executes directly.
/// If `shell_path` is provided, it overrides the platform default shell.
/// Commands are sourced from package.json scripts (trusted input).
fn build_command(config: &ConcurrentCommandConfig, shell_path: Option<&str>) -> Command {
    let use_shell = config.shell.unwrap_or(true);

    let (program, args) = if use_shell {
        shell_command(&config.command, shell_path)
    } else {
        direct_command(&config.command)
    };

    let mut cmd = Command::new(&program);
    cmd.args(&args);

    if let Some(ref cwd) = config.cwd {
        cmd.current_dir(cwd);
    }

    // Merge environment variables
    cmd.envs(std::env::vars());
    if let Some(ref env) = config.env {
        cmd.envs(env.iter().map(|(k, v)| (k.as_str(), v.as_str())));
    }

    // Pass through color support
    if std::env::var("FORCE_COLOR").is_err() {
        cmd.env("FORCE_COLOR", "1");
    }

    // Pipe stdout/stderr for capture
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    // Stdin mode: "null" (default), "pipe", or "inherit"
    let stdin_mode = config.stdin.as_deref().unwrap_or("null");
    cmd.stdin(match stdin_mode {
        "pipe" => std::process::Stdio::piped(),
        "inherit" => std::process::Stdio::inherit(),
        _ => std::process::Stdio::null(),
    });

    // Unix: create new process group via setsid
    #[cfg(unix)]
    unsafe {
        cmd.pre_exec(|| process_group::pre_exec_setsid());
    }

    // Windows: create the child as the leader of a new process group so
    // we can later target it with `GenerateConsoleCtrlEvent(CTRL_BREAK_EVENT, pid)`
    // for graceful shutdown without also signalling our own console.
    //
    // Note: tokio's `creation_flags` always ORs `CREATE_UNICODE_ENVIRONMENT`
    // into the final flag set, so we don't lose unicode env support by
    // setting only `CREATE_NEW_PROCESS_GROUP` here.
    #[cfg(windows)]
    {
        use windows_sys::Win32::System::Threading::CREATE_NEW_PROCESS_GROUP;
        cmd.creation_flags(CREATE_NEW_PROCESS_GROUP);
    }

    cmd
}

/// Build shell invocation arguments.
/// If `shell_path` is provided, uses it with POSIX-style `-c` args.
/// Otherwise falls back to platform defaults.
/// Commands originate from package.json scripts (trusted).
fn shell_command(command: &str, shell_path: Option<&str>) -> (String, Vec<String>) {
    if let Some(custom_shell) = shell_path {
        // Custom shell (e.g. from npm script-shell config).
        // Always use POSIX-style -c invocation since custom shells
        // are typically bash/sh-compatible (Git Bash, zsh, fish, etc.)
        return (
            custom_shell.to_string(),
            vec!["-c".to_string(), command.to_string()],
        );
    }

    #[cfg(unix)]
    {
        (
            "/bin/sh".to_string(),
            vec!["-c".to_string(), command.to_string()],
        )
    }

    #[cfg(windows)]
    {
        (
            "cmd.exe".to_string(),
            vec![
                "/s".to_string(),
                "/c".to_string(),
                format!("\"{}\"", command),
            ],
        )
    }
}

/// Split a command string into program + arguments for direct execution (no shell).
fn direct_command(command: &str) -> (String, Vec<String>) {
    let mut parts = command.split_whitespace();
    let program = parts.next().unwrap_or("").to_string();
    let args: Vec<String> = parts.map(|s| s.to_string()).collect();
    (program, args)
}
