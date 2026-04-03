use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use tokio::sync::mpsc;

use super::runner::ConcurrentRunner;
use super::types::{
    ConcurrentCommandConfig, ConcurrentRunResult, ConcurrentRunnerOptions, ProcessEvent,
};

/// Run commands concurrently with real-time event streaming.
///
/// Each stdout/stderr line and process lifecycle event is sent to the
/// `on_event` callback as it occurs. The function resolves with the
/// final result after all processes have completed.
///
/// Commands originate from package.json scripts (trusted input).
#[napi]
pub async fn run_concurrent(
    commands: Vec<ConcurrentCommandConfig>,
    options: ConcurrentRunnerOptions,
    #[napi(ts_arg_type = "(event: ProcessEvent) => void")] on_event: ThreadsafeFunction<ProcessEvent>,
) -> Result<ConcurrentRunResult> {
    let runner = ConcurrentRunner::new(commands, &options);

    let (event_tx, mut event_rx) = mpsc::unbounded_channel::<ProcessEvent>();

    // Spawn a task to forward events from the channel to the JS callback
    let forward_handle = tokio::spawn(async move {
        while let Some(event) = event_rx.recv().await {
            on_event.call(Ok(event), ThreadsafeFunctionCallMode::NonBlocking);
        }
    });

    let result = runner.run(event_tx).await;

    // Wait for all events to be forwarded
    let _ = forward_handle.await;

    Ok(result)
}

/// Run commands concurrently without event streaming.
///
/// Collects all output internally and returns the final result.
/// Useful for non-interactive contexts where real-time output is not needed.
///
/// Commands originate from package.json scripts (trusted input).
#[napi]
pub async fn run_concurrent_batch(
    commands: Vec<ConcurrentCommandConfig>,
    options: ConcurrentRunnerOptions,
) -> Result<ConcurrentRunResult> {
    let runner = ConcurrentRunner::new(commands, &options);
    Ok(runner.run_batch().await)
}
