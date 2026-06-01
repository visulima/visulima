//! `fspy_macos` — a DYLD-interpose dylib that reports a tracked process's
//! file accesses back to the parent over an inherited `AF_UNIX`/`SOCK_DGRAM`
//! socket.
//!
//! ## How it attaches
//!
//! The parent ([`native/src/macos.rs`]) spawns the (PATH-resolved, **directly
//! exec'd** — never via `/bin/sh`, which macOS SIP would strip
//! `DYLD_INSERT_LIBRARIES` from) target binary with:
//!
//! - `DYLD_INSERT_LIBRARIES=<path to this .dylib>`
//! - `FSPY_MACOS_FD=<inherited socket fd>`
//!
//! dyld maps this dylib first and runs [`init`] (via `ctor`) before the
//! target's `main`. `init` adopts the socket fd. Every interposed libc call
//! forwards to the real implementation and then best-effort `send(2)`s one
//! datagram `[u8 mode][path bytes]` to the parent.
//!
//! ## Why fixed-arity hooks (not `c_variadic`)
//!
//! `open`/`openat` are variadic in C (`open(path, flags, ...)`). Defining a
//! variadic Rust fn needs nightly (`feature(c_variadic)`). Instead each hook
//! is declared with the **maximum fixed arity** (`open(path, flags, mode)`).
//! On the macOS arm64/x86_64 SysV-style ABIs the first args arrive in
//! registers, so reading a `mode` slot the caller didn't pass is harmless —
//! we only ever *use* it when `O_CREAT` is set, and we forward all three to
//! the real `open`, which itself ignores `mode` without `O_CREAT`.
//!
//! ## Why a dylib-local interpose call doesn't recurse
//!
//! A `__DATA,__interpose` tuple `{replacement, replacee}` makes dyld redirect
//! *other* images' calls to `replacee` into `replacement`. Inside the
//! interposing image, a call to the same symbol binds to the real
//! implementation — so `libc::open(..)` from within [`hook_open`] is the
//! genuine `open`, not a re-entry into the hook.

#![cfg(target_os = "macos")]
#![allow(clippy::missing_safety_doc)]

use core::ffi::{c_char, c_int, c_void};
use std::cell::Cell;
use std::sync::atomic::{AtomicI32, Ordering};

use libc::{mode_t, size_t, ssize_t, DIR};

/// Wire opcodes — one byte prefix per datagram. Kept in sync with the parser
/// in `native/src/macos.rs`.
mod mode {
    pub const READ: u8 = 0;
    pub const WRITE: u8 = 1;
    pub const STAT: u8 = 2;
    pub const READDIR: u8 = 3;
}

/// Env var carrying the inherited reporting socket fd. Set by the parent.
const FD_ENV: &[u8] = b"FSPY_MACOS_FD\0";

/// The reporting socket, adopted in [`init`]. `-1` means "not tracking" — every
/// hook then degrades to a plain forward with no reporting.
static REPORT_FD: AtomicI32 = AtomicI32::new(-1);

thread_local! {
    /// Guards against re-entrancy: if reporting (or anything it calls) were to
    /// trip another interposed function on the same thread we'd recurse. The
    /// hooks set this around their report so nested hooked calls are skipped.
    static IN_HOOK: Cell<bool> = const { Cell::new(false) };
}

/// dyld interpose tuple. `#[used]` + the `__DATA,__interpose` section is the
/// ABI dyld scans at load time.
#[repr(C)]
struct Interpose {
    replacement: *const c_void,
    replacee: *const c_void,
}

// SAFETY: the pointers are static fn addresses; the struct is only ever read by
// dyld. `Sync` is required to place it in a `static`.
unsafe impl Sync for Interpose {}

/// Adopt the inherited socket the moment dyld maps us, before the target's
/// `main`. Best-effort: any failure leaves `REPORT_FD == -1` (no tracking)
/// rather than disturbing the tracked process.
#[ctor::ctor]
fn init() {
    // SAFETY: `getenv` with a NUL-terminated key; we only read the returned C
    // string, never free it.
    let raw = unsafe { libc::getenv(FD_ENV.as_ptr().cast::<c_char>()) };

    if raw.is_null() {
        return;
    }

    let fd = unsafe { std::ffi::CStr::from_ptr(raw) }
        .to_str()
        .ok()
        .and_then(|s| s.parse::<c_int>().ok());

    let Some(fd) = fd else {
        return;
    };

    if fd < 0 {
        return;
    }

    // macOS has no `MSG_NOSIGNAL`; suppress SIGPIPE per-socket instead so a
    // parent that has gone away can never take the tracked process down.
    let on: c_int = 1;
    // SAFETY: standard setsockopt on an inherited socket fd.
    unsafe {
        libc::setsockopt(
            fd,
            libc::SOL_SOCKET,
            libc::SO_NOSIGPIPE,
            std::ptr::addr_of!(on).cast::<c_void>(),
            std::mem::size_of::<c_int>() as libc::socklen_t,
        );
    }

    REPORT_FD.store(fd, Ordering::Relaxed);
}

/// Best-effort: send one `[mode][path]` datagram. Never blocks (`MSG_DONTWAIT`)
/// and never errors out the caller — a full/closed socket just drops the record.
unsafe fn report(path: *const c_char, mode: u8) {
    if path.is_null() {
        return;
    }

    let fd = REPORT_FD.load(Ordering::Relaxed);

    if fd < 0 {
        return;
    }

    // Re-entrancy guard: skip if we're already inside a hook on this thread.
    let entered = IN_HOOK.with(|flag| {
        if flag.get() {
            return false;
        }

        flag.set(true);

        true
    });

    if !entered {
        return;
    }

    // PATH_MAX (1024 on macOS) + 1 opcode byte. A path longer than this is
    // truncated for the wire; the parent treats it as a best-effort hint.
    const CAP: usize = 1 + 1024;
    let mut buf = [0u8; CAP];

    buf[0] = mode;

    // SAFETY: `path` is a valid NUL-terminated C string from the caller.
    let len = unsafe { libc::strlen(path) }.min(CAP - 1);

    // SAFETY: copying `len <= CAP-1` bytes from the C string into the buffer.
    unsafe {
        std::ptr::copy_nonoverlapping(path.cast::<u8>(), buf.as_mut_ptr().add(1), len);
    }

    // SAFETY: send on the datagram socket; MSG_DONTWAIT keeps it non-blocking.
    unsafe {
        libc::send(fd, buf.as_ptr().cast::<c_void>(), len + 1, libc::MSG_DONTWAIT);
    }

    IN_HOOK.with(|flag| flag.set(false));
}

/// `open(path, flags[, mode])` → classify by access flags.
#[inline]
fn open_mode(flags: c_int) -> u8 {
    if flags & (libc::O_WRONLY | libc::O_RDWR | libc::O_CREAT | libc::O_TRUNC | libc::O_APPEND) != 0 {
        mode::WRITE
    } else {
        mode::READ
    }
}

// ---- hooks -----------------------------------------------------------------
//
// Each hook forwards to the real libc function (resolved within this image, so
// not re-interposed) and reports on success. `extern "C"` + fixed arity.

unsafe extern "C" fn hook_open(path: *const c_char, flags: c_int, mode: mode_t) -> c_int {
    let fd = unsafe { libc::open(path, flags, mode as c_int) };

    if fd >= 0 {
        unsafe { report(path, open_mode(flags)) };
    }

    fd
}

unsafe extern "C" fn hook_openat(dirfd: c_int, path: *const c_char, flags: c_int, mode: mode_t) -> c_int {
    let fd = unsafe { libc::openat(dirfd, path, flags, mode as c_int) };

    if fd >= 0 {
        unsafe { report(path, open_mode(flags)) };
    }

    fd
}

unsafe extern "C" fn hook_stat(path: *const c_char, buf: *mut libc::stat) -> c_int {
    let rc = unsafe { libc::stat(path, buf) };

    if rc == 0 {
        unsafe { report(path, mode::STAT) };
    }

    rc
}

unsafe extern "C" fn hook_lstat(path: *const c_char, buf: *mut libc::stat) -> c_int {
    let rc = unsafe { libc::lstat(path, buf) };

    if rc == 0 {
        unsafe { report(path, mode::STAT) };
    }

    rc
}

unsafe extern "C" fn hook_access(path: *const c_char, amode: c_int) -> c_int {
    let rc = unsafe { libc::access(path, amode) };

    if rc == 0 {
        unsafe { report(path, mode::STAT) };
    }

    rc
}

unsafe extern "C" fn hook_opendir(path: *const c_char) -> *mut DIR {
    let dir = unsafe { libc::opendir(path) };

    if !dir.is_null() {
        unsafe { report(path, mode::READDIR) };
    }

    dir
}

unsafe extern "C" fn hook_rename(old: *const c_char, new: *const c_char) -> c_int {
    let rc = unsafe { libc::rename(old, new) };

    if rc == 0 {
        unsafe { report(old, mode::WRITE) };
        unsafe { report(new, mode::WRITE) };
    }

    rc
}

unsafe extern "C" fn hook_unlink(path: *const c_char) -> c_int {
    let rc = unsafe { libc::unlink(path) };

    if rc == 0 {
        unsafe { report(path, mode::WRITE) };
    }

    rc
}

/// `read`/`write` are NOT hooked — we classify at `open` time, which is enough
/// for cache fingerprinting and keeps the hot path (every byte of I/O) clean.

macro_rules! interpose {
    ($static_name:ident, $replacement:expr, $replacee:expr) => {
        #[used]
        #[link_section = "__DATA,__interpose"]
        static $static_name: Interpose = Interpose {
            replacement: $replacement as *const c_void,
            replacee: $replacee as *const c_void,
        };
    };
}

interpose!(I_OPEN, hook_open, libc::open);
interpose!(I_OPENAT, hook_openat, libc::openat);
interpose!(I_STAT, hook_stat, libc::stat);
interpose!(I_LSTAT, hook_lstat, libc::lstat);
interpose!(I_ACCESS, hook_access, libc::access);
interpose!(I_OPENDIR, hook_opendir, libc::opendir);
interpose!(I_RENAME, hook_rename, libc::rename);
interpose!(I_UNLINK, hook_unlink, libc::unlink);

// Silence "unused" for the libc imports only referenced through interpose
// type-checking on some toolchains.
#[allow(dead_code)]
fn _type_anchors(_: size_t, _: ssize_t) {}
