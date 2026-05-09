#[cfg(test)]
mod tests {
    use tokio::sync::mpsc;

    use crate::concurrent::runner::ConcurrentRunner;
    use crate::concurrent::types::{
        ConcurrentCommandConfig, ConcurrentRunnerOptions, ProcessEvent,
    };

    fn make_config(command: &str, name: Option<&str>) -> ConcurrentCommandConfig {
        ConcurrentCommandConfig {
            command: command.to_string(),
            name: name.map(|s| s.to_string()),
            cwd: None,
            env: None,
            shell: None,
            stdin: None,
        }
    }

    fn default_options() -> ConcurrentRunnerOptions {
        ConcurrentRunnerOptions {
            max_processes: None,
            kill_signal: None,
            kill_others: None,
            success_condition: None,
            kill_timeout: None,
            shell_path: None,
        }
    }

    #[tokio::test]
    async fn test_single_echo_command() {
        let commands = vec![make_config("echo hello", Some("greeter"))];
        let runner = ConcurrentRunner::new(commands, &default_options());

        let (event_tx, mut event_rx) = mpsc::unbounded_channel::<ProcessEvent>();

        let result = runner.run(event_tx).await;

        assert!(result.success);
        assert_eq!(result.close_events.len(), 1);
        assert_eq!(result.close_events[0].exit_code, 0);
        assert_eq!(result.close_events[0].name.as_deref(), Some("greeter"));

        // Collect events -- should have at least one stdout and one close
        let mut stdout_count = 0;
        let mut close_count = 0;
        while let Ok(event) = event_rx.try_recv() {
            match event.kind.as_str() {
                "stdout" => {
                    stdout_count += 1;
                    assert_eq!(event.text.as_deref(), Some("hello"));
                }
                "close" => close_count += 1,
                _ => {}
            }
        }
        assert!(stdout_count >= 1, "expected at least one stdout event");
        assert_eq!(close_count, 1, "expected exactly one close event");
    }

    #[tokio::test]
    async fn test_started_event_carries_pid() {
        // Single command -- we expect exactly one "started" event with a
        // populated pid before any close event arrives.
        let commands = vec![make_config("echo hello", Some("greeter"))];
        let runner = ConcurrentRunner::new(commands, &default_options());

        let (event_tx, mut event_rx) = mpsc::unbounded_channel::<ProcessEvent>();
        let _ = runner.run(event_tx).await;

        let mut started: Vec<ProcessEvent> = Vec::new();
        let mut close_seen_before_started = false;
        let mut close_seen = false;
        while let Ok(event) = event_rx.try_recv() {
            match event.kind.as_str() {
                "started" => {
                    if close_seen {
                        close_seen_before_started = true;
                    }
                    started.push(event);
                }
                "close" => close_seen = true,
                _ => {}
            }
        }

        assert_eq!(started.len(), 1, "expected exactly one started event");
        assert_eq!(started[0].index, 0);
        assert!(started[0].pid.is_some(), "started event should carry a pid");
        assert!(
            started[0].pid.unwrap() > 0,
            "pid should be a positive integer"
        );
        assert!(
            !close_seen_before_started,
            "started event must arrive before close event"
        );
    }

    #[tokio::test]
    async fn test_multiple_commands() {
        let commands = vec![
            make_config("echo one", Some("first")),
            make_config("echo two", Some("second")),
            make_config("echo three", Some("third")),
        ];
        let runner = ConcurrentRunner::new(commands, &default_options());
        let result = runner.run_batch().await;

        assert!(result.success);
        assert_eq!(result.close_events.len(), 3);
        for event in &result.close_events {
            assert_eq!(event.exit_code, 0);
        }
    }

    #[tokio::test]
    async fn test_failing_command() {
        let commands = vec![make_config("exit 42", None)];
        let runner = ConcurrentRunner::new(commands, &default_options());
        let result = runner.run_batch().await;

        assert!(!result.success);
        assert_eq!(result.close_events.len(), 1);
        assert_eq!(result.close_events[0].exit_code, 42);
    }

    #[tokio::test]
    async fn test_mixed_success_and_failure() {
        let commands = vec![
            make_config("echo ok", Some("good")),
            make_config("exit 1", Some("bad")),
        ];
        let runner = ConcurrentRunner::new(commands, &default_options());
        let result = runner.run_batch().await;

        assert!(!result.success); // default is "all" -- one failed
        assert_eq!(result.close_events.len(), 2);
    }

    #[tokio::test]
    async fn test_success_condition_first() {
        let commands = vec![
            make_config("echo ok", Some("fast")),
            make_config("sleep 0.1 && exit 1", Some("slow")),
        ];
        let mut opts = default_options();
        opts.success_condition = Some("first".to_string());
        let runner = ConcurrentRunner::new(commands, &opts);
        let result = runner.run_batch().await;

        // First to complete should be "echo ok" (instant)
        assert!(result.success);
    }

    #[tokio::test]
    async fn test_max_processes_queuing() {
        // With maxProcesses=1, commands run sequentially
        let commands = vec![
            make_config("echo one", None),
            make_config("echo two", None),
            make_config("echo three", None),
        ];
        let mut opts = default_options();
        opts.max_processes = Some(1);
        let runner = ConcurrentRunner::new(commands, &opts);
        let result = runner.run_batch().await;

        assert!(result.success);
        assert_eq!(result.close_events.len(), 3);
        // With max_processes=1, they should complete in order
        assert_eq!(result.close_events[0].index, 0);
        assert_eq!(result.close_events[1].index, 1);
        assert_eq!(result.close_events[2].index, 2);
    }

    #[tokio::test]
    async fn test_kill_others_on_failure() {
        let commands = vec![
            make_config("exit 1", Some("fails-fast")),
            make_config("sleep 10", Some("long-running")),
        ];
        let mut opts = default_options();
        opts.kill_others = Some(vec!["failure".to_string()]);
        opts.kill_timeout = Some(1000);
        let runner = ConcurrentRunner::new(commands, &opts);

        let start = std::time::Instant::now();
        let result = runner.run_batch().await;
        let elapsed = start.elapsed();

        assert!(!result.success);
        assert_eq!(result.close_events.len(), 2);
        // Should complete much faster than 10 seconds
        assert!(
            elapsed.as_secs() < 5,
            "kill-others should have killed the long-running process, took {:?}",
            elapsed
        );
    }

    #[tokio::test]
    async fn test_stderr_output() {
        let commands = vec![make_config("echo error >&2", None)];
        let runner = ConcurrentRunner::new(commands, &default_options());

        let (event_tx, mut event_rx) = mpsc::unbounded_channel::<ProcessEvent>();
        let result = runner.run(event_tx).await;

        assert!(result.success);

        let mut has_stderr = false;
        while let Ok(event) = event_rx.try_recv() {
            if event.kind == "stderr" {
                has_stderr = true;
                assert_eq!(event.text.as_deref(), Some("error"));
            }
        }
        assert!(has_stderr, "expected stderr event");
    }

    #[tokio::test]
    async fn test_environment_variables() {
        let mut env = std::collections::HashMap::new();
        env.insert("TEST_VAR".to_string(), "hello_from_rust".to_string());

        let commands = vec![ConcurrentCommandConfig {
            command: "echo $TEST_VAR".to_string(),
            name: None,
            cwd: None,
            env: Some(env),
            shell: None,
            stdin: None,
        }];
        let runner = ConcurrentRunner::new(commands, &default_options());

        let (event_tx, mut event_rx) = mpsc::unbounded_channel::<ProcessEvent>();
        let result = runner.run(event_tx).await;

        assert!(result.success);

        let mut found = false;
        while let Ok(event) = event_rx.try_recv() {
            if event.kind == "stdout" && event.text.as_deref() == Some("hello_from_rust") {
                found = true;
            }
        }
        assert!(found, "expected env var to be passed to child process");
    }

    #[tokio::test]
    async fn test_spawn_nonexistent_command() {
        let commands = vec![make_config("nonexistent_command_that_does_not_exist_xyz", None)];
        let runner = ConcurrentRunner::new(commands, &default_options());

        let (event_tx, _event_rx) = mpsc::unbounded_channel::<ProcessEvent>();
        let result = runner.run(event_tx).await;

        // The shell will report the error, exit code should be non-zero
        assert!(!result.success);
        assert_eq!(result.close_events.len(), 1);
        assert_ne!(result.close_events[0].exit_code, 0);
    }

    #[tokio::test]
    async fn test_empty_commands() {
        let commands = vec![];
        let runner = ConcurrentRunner::new(commands, &default_options());
        let result = runner.run_batch().await;

        assert!(result.success);
        assert!(result.close_events.is_empty());
    }

    #[tokio::test]
    async fn test_multiline_output_ordering() {
        // Verify that all stdout lines arrive before the close event
        let commands = vec![make_config("echo line1 && echo line2 && echo line3", None)];
        let runner = ConcurrentRunner::new(commands, &default_options());

        let (event_tx, mut event_rx) = mpsc::unbounded_channel::<ProcessEvent>();
        let result = runner.run(event_tx).await;

        assert!(result.success);

        let mut events: Vec<ProcessEvent> = Vec::new();
        while let Ok(event) = event_rx.try_recv() {
            events.push(event);
        }

        // Find the close event index
        let close_idx = events.iter().position(|e| e.kind == "close");
        let stdout_events: Vec<_> = events.iter().filter(|e| e.kind == "stdout").collect();

        assert!(close_idx.is_some(), "expected a close event");
        assert_eq!(stdout_events.len(), 3, "expected 3 stdout lines");

        // All stdout events must come before the close event
        for (i, event) in events.iter().enumerate() {
            if event.kind == "stdout" {
                assert!(
                    i < close_idx.unwrap(),
                    "stdout event at index {} came after close event at index {}",
                    i,
                    close_idx.unwrap()
                );
            }
        }
    }

    #[tokio::test]
    async fn test_close_event_has_duration() {
        let commands = vec![make_config("sleep 0.1", None)];
        let runner = ConcurrentRunner::new(commands, &default_options());
        let result = runner.run_batch().await;

        assert!(result.success);
        assert!(
            result.close_events[0].duration_ms >= 50.0,
            "expected duration >= 50ms, got {}",
            result.close_events[0].duration_ms
        );
    }

    #[tokio::test]
    async fn test_success_condition_command_by_name() {
        let commands = vec![
            make_config("exit 1", Some("irrelevant")),
            make_config("echo ok", Some("important")),
        ];
        let mut opts = default_options();
        opts.success_condition = Some("command-important".to_string());
        let runner = ConcurrentRunner::new(commands, &opts);
        let result = runner.run_batch().await;

        // Only "important" needs to succeed
        assert!(result.success);
    }

    #[tokio::test]
    async fn test_working_directory() {
        let commands = vec![ConcurrentCommandConfig {
            command: "pwd".to_string(),
            name: None,
            cwd: Some("/tmp".to_string()),
            env: None,
            shell: None,
            stdin: None,
        }];
        let runner = ConcurrentRunner::new(commands, &default_options());

        let (event_tx, mut event_rx) = mpsc::unbounded_channel::<ProcessEvent>();
        let result = runner.run(event_tx).await;

        assert!(result.success);

        let mut found_tmp = false;
        while let Ok(event) = event_rx.try_recv() {
            if event.kind == "stdout" {
                if let Some(text) = &event.text {
                    if text.contains("tmp") {
                        found_tmp = true;
                    }
                }
            }
        }
        assert!(found_tmp, "expected /tmp in pwd output");
    }

    #[tokio::test]
    async fn test_direct_execution_without_shell() {
        let commands = vec![ConcurrentCommandConfig {
            command: "echo direct-mode".to_string(),
            name: None,
            cwd: None,
            env: None,
            shell: Some(false),
            stdin: None,
        }];
        let runner = ConcurrentRunner::new(commands, &default_options());

        let (event_tx, mut event_rx) = mpsc::unbounded_channel::<ProcessEvent>();
        let result = runner.run(event_tx).await;

        assert!(result.success);

        let mut found = false;
        while let Ok(event) = event_rx.try_recv() {
            if event.kind == "stdout" && event.text.as_deref() == Some("direct-mode") {
                found = true;
            }
        }
        assert!(found, "expected 'direct-mode' in output");
    }

    #[tokio::test]
    async fn test_shell_true_supports_pipes() {
        // Pipes require shell execution
        let commands = vec![ConcurrentCommandConfig {
            command: "echo piped | cat".to_string(),
            name: None,
            cwd: None,
            env: None,
            shell: Some(true),
            stdin: None,
        }];
        let runner = ConcurrentRunner::new(commands, &default_options());

        let (event_tx, mut event_rx) = mpsc::unbounded_channel::<ProcessEvent>();
        let result = runner.run(event_tx).await;

        assert!(result.success);

        let mut found = false;
        while let Ok(event) = event_rx.try_recv() {
            if event.kind == "stdout" && event.text.as_deref() == Some("piped") {
                found = true;
            }
        }
        assert!(found, "expected 'piped' in output from shell pipe");
    }

    #[tokio::test]
    async fn test_stdin_null_is_default() {
        // Command that tries to read stdin should get EOF immediately
        let commands = vec![ConcurrentCommandConfig {
            command: "cat".to_string(),
            name: None,
            cwd: None,
            env: None,
            shell: Some(true),
            stdin: None, // defaults to "null"
        }];
        let runner = ConcurrentRunner::new(commands, &default_options());
        let result = runner.run_batch().await;

        // cat with no stdin should exit 0 (reads EOF)
        assert!(result.success);
        assert_eq!(result.close_events[0].exit_code, 0);
    }

    #[tokio::test]
    async fn test_stdin_pipe_mode() {
        // echo doesn't read stdin, so pipe mode doesn't block
        let commands = vec![ConcurrentCommandConfig {
            command: "echo pipe-test".to_string(),
            name: None,
            cwd: None,
            env: None,
            shell: Some(true),
            stdin: Some("pipe".to_string()),
        }];
        let runner = ConcurrentRunner::new(commands, &default_options());

        let (event_tx, mut event_rx) = mpsc::unbounded_channel::<ProcessEvent>();
        let result = runner.run(event_tx).await;

        assert!(result.success);

        let mut found = false;
        while let Ok(event) = event_rx.try_recv() {
            if event.kind == "stdout" && event.text.as_deref() == Some("pipe-test") {
                found = true;
            }
        }
        assert!(found, "expected 'pipe-test' in output");
    }

    #[tokio::test]
    async fn test_custom_shell_path() {
        // Use /bin/bash explicitly as shell_path
        let commands = vec![make_config("echo custom-shell", None)];
        let mut opts = default_options();
        opts.shell_path = Some("/bin/bash".to_string());
        let runner = ConcurrentRunner::new(commands, &opts);

        let (event_tx, mut event_rx) = mpsc::unbounded_channel::<ProcessEvent>();
        let result = runner.run(event_tx).await;

        assert!(result.success);

        let mut found = false;
        while let Ok(event) = event_rx.try_recv() {
            if event.kind == "stdout" && event.text.as_deref() == Some("custom-shell") {
                found = true;
            }
        }
        assert!(found, "expected 'custom-shell' in output via /bin/bash");
    }
}
