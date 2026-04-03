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
    use tokio::signal::unix::{signal, SignalKind};

    let mut sigint = signal(SignalKind::interrupt()).expect("failed to register SIGINT handler");
    let mut sigterm = signal(SignalKind::terminate()).expect("failed to register SIGTERM handler");
    let mut sighup = signal(SignalKind::hangup()).expect("failed to register SIGHUP handler");

    tokio::select! {
        _ = sigint.recv() => ReceivedSignal::Interrupt,
        _ = sigterm.recv() => ReceivedSignal::Terminate,
        _ = sighup.recv() => ReceivedSignal::Terminate,
    }
}

#[cfg(windows)]
async fn wait_for_signal() -> ReceivedSignal {
    let _ = tokio::signal::ctrl_c().await;
    ReceivedSignal::Interrupt
}
