mod concurrent;
mod file_hasher;
mod graph;
mod task_hasher;
mod worktree;

// Pure-Rust seccomp_unotify implementation works on every Linux
// target (gnu, musl, aarch64, riscv64) — no system libraries.
#[cfg(target_os = "linux")]
mod seccomp;

// macOS file-access tracker — spawns the target with the `fspy_macos`
// DYLD-interpose dylib injected and collects reported accesses. The dylib
// itself is a separate cdylib artifact (native/fspy_macos), not linked here.
#[cfg(target_os = "macos")]
mod macos;

pub use concurrent::*;
pub use file_hasher::*;
pub use graph::*;
pub use task_hasher::*;
pub use worktree::*;

#[cfg(target_os = "linux")]
pub use seccomp::*;

#[cfg(target_os = "macos")]
pub use macos::*;
