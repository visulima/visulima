//! Syscall metadata + per-call decoders. Each handler maps one
//! seccomp notification to zero or more `FileAccess` entries.
//!
//! libseccomp resolves syscall names per-arch at filter-install
//! time, so we carry canonical Linux names (strings) rather than
//! baking raw numbers that differ across x86_64 / aarch64 /
//! riscv64. Step 3 of `rfc/design-fspy-seccomp-unotify.md` —
//! complete syscall table covering reads, writes, stats, readdir.

use std::path::PathBuf;

use libseccomp_sys::{seccomp_arch_native, seccomp_notif, seccomp_syscall_resolve_num_arch};

use crate::peer;
use crate::{AccessKind, FileAccess};

/// One row of the seccomp filter table. The supervisor walks this
/// list to register `SCMP_ACT_NOTIFY` rules; `classify` does the
/// matching post-notification work.
#[derive(Debug, Clone, Copy)]
pub struct TrackedSyscall {
    /// Canonical Linux syscall name. Resolved per-arch via
    /// `seccomp_syscall_resolve_name_arch` at filter-install time.
    /// Skipped silently when libseccomp doesn't know the name on
    /// the current arch (e.g. `openat2` on older toolchains).
    pub name: &'static str,
}

/// The full set we intercept. Order doesn't matter for filter
/// install; the dispatch in `classify` matches by name.
pub fn tracked() -> &'static [TrackedSyscall] {
    &[
        // Open / read funnel
        TrackedSyscall { name: "openat" },
        TrackedSyscall { name: "openat2" },
        TrackedSyscall { name: "open" },
        // Stat family
        TrackedSyscall { name: "stat" },
        TrackedSyscall { name: "lstat" },
        TrackedSyscall { name: "fstatat" },
        TrackedSyscall { name: "newfstatat" },
        TrackedSyscall { name: "statx" },
        TrackedSyscall { name: "access" },
        TrackedSyscall { name: "faccessat" },
        TrackedSyscall { name: "faccessat2" },
        // Directory enumeration
        TrackedSyscall { name: "getdents64" },
        // Symlinks
        TrackedSyscall { name: "readlink" },
        TrackedSyscall { name: "readlinkat" },
        // Writes — create / delete / rename / link
        TrackedSyscall { name: "unlink" },
        TrackedSyscall { name: "unlinkat" },
        TrackedSyscall { name: "rename" },
        TrackedSyscall { name: "renameat" },
        TrackedSyscall { name: "renameat2" },
        TrackedSyscall { name: "mkdir" },
        TrackedSyscall { name: "mkdirat" },
        TrackedSyscall { name: "rmdir" },
        TrackedSyscall { name: "symlink" },
        TrackedSyscall { name: "symlinkat" },
        TrackedSyscall { name: "link" },
        TrackedSyscall { name: "linkat" },
        // cwd shifts (no recorded access, but the supervisor needs
        // to see them so future arg resolution stays accurate)
        TrackedSyscall { name: "chdir" },
        TrackedSyscall { name: "fchdir" },
    ]
}

/// Decode `openat`-style flags into the resulting access kind.
/// Bits per `<fcntl.h>` — any write-side bit promotes to `Write`.
pub fn openat_kind_from_flags(flags: u64) -> AccessKind {
    const O_WRONLY: u64 = 1;
    const O_RDWR: u64 = 2;
    const O_CREAT: u64 = 0o100;
    const O_TRUNC: u64 = 0o1000;

    let write_bits = O_WRONLY | O_RDWR | O_CREAT | O_TRUNC;

    if flags & write_bits != 0 {
        AccessKind::Write
    } else {
        AccessKind::Read
    }
}

/// Map one seccomp notification to zero or more accesses. The
/// per-syscall arms handle their own arg layout; everything routes
/// through `peer::read_path` and `peer::resolve_at` for the actual
/// child-memory inspection.
pub fn classify(notif: &seccomp_notif, pid: i32) -> Vec<FileAccess> {
    let arch = unsafe { seccomp_arch_native() };
    let name_ptr = unsafe { seccomp_syscall_resolve_num_arch(arch, notif.data.nr) };
    if name_ptr.is_null() {
        return Vec::new();
    }
    let name = unsafe { std::ffi::CStr::from_ptr(name_ptr) }.to_string_lossy();

    let args = &notif.data.args;

    // Non-`*at` syscalls (`open`, `stat`, `unlink`, ...) take a
    // raw `*pathname` arg. We route them through `decode_direct`
    // which now resolves via `resolve_at(pid, AT_FDCWD, &raw)` —
    // same path the `*at` variants get. Without this, `open("foo")`
    // would record `foo` while `openat(AT_FDCWD, "foo")` records
    // `/cwd/foo`, leaving downstream consumers with a mix of
    // relative and absolute paths for equivalent operations.
    match name.as_ref() {
        // (dirfd, *pathname, flags, mode)
        "openat" | "openat2" => decode_at_with_flags(pid, args[0] as i32, args[1], args[2]),
        // (*pathname, flags, mode)
        "open" => match peer::read_path(pid, args[0]) {
            Ok(path) => vec![FileAccess {
                path: peer::resolve_at(pid, libc::AT_FDCWD, &path),
                kind: openat_kind_from_flags(args[1]),
            }],
            Err(_) => Vec::new(),
        },
        // (*pathname, *statbuf)
        "stat" | "lstat" => decode_direct(pid, args[0], AccessKind::Stat),
        // (*pathname, mode)
        "access" => decode_direct(pid, args[0], AccessKind::Stat),
        // (dirfd, *pathname, *statbuf, flags)
        "fstatat" | "newfstatat" => decode_at(pid, args[0] as i32, args[1], AccessKind::Stat),
        // (dirfd, *pathname, mode[, flags])
        "faccessat" | "faccessat2" => decode_at(pid, args[0] as i32, args[1], AccessKind::Stat),
        // (dirfd, *pathname, flags, mask, *buf)
        "statx" => decode_at(pid, args[0] as i32, args[1], AccessKind::Stat),
        // (fd, *dirp, count) — resolve from fd
        "getdents64" => decode_from_fd(pid, args[0] as i32, AccessKind::ReadDir),
        // (*pathname, *buf, bufsiz)
        "readlink" => decode_direct(pid, args[0], AccessKind::Read),
        // (dirfd, *pathname, *buf, bufsiz)
        "readlinkat" => decode_at(pid, args[0] as i32, args[1], AccessKind::Read),
        // (*pathname)
        "unlink" | "rmdir" => decode_direct(pid, args[0], AccessKind::Write),
        // (dirfd, *pathname, flags)
        "unlinkat" => decode_at(pid, args[0] as i32, args[1], AccessKind::Write),
        // (*pathname, mode)
        "mkdir" => decode_direct(pid, args[0], AccessKind::Write),
        // (dirfd, *pathname, mode)
        "mkdirat" => decode_at(pid, args[0] as i32, args[1], AccessKind::Write),
        // (*oldpath, *newpath) — emit both as writes
        "rename" | "link" => decode_pair_direct(pid, args[0], args[1], AccessKind::Write),
        // (olddir, *oldpath, newdir, *newpath[, flags])
        "renameat" | "renameat2" | "linkat" => {
            decode_pair_at(pid, args[0] as i32, args[1], args[2] as i32, args[3])
        }
        // (*target, *linkpath) — target is symlink contents (not a
        // real fs path); only linkpath is the actual write.
        "symlink" => decode_direct(pid, args[1], AccessKind::Write),
        // (*target, dirfd, *linkpath)
        "symlinkat" => decode_at(pid, args[1] as i32, args[2], AccessKind::Write),
        // chdir / fchdir don't record an access today — they only
        // matter as cwd-cache invalidation triggers, which step 4
        // will wire when per-pid cwd caching lands.
        "chdir" | "fchdir" => Vec::new(),
        _ => Vec::new(),
    }
}

/// Non-`*at` syscall handler. Resolves the read path against the
/// child's cwd so callers see absolute paths consistently — see the
/// note at the top of `classify`.
fn decode_direct(pid: i32, addr: u64, kind: AccessKind) -> Vec<FileAccess> {
    match peer::read_path(pid, addr) {
        Ok(raw) => vec![FileAccess {
            path: peer::resolve_at(pid, libc::AT_FDCWD, &raw),
            kind,
        }],
        Err(_) => Vec::new(),
    }
}

fn decode_at(pid: i32, dirfd: i32, addr: u64, kind: AccessKind) -> Vec<FileAccess> {
    match peer::read_path(pid, addr) {
        Ok(raw) => vec![FileAccess {
            path: peer::resolve_at(pid, dirfd, &raw),
            kind,
        }],
        Err(_) => Vec::new(),
    }
}

fn decode_at_with_flags(pid: i32, dirfd: i32, addr: u64, flags: u64) -> Vec<FileAccess> {
    match peer::read_path(pid, addr) {
        Ok(raw) => vec![FileAccess {
            path: peer::resolve_at(pid, dirfd, &raw),
            kind: openat_kind_from_flags(flags),
        }],
        Err(_) => Vec::new(),
    }
}

fn decode_from_fd(pid: i32, fd: i32, kind: AccessKind) -> Vec<FileAccess> {
    match peer::path_of_fd(pid, fd) {
        Ok(path) => vec![FileAccess { path, kind }],
        Err(_) => Vec::new(),
    }
}

fn decode_pair_direct(pid: i32, a: u64, b: u64, kind: AccessKind) -> Vec<FileAccess> {
    let mut out = Vec::with_capacity(2);
    out.extend(decode_direct(pid, a, kind));
    out.extend(decode_direct(pid, b, kind));
    out
}

fn decode_pair_at(
    pid: i32,
    old_dirfd: i32,
    old_addr: u64,
    new_dirfd: i32,
    new_addr: u64,
) -> Vec<FileAccess> {
    let mut out = Vec::with_capacity(2);
    out.extend(decode_at(pid, old_dirfd, old_addr, AccessKind::Write));
    out.extend(decode_at(pid, new_dirfd, new_addr, AccessKind::Write));
    out
}

/// Forces `PathBuf` to count as used — the import lives in this
/// module for forward compatibility with handlers that build paths
/// from non-peer sources.
#[allow(dead_code)]
fn _force_pathbuf_import() -> PathBuf {
    PathBuf::new()
}
