//! Named-pipe IPC between the injected DLL and the parent supervisor.
//!
//! One pipe per spawn — name follows `\\.\pipe\fspy-<pid>` so
//! multi-process runs don't collide. `PIPE_TYPE_MESSAGE` so the
//! supervisor reads whole events (16-byte header + UTF-16 path) and
//! never has to reframe a byte stream.
//!
//! **Not implemented.** Skeleton only.

use crate::FileAccess;

/// In the parent: spawn the supervisor loop reading from the pipe
/// matching `pid`. Returns once the child closes its end.
pub fn run_supervisor(_pid: u32) -> std::io::Result<Vec<FileAccess>> {
    Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "pipe::run_supervisor is not yet implemented",
    ))
}

/// In the injected DLL: serialize and send one access event over the
/// pipe inherited from the parent.
pub fn send_event(_access: &FileAccess) -> std::io::Result<()> {
    Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "pipe::send_event is not yet implemented",
    ))
}
