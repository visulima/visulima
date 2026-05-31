//! In-process supervisor that consumes events off the kernel's
//! seccomp notify fd and folds them into a `Vec<FileAccess>`.
//!
//! Runs as a thread inside whichever process called
//! `track_command` — Node holds the resulting handle via NAPI. There
//! is no separate supervisor binary; an out-of-process design adds
//! IPC and packaging cost we don't yet need.
//!
//! **Not implemented.** Plan from `rfc/design-fspy-seccomp-unotify.md`:
//! - `epoll` on the notify fd (one per tracked process tree).
//! - `ioctl(SECCOMP_IOCTL_NOTIF_RECV)` to read each notification.
//! - Decode syscall args via `peer::read_path` / `peer::path_of_fd`.
//! - Classify via the `flag_decoded` bit on `TrackedSyscall`.
//! - Ack with `SECCOMP_IOCTL_NOTIF_SEND { flags: CONTINUE }` so the
//!   child runs the real syscall.

use std::sync::mpsc::Sender;

use crate::FileAccess;

/// Drive the notify-fd consumer loop until `notify_fd` is closed (the
/// last tracked process exited). Each observed access is sent to
/// `sink`; the caller drains the channel after `track_command`
/// returns.
pub fn run(_notify_fd: i32, _sink: Sender<FileAccess>) -> std::io::Result<()> {
    Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "supervisor::run is not yet implemented",
    ))
}
