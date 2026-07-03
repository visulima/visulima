use tokio::sync::watch;

/// Signal that was received.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReceivedSignal {
    None,
    Interrupt, // SIGINT / Ctrl+C
    Terminate, // SIGTERM, SIGHUP
}

/// Creates a shutdown signal receiver that triggers on SIGINT, SIGTERM, or SIGHUP.
/// Returns a watch::Receiver that changes from `None` to the received signal.
pub fn create_signal_handler() -> (watch::Sender<ReceivedSignal>, watch::Receiver<ReceivedSignal>) {
    let (tx, rx) = watch::channel(ReceivedSignal::None);

    let signal_tx = tx.clone();
    tokio::spawn(async move {
        let sig = wait_for_signal().await;
        let _ = signal_tx.send(sig);
    });

    (tx, rx)
}

#[cfg(unix)]
async fn wait_for_signal() -> ReceivedSignal {
    use std::future::pending;

    use tokio::signal::unix::{signal, Signal, SignalKind};

    // Degrade gracefully if any individual signal can't be registered
    // (sandboxed runtimes, seccomp policies, embedding scenarios where
    // tokio's signal driver isn't installed). Previously each `.expect`
    // would panic the spawned task and silently drop the watch sender,
    // leaving JS-side Ctrl+C unable to wake the runner.
    let sigint = signal(SignalKind::interrupt()).ok();
    let sigterm = signal(SignalKind::terminate()).ok();
    let sighup = signal(SignalKind::hangup()).ok();

    // If nothing could be registered, park forever — the JS side has
    // its own signal handlers and will use the host's `kill()` to
    // terminate children directly.
    if sigint.is_none() && sigterm.is_none() && sighup.is_none() {
        pending::<()>().await;
        return ReceivedSignal::None;
    }

    async fn wait(stream: Option<Signal>) -> () {
        match stream {
            Some(mut s) => {
                let _ = s.recv().await;
            }
            None => pending::<()>().await,
        }
    }

    tokio::select! {
        _ = wait(sigint) => ReceivedSignal::Interrupt,
        _ = wait(sigterm) => ReceivedSignal::Terminate,
        _ = wait(sighup) => ReceivedSignal::Terminate,
    }
}

#[cfg(windows)]
async fn wait_for_signal() -> ReceivedSignal {
    use std::future::pending;

    use tokio::signal::windows::{ctrl_break, ctrl_c};

    // Both `CTRL_C` and `CTRL_BREAK` are common shutdown signals on
    // Windows consoles. Previously only Ctrl+C was wired, so a
    // Ctrl+Break to the parent left children unsignalled and the
    // close events never reached JS.
    let mut ctrl_c_stream = ctrl_c().ok();
    let mut ctrl_break_stream = ctrl_break().ok();

    if ctrl_c_stream.is_none() && ctrl_break_stream.is_none() {
        pending::<()>().await;
        return ReceivedSignal::None;
    }

    tokio::select! {
        _ = async {
            match ctrl_c_stream.as_mut() {
                Some(s) => { let _ = s.recv().await; }
                None => pending::<()>().await,
            }
        } => ReceivedSignal::Interrupt,
        _ = async {
            match ctrl_break_stream.as_mut() {
                Some(s) => { let _ = s.recv().await; }
                None => pending::<()>().await,
            }
        } => ReceivedSignal::Terminate,
    }
}
