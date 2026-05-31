mod concurrent;
mod file_hasher;
mod graph;
mod task_hasher;
mod worktree;

// Match the `fspy-seccomp` dep gate in `Cargo.toml`: glibc Linux
// only. musl/aarch64 cross-targets skip the dispatch — TS
// gracefully falls back to strace / no-tracking when
// `trackWithSeccomp` is absent.
#[cfg(all(target_os = "linux", target_env = "gnu"))]
mod seccomp;

pub use concurrent::*;
pub use file_hasher::*;
pub use graph::*;
pub use task_hasher::*;
pub use worktree::*;

#[cfg(all(target_os = "linux", target_env = "gnu"))]
pub use seccomp::*;
