use std::time::{Duration, Instant};

use tokio::io::{AsyncRead, AsyncReadExt};
use tokio::process::Command;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;
use tokio::time::timeout;

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

    // Surface the pid to the consumer before any output streams,
    // so JS-side signal handlers can register the child for cleanup
    // before it has a chance to emit anything.
    let _ = event_tx.send(ProcessEvent::started(index, pid));

    // Spawn stdout reader -- returns JoinHandle so we can wait for it
    let stdout_handle: Option<JoinHandle<()>> =
        child.stdout.take().map(|stdout| tokio::spawn(stream_output(stdout, event_tx.clone(), index, false)));

    // Spawn stderr reader -- returns JoinHandle so we can wait for it
    let stderr_handle: Option<JoinHandle<()>> =
        child.stderr.take().map(|stderr| tokio::spawn(stream_output(stderr, event_tx.clone(), index, true)));

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
                    s.code().unwrap_or_else(|| s.signal().map(|sig| -(sig as i32)).unwrap_or(-1))
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

/// Idle interval after which a partial (non-newline-terminated) line is
/// flushed as its own event. Mirrors the JS fallback's 100ms flush timer
/// so spinners, progress bars, and interactive prompts surface promptly
/// instead of being withheld until the next `\n` or process exit (EOF).
const PARTIAL_FLUSH: Duration = Duration::from_millis(100);

/// Read size for a single `read()`; large enough to swallow most line
/// bursts in one syscall without holding an oversized buffer per process.
const READ_CHUNK: usize = 8192;

/// Strip a single trailing `\r` so Windows CRLF endings don't leak a
/// carriage return into the emitted text. Matches the JS fallback's
/// `/\r$/` replace (one trailing `\r`, not all of them).
fn strip_trailing_cr(line: &[u8]) -> String {
    let end = if line.last() == Some(&b'\r') { line.len() - 1 } else { line.len() };

    String::from_utf8_lossy(&line[..end]).into_owned()
}

/// Stream a child's stdout/stderr to `tx`, emitting one event per `\n`-
/// terminated line AND flushing any partial line after `PARTIAL_FLUSH` of
/// idle time (or at EOF). Unlike `BufReader::lines()` / `next_line()`,
/// which only yields on a newline or EOF, this surfaces spinner/progress/
/// prompt output that a long-running process emits without a trailing
/// newline. `is_stderr` selects the event variant; otherwise the two
/// streams are handled identically.
async fn stream_output<R>(mut reader: R, tx: mpsc::UnboundedSender<ProcessEvent>, index: u32, is_stderr: bool)
where
    R: AsyncRead + Unpin,
{
    let emit = |text: String| {
        let event = if is_stderr {
            ProcessEvent::stderr(index, text)
        } else {
            ProcessEvent::stdout(index, text)
        };

        let _ = tx.send(event);
    };

    let mut pending: Vec<u8> = Vec::new();
    let mut chunk = [0u8; READ_CHUNK];

    loop {
        // With a partial line buffered, bound the read so an idle stream
        // still flushes it; with nothing pending, block until more data.
        let read = if pending.is_empty() {
            reader.read(&mut chunk).await
        } else {
            match timeout(PARTIAL_FLUSH, reader.read(&mut chunk)).await {
                Ok(result) => result,
                Err(_) => {
                    emit(strip_trailing_cr(&pending));
                    pending.clear();
                    continue;
                }
            }
        };

        match read {
            // EOF or read error: flush any trailing partial line, then stop.
            Ok(0) | Err(_) => {
                if !pending.is_empty() {
                    emit(strip_trailing_cr(&pending));
                }

                break;
            }
            Ok(n) => {
                pending.extend_from_slice(&chunk[..n]);

                while let Some(pos) = pending.iter().position(|&b| b == b'\n') {
                    let line: Vec<u8> = pending.drain(..=pos).collect();

                    // `line` includes the trailing `\n`; drop it before stripping `\r`.
                    emit(strip_trailing_cr(&line[..line.len() - 1]));
                }
            }
        }
    }
}

/// Build a tokio Command configured for execution.
///
/// When `shell` is true (default), wraps the command in a shell invocation.
/// When `shell` is false, splits the command string and executes directly.
/// If `shell_path` is provided, it overrides the platform default shell.
/// Commands are sourced from package.json scripts (trusted input).
fn build_command(config: &ConcurrentCommandConfig, shell_path: Option<&str>) -> Command {
    let use_shell = config.shell.unwrap_or(true);

    let (program, args) =
        if use_shell { shell_command(&config.command, shell_path) } else { direct_command(&config.command) };

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
        return (custom_shell.to_string(), vec!["-c".to_string(), command.to_string()]);
    }

    #[cfg(unix)]
    {
        ("/bin/sh".to_string(), vec!["-c".to_string(), command.to_string()])
    }

    #[cfg(windows)]
    {
        // Pass the command verbatim and let Rust's Windows arg-encoder
        // wrap it in `"..."` when it contains whitespace. cmd.exe `/s`
        // then strips those outer quotes before parsing. Pre-wrapping in
        // `"..."` ourselves would force Rust to escape the inner quotes
        // as `\"`, which cmd.exe does not understand (it expects `""` for
        // a literal quote inside a quoted section), so the shell ends up
        // running a mangled command and the child exits non-zero.
        ("cmd.exe".to_string(), vec!["/s".to_string(), "/c".to_string(), command.to_string()])
    }
}

/// Split a command string into program + arguments for direct execution (no shell).
fn direct_command(command: &str) -> (String, Vec<String>) {
    let mut parts = command.split_whitespace();
    let program = parts.next().unwrap_or("").to_string();
    let args: Vec<String> = parts.map(|s| s.to_string()).collect();
    (program, args)
}

#[cfg(test)]
mod tests {
    use tokio::io::AsyncWriteExt;
    use tokio::sync::mpsc;
    use tokio::time::{timeout, Duration};

    use super::stream_output;
    use crate::concurrent::types::ProcessEvent;

    /// Receive the next event's text within `within`, or `None` on timeout/close.
    async fn next_text(rx: &mut mpsc::UnboundedReceiver<ProcessEvent>, within: Duration) -> Option<String> {
        match timeout(within, rx.recv()).await {
            Ok(Some(event)) => event.text,
            _ => None,
        }
    }

    #[tokio::test]
    async fn emits_one_event_per_newline_terminated_line() {
        let (mut writer, reader) = tokio::io::duplex(64);
        let (tx, mut rx) = mpsc::unbounded_channel();
        let handle = tokio::spawn(stream_output(reader, tx, 0, false));

        writer.write_all(b"line1\nline2\n").await.unwrap();

        assert_eq!(next_text(&mut rx, Duration::from_secs(1)).await.as_deref(), Some("line1"));
        assert_eq!(next_text(&mut rx, Duration::from_secs(1)).await.as_deref(), Some("line2"));

        drop(writer); // EOF lets the reader task finish.
        handle.await.unwrap();
    }

    /// The regression guard: a partial line with no trailing newline and an
    /// OPEN stream (a spinner / progress bar / prompt) must surface via the
    /// idle flush. `BufReader::lines()` / `next_line()` would withhold it
    /// until the next `\n` or EOF — the bug this fix addresses.
    #[tokio::test]
    async fn flushes_partial_line_while_stream_stays_open() {
        let (mut writer, reader) = tokio::io::duplex(64);
        let (tx, mut rx) = mpsc::unbounded_channel();
        let handle = tokio::spawn(stream_output(reader, tx, 0, false));

        writer.write_all(b"spinner-frame").await.unwrap();

        // No newline written and `writer` is still open: the only way this
        // arrives is the idle-timeout flush.
        assert_eq!(
            next_text(&mut rx, Duration::from_millis(500)).await.as_deref(),
            Some("spinner-frame"),
            "partial line should flush on idle timeout, not wait for newline/EOF",
        );

        drop(writer);
        handle.await.unwrap();
    }

    #[tokio::test]
    async fn flushes_trailing_partial_line_at_eof() {
        let (mut writer, reader) = tokio::io::duplex(64);
        let (tx, mut rx) = mpsc::unbounded_channel();
        let handle = tokio::spawn(stream_output(reader, tx, 0, false));

        writer.write_all(b"tail-no-newline").await.unwrap();
        drop(writer); // Immediate EOF.

        assert_eq!(next_text(&mut rx, Duration::from_secs(1)).await.as_deref(), Some("tail-no-newline"));
        handle.await.unwrap();
    }

    #[tokio::test]
    async fn strips_single_trailing_carriage_return() {
        let (mut writer, reader) = tokio::io::duplex(64);
        let (tx, mut rx) = mpsc::unbounded_channel();
        let handle = tokio::spawn(stream_output(reader, tx, 0, false));

        writer.write_all(b"crlf-line\r\n").await.unwrap();

        assert_eq!(next_text(&mut rx, Duration::from_secs(1)).await.as_deref(), Some("crlf-line"));

        drop(writer);
        handle.await.unwrap();
    }

    #[tokio::test]
    async fn tags_stderr_events_with_kind_and_index() {
        let (mut writer, reader) = tokio::io::duplex(64);
        let (tx, mut rx) = mpsc::unbounded_channel();
        let handle = tokio::spawn(stream_output(reader, tx, 7, true));

        writer.write_all(b"err-line\n").await.unwrap();

        let event = timeout(Duration::from_secs(1), rx.recv()).await.unwrap().unwrap();

        assert_eq!(event.kind, "stderr");
        assert_eq!(event.index, 7);
        assert_eq!(event.text.as_deref(), Some("err-line"));

        drop(writer);
        handle.await.unwrap();
    }
}
