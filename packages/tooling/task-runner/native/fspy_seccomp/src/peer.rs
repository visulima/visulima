//! Peer-process inspection: reads strings from the tracked child's
//! address space and resolves working-directory-relative paths.
//!
//! Strategy from the RFC:
//! - `process_vm_readv(2)` (via `nix::sys::uio::process_vm_readv`)
//!   for arg-pointer reads. No `PTRACE_ATTACH` indirection (the
//!   child keeps running), but the kernel still requires
//!   `CAP_SYS_PTRACE` or a matching uid/gid pair — always satisfied
//!   here because we forked the child from the supervisor process.
//! - `/proc/<pid>/cwd` symlink for the child's current working
//!   directory. Step 3 will add per-pid caching invalidated on
//!   `chdir`/`fchdir`; for v0 the readlink-per-call cost is fine.
//! - `/proc/<pid>/fd/<n>` for fd→path resolution
//!   (`fstatat(AT_FDCWD, ...)`, `getdents64(dirfd, ...)`).

use std::ffi::OsStr;
use std::fs;
use std::io::{self, IoSliceMut};
use std::os::unix::ffi::OsStrExt;
use std::path::{Path, PathBuf};

use nix::sys::uio::{process_vm_readv, RemoteIoVec};
use nix::unistd::Pid;

/// Read a NUL-terminated path from `pid`'s address space at `addr`.
/// Returns the path as a `PathBuf` preserving raw byte layout —
/// Linux pathnames are arbitrary NUL-terminated bytes, not
/// guaranteed UTF-8, so we go through `OsStr::from_bytes` rather
/// than `String::from_utf8` (which would silently drop legitimate
/// non-UTF-8 paths).
///
/// Reads in 256-byte chunks until either NUL is found or `PATH_MAX`
/// is exceeded — short paths pay one syscall, long ones at most 16.
pub fn read_path(pid: i32, addr: u64) -> io::Result<PathBuf> {
    const PATH_MAX: usize = 4096;
    const CHUNK: usize = 256;

    let target = Pid::from_raw(pid);
    let mut buf = Vec::with_capacity(CHUNK);
    let mut current_addr = addr as usize;

    while buf.len() < PATH_MAX {
        let want = CHUNK.min(PATH_MAX - buf.len());
        let start = buf.len();
        buf.resize(start + want, 0u8);

        let mut local = [IoSliceMut::new(&mut buf[start..])];
        let remote = [RemoteIoVec { base: current_addr, len: want }];

        let n = match process_vm_readv(target, &mut local, &remote) {
            Ok(n) => n,
            Err(e) => {
                buf.truncate(start);
                return Err(io::Error::from_raw_os_error(e as i32));
            }
        };
        if n == 0 {
            // Hit unmapped memory before NUL. Truncate to what we
            // confirmed read and bail.
            buf.truncate(start);
            return Err(io::Error::new(io::ErrorKind::UnexpectedEof, "process_vm_readv returned 0 bytes before NUL"));
        }

        buf.truncate(start + n);

        if let Some(nul) = buf[start..].iter().position(|&b| b == 0) {
            buf.truncate(start + nul);
            return Ok(PathBuf::from(OsStr::from_bytes(&buf).to_os_string()));
        }

        current_addr += n;
    }

    Err(io::Error::new(io::ErrorKind::InvalidData, "path exceeds PATH_MAX without terminating NUL"))
}

/// Resolve `pid`'s current working directory via the
/// `/proc/<pid>/cwd` magic symlink.
pub fn cwd_of(pid: i32) -> io::Result<PathBuf> {
    fs::read_link(format!("/proc/{pid}/cwd"))
}

/// Resolve the file backing fd `fd` in `pid` via the
/// `/proc/<pid>/fd/<n>` magic symlink. Used to expand
/// `dirfd`-relative paths from `openat` / `fstatat` / `getdents64`.
pub fn path_of_fd(pid: i32, fd: i32) -> io::Result<PathBuf> {
    fs::read_link(format!("/proc/{pid}/fd/{fd}"))
}

/// Join a `dirfd`-relative path with the right base:
/// - absolute `path` → returned as-is
/// - `dirfd == AT_FDCWD` → resolve against `cwd_of(pid)`
/// - otherwise → resolve against `path_of_fd(pid, dirfd)`
///
/// Returns the original path on resolution failure so caller code
/// can at least record *something* (the supervisor's job is to
/// observe, not to fail the traced program).
pub fn resolve_at(pid: i32, dirfd: i32, path: &Path) -> PathBuf {
    if path.is_absolute() {
        return path.to_path_buf();
    }

    let base = if dirfd == libc::AT_FDCWD { cwd_of(pid) } else { path_of_fd(pid, dirfd) };

    match base {
        Ok(base) => base.join(path),
        Err(_) => path.to_path_buf(),
    }
}
