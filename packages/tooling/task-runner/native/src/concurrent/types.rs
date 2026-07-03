use std::collections::HashMap;

use napi_derive::napi;

/// Configuration for a single command to run concurrently.
#[napi(object)]
#[derive(Debug, Clone)]
pub struct ConcurrentCommandConfig {
    /// The command string to execute (passed to shell).
    pub command: String,
    /// Human-readable name for this command (used in prefixes/logs).
    pub name: Option<String>,
    /// Working directory for the command.
    pub cwd: Option<String>,
    /// Additional environment variables merged with process env.
    pub env: Option<HashMap<String, String>>,
    /// Whether to use shell execution (default: true).
    pub shell: Option<bool>,
    /// Stdin mode: "null" (default), "pipe", or "inherit".
    pub stdin: Option<String>,
}

/// Options controlling the concurrent runner behavior.
#[napi(object)]
#[derive(Debug, Clone)]
pub struct ConcurrentRunnerOptions {
    /// Maximum number of processes to run simultaneously.
    /// 0 or absent means unlimited.
    pub max_processes: Option<u32>,
    /// Signal to send when killing processes (default: "SIGTERM").
    pub kill_signal: Option<String>,
    /// Conditions under which to kill other processes.
    /// Values: "success", "failure". Empty = never kill others.
    pub kill_others: Option<Vec<String>>,
    /// Success condition: "first", "last", "all", or "command-<name|index>".
    pub success_condition: Option<String>,
    /// Milliseconds to wait after sending kill signal before sending SIGKILL.
    pub kill_timeout: Option<u32>,
    /// Custom shell path for command execution (e.g., from npm script-shell config).
    /// When set, used instead of the platform default (/bin/sh or cmd.exe).
    /// Format: "/path/to/shell" — args are always ["-c", command].
    pub shell_path: Option<String>,
}

/// An event emitted during concurrent execution.
/// Discriminated by the `kind` field.
#[napi(object)]
#[derive(Debug, Clone)]
pub struct ProcessEvent {
    /// Event type: "started", "stdout", "stderr", "close", "error".
    pub kind: String,
    /// Index of the command that produced this event.
    pub index: u32,
    /// Text content (for stdout/stderr events).
    pub text: Option<String>,
    /// Exit code (for close events). -1 if killed by signal.
    pub exit_code: Option<i32>,
    /// Whether the process was killed (for close events).
    pub killed: Option<bool>,
    /// Error message (for error events).
    pub message: Option<String>,
    /// Command name (for close events).
    pub command_name: Option<String>,
    /// Duration in milliseconds (for close events).
    pub duration_ms: Option<f64>,
    /// OS process id (for started events). `None` when the platform
    /// could not provide a pid for the freshly spawned child.
    pub pid: Option<u32>,
}

/// Result of a close event for a single command.
#[napi(object)]
#[derive(Debug, Clone)]
pub struct ConcurrentCloseEvent {
    /// Index of the command.
    pub index: u32,
    /// The command string that was executed.
    pub command: String,
    /// The command name (if provided).
    pub name: Option<String>,
    /// Exit code. -1 if killed by signal.
    pub exit_code: i32,
    /// Whether the process was forcefully killed.
    pub killed: bool,
    /// Duration in milliseconds.
    pub duration_ms: f64,
}

/// Overall result of a concurrent run.
#[napi(object)]
#[derive(Debug, Clone)]
pub struct ConcurrentRunResult {
    /// Close events for all commands, in completion order.
    pub close_events: Vec<ConcurrentCloseEvent>,
    /// Whether the run succeeded according to the success condition.
    pub success: bool,
}

impl ProcessEvent {
    /// Emitted exactly once per command, immediately after the child
    /// process has been spawned. `pid` is the OS pid (or `None` if the
    /// platform could not return one). Consumers use this to register
    /// children for SIGINT/SIGTERM cleanup at the JS layer.
    pub fn started(index: u32, pid: Option<u32>) -> Self {
        Self {
            kind: "started".to_string(),
            index,
            text: None,
            exit_code: None,
            killed: None,
            message: None,
            command_name: None,
            duration_ms: None,
            pid,
        }
    }

    pub fn stdout(index: u32, text: String) -> Self {
        Self {
            kind: "stdout".to_string(),
            index,
            text: Some(text),
            exit_code: None,
            killed: None,
            message: None,
            command_name: None,
            duration_ms: None,
            pid: None,
        }
    }

    pub fn stderr(index: u32, text: String) -> Self {
        Self {
            kind: "stderr".to_string(),
            index,
            text: Some(text),
            exit_code: None,
            killed: None,
            message: None,
            command_name: None,
            duration_ms: None,
            pid: None,
        }
    }

    pub fn close(index: u32, exit_code: i32, killed: bool, name: Option<String>, duration_ms: f64) -> Self {
        Self {
            kind: "close".to_string(),
            index,
            text: None,
            exit_code: Some(exit_code),
            killed: Some(killed),
            message: None,
            command_name: name,
            duration_ms: Some(duration_ms),
            pid: None,
        }
    }

    pub fn error(index: u32, message: String) -> Self {
        Self {
            kind: "error".to_string(),
            index,
            text: None,
            exit_code: None,
            killed: None,
            message: Some(message),
            command_name: None,
            duration_ms: None,
            pid: None,
        }
    }
}
