//! Peer-process inspection: reads strings from the tracked child's
//! address space and resolves working-directory-relative paths.
//!
//! Strategy from the RFC:
//! - `process_vm_readv()` for arg-pointer reads (no `PTRACE_ATTACH`
//!   indirection; needs `CAP_SYS_PTRACE` or matching uid/gid — always
//!   true here because we forked the child).
//! - `/proc/<pid>/cwd` symlink for the child's current working
//!   directory; cached per-pid and invalidated on `chdir`/`fchdir`.
//! - `/proc/<pid>/fd/<n>` for fd→path resolution
//!   (`fstatat(AT_FDCWD, ...)`, `getdents64(dirfd, ...)`).

use std::path::PathBuf;

/// Read a null-terminated UTF-8 path from `pid`'s address space at `addr`.
///
/// **Not implemented.** Will use `process_vm_readv(2)` per the RFC.
pub fn read_path(_pid: i32, _addr: u64) -> std::io::Result<PathBuf> {
    Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "peer::read_path is not yet implemented",
    ))
}

/// Resolve `pid`'s current working directory via `/proc/<pid>/cwd`.
/// Cached per-pid in the supervisor; this raw call is the cache miss
/// path.
pub fn cwd_of(_pid: i32) -> std::io::Result<PathBuf> {
    Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "peer::cwd_of is not yet implemented",
    ))
}

/// Resolve the file backing fd `fd` in `pid` via `/proc/<pid>/fd/<fd>`.
pub fn path_of_fd(_pid: i32, _fd: i32) -> std::io::Result<PathBuf> {
    Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "peer::path_of_fd is not yet implemented",
    ))
}
