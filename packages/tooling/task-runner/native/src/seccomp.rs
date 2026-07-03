//! NAPI surface for `fspy_seccomp` — Linux-only.
//!
//! `trackWithSeccomp(argv, helperPath, options)` spawns the helper
//! binary at `helperPath`, listens on a per-spawn Unix socket for
//! the helper's notify-fd handoff, and resolves with the gathered
//! file accesses once the child exits.
//!
//! The helper binary ships in the same platform binding package as
//! this `.node` addon (see the `build:native` script's `--bin` flag
//! and the binding package's `files` field). TypeScript is
//! responsible for resolving its path at runtime — passing it in
//! here keeps Rust out of the npm-resolution business.
//!
//! The optional `on_started` callback in `options` fires
//! synchronously from a Rust thread as soon as the helper PID is
//! known — used by the TypeScript-side `#runWithSeccomp` to
//! register the helper for `killAll()` and to wire `AbortSignal`
//! aborts through `process.kill(pid, 'SIGTERM')`.
//!
//! Async because the underlying `fspy_seccomp::track_command`
//! blocks on the helper's wait; running it on a tokio blocking
//! thread keeps the Node event loop responsive.

#![cfg(target_os = "linux")]

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::mpsc;

use fspy_seccomp::{AccessKind as RustAccessKind, FileAccess as RustFileAccess, SpawnOptions as RustSpawnOptions};
use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;

/// Mirrors the TypeScript `FileAccess` shape in
/// `src/file-access-tracker.ts`. JS sees `kind` as the string union
/// `"read" | "write" | "stat" | "readdir" | "missing"`.
#[napi(object)]
pub struct SeccompFileAccess {
    pub path: String,
    pub kind: String,
}

/// Result returned to JS after the traced command exits.
///
/// `stdout` / `stderr` are buffers so the TypeScript caller can
/// decode them with the encoding of its choice (default `utf8`)
/// without us assuming UTF-8 validity in the child's output.
#[napi(object)]
pub struct SeccompTrackingResult {
    pub accesses: Vec<SeccompFileAccess>,
    pub exit_code: i32,
    pub stdout: Buffer,
    pub stderr: Buffer,
}

/// Optional spawn settings — undefined fields fall through to
/// parent-process inheritance.
#[napi(object)]
pub struct SeccompSpawnOptions {
    pub cwd: Option<String>,
    /// Extra env vars merged on top of the parent's. Use for
    /// per-command overrides (enhanced PATH, NODE_OPTIONS, etc.).
    pub env: Option<HashMap<String, String>>,
}

/// `on_started` is a top-level parameter (not inside the options
/// object) because `ThreadsafeFunction` doesn't implement
/// `ToNapiValue` and can't live in `#[napi(object)]` fields. From
/// JS:
///
/// ```ts
/// trackWithSeccomp(argv, helper, options, (pid) => {
///   registerForKillAll(pid);
/// });
/// ```
///
/// Fired once with the helper PID as soon as the spawn succeeds.
/// The PID is the same one that becomes the target process
/// post-execve, so callers can SIGTERM it for kill-on-abort
/// cleanup. Fires before the supervisor loop starts streaming
/// events.
#[napi(
    catch_unwind,
    ts_args_type = "argv: Array<string>, helperPath: string, options?: SeccompSpawnOptions | undefined | null, onStarted?: ((pid: number) => void) | undefined | null"
)]
pub async fn track_with_seccomp(
    argv: Vec<String>,
    helper_path: String,
    options: Option<SeccompSpawnOptions>,
    on_started: Option<ThreadsafeFunction<u32, (), u32, Status, false>>,
) -> Result<SeccompTrackingResult> {
    let helper = PathBuf::from(helper_path);

    let mut spawn_opts = RustSpawnOptions::default();
    if let Some(opts) = options {
        spawn_opts.cwd = opts.cwd.map(PathBuf::from);
        if let Some(env) = opts.env {
            spawn_opts.env = env.into_iter().collect();
        }
    }

    // Bridge the synchronous Rust callback (running on the
    // spawn_blocking thread) to the async JS callback via the
    // threadsafe function. We send the PID once when the helper
    // starts; the JS side registers it in `#activeProcesses`.
    let (pid_tx, pid_rx) = mpsc::sync_channel::<u32>(1);
    let pid_tx_clone = pid_tx.clone();

    let work = tokio::task::spawn_blocking(move || {
        let mut callback = move |pid: u32| {
            let _ = pid_tx_clone.send(pid);
        };
        fspy_seccomp::track_command(&argv, &helper, &spawn_opts, Some(&mut callback))
    });

    // Side task to forward the PID to JS as soon as it arrives —
    // runs in parallel with the spawn_blocking work so the JS side
    // gets notified before the supervisor starts streaming events.
    if let Some(tsfn) = on_started {
        tokio::task::spawn_blocking(move || {
            if let Ok(pid) = pid_rx.recv() {
                tsfn.call(pid, ThreadsafeFunctionCallMode::NonBlocking);
            }
        });
    }
    drop(pid_tx);

    let result = work
        .await
        .map_err(|e| Error::new(Status::GenericFailure, format!("seccomp tracker panicked: {e}")))?
        .map_err(|e| Error::new(Status::GenericFailure, format!("seccomp tracker failed: {e}")))?;

    Ok(SeccompTrackingResult {
        accesses: result.accesses.into_iter().map(convert_access).collect(),
        exit_code: result.exit_code,
        stdout: Buffer::from(result.stdout),
        stderr: Buffer::from(result.stderr),
    })
}

fn convert_access(a: RustFileAccess) -> SeccompFileAccess {
    SeccompFileAccess {
        path: a.path.to_string_lossy().into_owned(),
        kind: match a.kind {
            RustAccessKind::Read => "read".to_string(),
            RustAccessKind::Write => "write".to_string(),
            RustAccessKind::Stat => "stat".to_string(),
            RustAccessKind::ReadDir => "readdir".to_string(),
            RustAccessKind::Missing => "missing".to_string(),
        },
    }
}
