//! Peer-process inspection: reads strings from the tracked child's
//! address space and resolves working-directory-relative paths.
//!
//! Strategy from the RFC:
//! - `process_vm_readv(2)` for arg-pointer reads. No `PTRACE_ATTACH`
//!   indirection (the child keeps running), but the kernel still
//!   requires `CAP_SYS_PTRACE` or a matching uid/gid pair — always
//!   satisfied here because we forked the child from the supervisor
//!   process.
//! - `/proc/<pid>/cwd` symlink for the child's current working
//!   directory. Step 3 will add per-pid caching invalidated on
//!   `chdir`/`fchdir`; for v0 the readlink-per-call cost is fine.
//! - `/proc/<pid>/fd/<n>` for fd→path resolution
//!   (`fstatat(AT_FDCWD, ...)`, `getdents64(dirfd, ...)`).

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use libc::{c_void, iovec, process_vm_readv};

/// Read a NUL-terminated UTF-8 path from `pid`'s address space at
/// `addr`. Reads in 256-byte chunks until either NUL is found or
/// `PATH_MAX` is exceeded.
///
/// `process_vm_readv` is single-shot, no ptrace dance — but it
/// requires `CAP_SYS_PTRACE` or matching uid/gid. We always have
/// matching uid because we forked the child.
pub fn read_path(pid: i32, addr: u64) -> io::Result<PathBuf> {
    // Linux PATH_MAX is 4096. Read in chunks so a tiny path doesn't
    // pay the full 4 KiB transfer cost.
    const PATH_MAX: usize = 4096;
    const CHUNK: usize = 256;

    let mut buf = Vec::with_capacity(CHUNK);
    let mut total_read = 0usize;
    let mut current_addr = addr;

    while total_read < PATH_MAX {
        let want = CHUNK.min(PATH_MAX - total_read);
        let start = buf.len();
        buf.resize(start + want, 0u8);

        let local = iovec {
            iov_base: buf[start..].as_mut_ptr() as *mut c_void,
            iov_len: want,
        };
        let remote = iovec {
            iov_base: current_addr as *mut c_void,
            iov_len: want,
        };

        let n = unsafe { process_vm_readv(pid, &local, 1, &remote, 1, 0) };
        if n < 0 {
            buf.truncate(start);
            return Err(io::Error::last_os_error());
        }
        if n == 0 {
            // Hit unmapped memory before NUL. Truncate and bail.
            buf.truncate(start);
            return Err(io::Error::new(
                io::ErrorKind::UnexpectedEof,
                "process_vm_readv returned 0 bytes before NUL",
            ));
        }

        let actually_read = n as usize;
        buf.truncate(start + actually_read);
        total_read += actually_read;

        if let Some(nul) = buf[start..].iter().position(|&b| b == 0) {
            buf.truncate(start + nul);
            return String::from_utf8(buf)
                .map(PathBuf::from)
                .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e));
        }

        current_addr += actually_read as u64;
    }

    Err(io::Error::new(
        io::ErrorKind::InvalidData,
        "path exceeds PATH_MAX without terminating NUL",
    ))
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
/// - `dirfd == AT_FDCWD` → resolve against `cwd_of(pid)`
/// - absolute `path` → returned as-is
/// - otherwise → resolve against `path_of_fd(pid, dirfd)`
///
/// Returns the original path on resolution failure so caller code
/// can at least record *something* (the supervisor's job is to
/// observe, not to fail the traced program).
pub fn resolve_at(pid: i32, dirfd: i32, path: &Path) -> PathBuf {
    if path.is_absolute() {
        return path.to_path_buf();
    }

    let base = if dirfd == libc::AT_FDCWD {
        cwd_of(pid)
    } else {
        path_of_fd(pid, dirfd)
    };

    match base {
        Ok(base) => base.join(path),
        Err(_) => path.to_path_buf(),
    }
}
