use std::collections::VecDeque;

use tokio::sync::mpsc;

use super::completion::SuccessCondition;
use super::process::{spawn_process, CompletionMessage, ProcessInfo};
use super::signal;
use super::types::{
    ConcurrentCloseEvent, ConcurrentCommandConfig, ConcurrentRunResult, ConcurrentRunnerOptions, ProcessEvent,
};

/// Orchestrates concurrent execution of multiple commands.
pub struct ConcurrentRunner {
    commands: Vec<ConcurrentCommandConfig>,
    max_processes: usize,
    kill_signal: String,
    kill_others: Vec<String>,
    success_condition: SuccessCondition,
    kill_timeout_ms: u64,
    shell_path: Option<String>,
}

impl ConcurrentRunner {
    pub fn new(commands: Vec<ConcurrentCommandConfig>, options: &ConcurrentRunnerOptions) -> Self {
        let max_processes = options.max_processes.unwrap_or(0) as usize;
        let max_processes = if max_processes == 0 { commands.len() } else { max_processes };

        Self {
            commands,
            max_processes,
            kill_signal: options.kill_signal.clone().unwrap_or_else(|| "SIGTERM".to_string()),
            kill_others: options.kill_others.clone().unwrap_or_default(),
            success_condition: options
                .success_condition
                .as_deref()
                .map(SuccessCondition::parse)
                .unwrap_or(SuccessCondition::All),
            kill_timeout_ms: options.kill_timeout.unwrap_or(5000) as u64,
            shell_path: options.shell_path.clone(),
        }
    }

    /// Run all commands concurrently with real-time event streaming.
    /// Events are sent to `event_tx` as they occur.
    /// Returns the final result after all processes complete.
    pub async fn run(&self, event_tx: mpsc::UnboundedSender<ProcessEvent>) -> ConcurrentRunResult {
        let (_signal_tx, mut signal_rx) = signal::create_signal_handler();
        use super::signal::ReceivedSignal;

        // Channel for process completion notifications
        let (completion_tx, mut completion_rx) = mpsc::unbounded_channel::<CompletionMessage>();

        // Queue of command indices not yet spawned
        let mut pending: VecDeque<usize> = (0..self.commands.len()).collect();
        // Currently active process PIDs (for killing)
        let mut active: Vec<ProcessInfo> = Vec::with_capacity(self.max_processes);
        // Collected close events in completion order
        let mut close_events: Vec<ConcurrentCloseEvent> = Vec::with_capacity(self.commands.len());
        // Track how many processes are still running
        let mut running_count: usize = 0;
        // Whether we should abort (signal received or kill-others triggered)
        let mut aborting = false;
        // Whether the abort was caused by SIGINT (Ctrl+C) -- used to translate exit codes to 0
        let mut sigint_abort = false;

        // Spawn initial batch
        self.spawn_batch(&mut pending, &mut active, &mut running_count, &event_tx, &completion_tx);

        // Main loop: wait for completions
        while running_count > 0 {
            tokio::select! {
                msg = completion_rx.recv() => {
                    if let Some(msg) = msg {
                        running_count -= 1;

                        // Remove from active list
                        active.retain(|p| p.index != msg.index);

                        // Mark as killed if we initiated the kill
                        let mut close_event = msg.close_event;
                        if aborting {
                            close_event.killed = true;
                            // SIGINT (Ctrl+C) translates to exit code 0 -- user cancellation
                            // is not a failure. Matches concurrently behavior.
                            if sigint_abort {
                                close_event.exit_code = 0;
                            }
                        }

                        // Send close event to JS
                        let _ = event_tx.send(ProcessEvent::close(
                            close_event.index,
                            close_event.exit_code,
                            close_event.killed,
                            close_event.name.clone(),
                            close_event.duration_ms,
                        ));

                        // Check kill-others condition. Hard-kill (graceful=false)
                        // since this is a peer-induced abort, not a user Ctrl+C.
                        if !aborting && self.should_kill_others(&close_event) {
                            self.kill_all_with(&mut active, false);
                            aborting = true;
                        }

                        close_events.push(close_event);

                        // Spawn more if not aborting
                        if !aborting {
                            self.spawn_batch(
                                &mut pending,
                                &mut active,
                                &mut running_count,
                                &event_tx,
                                &completion_tx,
                            );
                        }
                    }
                }
                _ = signal_rx.changed() => {
                    let sig = *signal_rx.borrow();
                    if sig != ReceivedSignal::None && !aborting {
                        let graceful = sig == ReceivedSignal::Interrupt;
                        self.kill_all_with(&mut active, graceful);
                        aborting = true;
                        sigint_abort = graceful;
                    }
                }
            }
        }

        let success = self.success_condition.evaluate(&close_events);

        ConcurrentRunResult { close_events, success }
    }

    /// Run all commands and collect results without streaming events.
    pub async fn run_batch(&self) -> ConcurrentRunResult {
        let (event_tx, _event_rx) = mpsc::unbounded_channel();
        self.run(event_tx).await
    }

    fn spawn_batch(
        &self,
        pending: &mut VecDeque<usize>,
        active: &mut Vec<ProcessInfo>,
        running_count: &mut usize,
        event_tx: &mpsc::UnboundedSender<ProcessEvent>,
        completion_tx: &mpsc::UnboundedSender<CompletionMessage>,
    ) {
        while *running_count < self.max_processes {
            if let Some(cmd_index) = pending.pop_front() {
                let config = &self.commands[cmd_index];
                match spawn_process(
                    cmd_index as u32,
                    config,
                    event_tx.clone(),
                    completion_tx.clone(),
                    self.shell_path.as_deref(),
                ) {
                    Ok(info) => {
                        active.push(info);
                        *running_count += 1;
                    }
                    Err(e) => {
                        // Send error event
                        let _ = event_tx.send(ProcessEvent::error(cmd_index as u32, format!("Failed to spawn: {}", e)));
                        // Send synthetic close event so this command appears in results
                        let _ = completion_tx.send(CompletionMessage {
                            index: cmd_index as u32,
                            close_event: ConcurrentCloseEvent {
                                index: cmd_index as u32,
                                command: config.command.clone(),
                                name: config.name.clone(),
                                exit_code: 1,
                                killed: false,
                                duration_ms: 0.0,
                            },
                        });
                        *running_count += 1; // Will be decremented when completion is received
                    }
                }
            } else {
                break;
            }
        }
    }

    /// Send termination signals to every active process.
    ///
    /// `graceful = true` is reserved for user-initiated Ctrl+C / SIGINT —
    /// on Windows it routes through `CTRL_BREAK_EVENT` so well-behaved CLIs
    /// can clean up before the Job Object force-kill fires. The kill-others
    /// path passes `false` for an immediate hard kill.
    fn kill_all_with(&self, active: &mut [ProcessInfo], graceful: bool) {
        for info in active.iter_mut() {
            #[cfg(windows)]
            {
                if graceful {
                    // Send CTRL_BREAK_EVENT to the child's process group
                    // (which we created via CREATE_NEW_PROCESS_GROUP at spawn).
                    // The Job Object stays alive as a backstop — escalation
                    // below will TerminateJobObject if the child doesn't exit.
                    if let Some(pid) = info.pid {
                        let _ = super::process_group::graceful_shutdown(pid);
                    }
                    continue;
                }
                if let Some(ref job) = info.job {
                    let _ = job.terminate(1);
                    continue;
                }
                // Fallback when Job Object creation failed at spawn time:
                // taskkill /F /T via kill_tree.
                if let Some(pid) = info.pid {
                    let _ = super::process_group::kill_tree(pid, &self.kill_signal);
                }
            }

            // Unix: kill process group with the configured signal (default
            // SIGTERM). Both graceful and non-graceful paths use the same
            // signal here; escalation to SIGKILL happens below.
            //
            // Coverage: `runner_tests::test_kill_others_on_failure` exercises
            // this branch with graceful=false. The graceful=true path is
            // structurally identical on Unix — `kill_tree(pid, kill_signal)`
            // is invoked regardless of the flag — so any regression in either
            // direction is caught by that test.
            #[cfg(unix)]
            {
                let _ = graceful;
                if let Some(pid) = info.pid {
                    let _ = super::process_group::kill_tree(pid, &self.kill_signal);
                }
            }
        }

        // Schedule force-kill after timeout.
        //
        // On Windows the graceful path's final backstop is implicit:
        // every child has a Job Object configured with
        // `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`, so when its `ProcessInfo`
        // is dropped (after the completion event arrives), the kernel
        // tears down any surviving descendants. The `kill_tree` call
        // here covers the window between escalation and that drop —
        // missing grandchildren are caught by the Job Object close.
        let kill_timeout = self.kill_timeout_ms;
        let pids: Vec<u32> = active.iter().filter_map(|p| p.pid).collect();
        if !pids.is_empty() {
            tokio::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_millis(kill_timeout)).await;
                for pid in pids {
                    let _ = super::process_group::kill_tree(pid, "SIGKILL");
                }
            });
        }
    }

    fn should_kill_others(&self, event: &ConcurrentCloseEvent) -> bool {
        for condition in &self.kill_others {
            match condition.as_str() {
                "failure" if event.exit_code != 0 => return true,
                "success" if event.exit_code == 0 => return true,
                _ => {}
            }
        }
        false
    }
}
