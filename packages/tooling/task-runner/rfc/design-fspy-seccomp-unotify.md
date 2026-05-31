# Design — Linux file-access tracker via `seccomp_unotify`

Spec for closing the static-binary / musl gap in `file-access-tracker.ts` on Linux. Today the strace branch only works when `strace` is installed (often false in Alpine/distroless), and the preload branch only catches dynamically-linked children that go through libc — meaning Go binaries, statically-linked Rust binaries, and anything under musl libc silently track zero accesses. Vite-task's [`fspy_seccomp_unotify`](https://github.com/voidzero-dev/vite-task/tree/main/crates/fspy_seccomp_unotify) solves this with kernel-level syscall interception; this RFC plans the equivalent.

## Why

The fingerprint accuracy story on Linux today:

| Child kind                                                                     | strace path                   | preload path | reality                                           |
| ------------------------------------------------------------------------------ | ----------------------------- | ------------ | ------------------------------------------------- |
| Node / dynamically-linked glibc binary                                         | works                         | works        | tracked correctly                                 |
| Statically-linked binary (Go, cargo build with `-Ctarget-feature=+crt-static`) | works **if** strace installed | empty        | tracked only when strace happens to be present    |
| musl libc (Alpine, distroless)                                                 | works                         | empty        | preload bypassed; users assume tracked, get empty |
| no-strace environment (slim CI images)                                         | empty                         | partial      | silent degradation                                |

The orchestrator does the honest thing — surfaces `emptyFingerprint: true` and refuses to cache — but the _capability_ gap is still real. Users on Alpine images (the entire `node:alpine` / distroless population) can't use auto-fingerprint reliably.

`seccomp_unotify` (Linux 5.0+, the `SECCOMP_RET_USER_NOTIF` filter mode) lets a parent process subscribe to a child's syscall stream from kernel space — independent of libc, of static vs dynamic linking, of which language compiled the binary. It's the right correctness primitive for this gap.

## Approach

```text
+---------------------+
| task-runner (node)  |
|  fork() child       |
|  child: prctl(PR_SET_NO_NEW_PRIVS); install seccomp filter; execve()
|  parent: epoll on notify fd (handed back via SCM_RIGHTS)
+----+----------------+
     |
     |  notify fd: kernel pushes { id, pid, syscall, args } per intercepted call
     v
+---------------------+
| supervisor (rust)   |
|  reads notification |
|  resolves path via  |
|  /proc/<pid>/cwd +  |
|  /proc/<pid>/mem    |
|  emits FileAccess   |
|  acks with CONTINUE |
+---------------------+
```

Kernel posts a notification, the supervisor reads it via `ioctl(SECCOMP_IOCTL_NOTIF_RECV)`, resolves the path, records the access, and acks with `SECCOMP_IOCTL_NOTIF_SEND { flags: SECCOMP_USER_NOTIF_FLAG_CONTINUE }`. The child runs the original syscall — the supervisor never decides outcomes, only observes.

### Intercepted syscalls

Match the strace pattern set so the supervisor can reuse `STRACE_PATTERNS` mapping logic without changes:

| Syscall                                    | Access type                   | Path source                               |
| ------------------------------------------ | ----------------------------- | ----------------------------------------- |
| `openat` / `openat2`                       | `read` or `write` (via flags) | arg2 (filename)                           |
| `open` (legacy)                            | same                          | arg1                                      |
| `stat` / `fstatat` / `newfstatat`          | `stat`                        | arg2 (or arg1 for `stat`)                 |
| `access` / `faccessat` / `faccessat2`      | `stat`                        | path arg                                  |
| `statx`                                    | `stat`                        | arg2                                      |
| `getdents64`                               | `readdir`                     | resolved from fd via `/proc/<pid>/fd/<n>` |
| `unlink` / `unlinkat`                      | `write`                       | path arg                                  |
| `rename` / `renameat` / `renameat2`        | `write` (both old + new)      | arg2 + arg4                               |
| `chdir` / `fchdir`                         | cwd-cache invalidation        | path arg (or resolve fd)                  |
| `readlink` / `readlinkat`                  | `read`                        | path arg                                  |
| `mkdir` / `mkdirat`, `rmdir`               | `write`                       | path arg                                  |
| `symlink` / `symlinkat`, `link` / `linkat` | `write`                       | both paths (source + target)              |

The flag-mapping (`O_WRONLY`/`O_RDWR`/`O_CREAT`/`O_TRUNC` → `"write"`) already exists in `file-access-tracker.ts`; reuse it.

### Path resolution

User-space pointers in syscall arguments need to be read from the child's address space. Two viable paths:

1. **`/proc/<pid>/mem`** + `pread(addr, len)` — what strace uses. Has the right semantics around `ptrace`-style stoppage.
2. **`process_vm_readv()`** — faster, no `PTRACE_ATTACH` indirection (the call doesn't stop the child), but the kernel still requires `CAP_SYS_PTRACE` _or_ a matching uid/gid pair. Always satisfied here — we forked the child, so the parent's credentials match — so use this.

Resolve relative paths via `/proc/<pid>/cwd` (a symlink to the child's current working directory). Cache the cwd per-pid; invalidate on `chdir`/`fchdir` notifications.

For fd-based syscalls (`fstatat(AT_FDCWD, ...)`, `getdents64(dirfd, ...)`), resolve the fd via `/proc/<pid>/fd/<n>` and prepend.

### Crate layout

```text
packages/tooling/task-runner/native/fspy_seccomp/
  Cargo.toml          # cdylib feature, target = linux
  build.rs            # generate syscall constants for current arch
  src/lib.rs          # NAPI entrypoint; spawns supervisor task
  src/filter.rs       # BPF filter program (libseccomp-sys, not libseccomp)
  src/supervisor.rs   # notify-fd reader loop
  src/peer.rs         # process_vm_readv + path canonicalization
  src/syscalls.rs     # x86_64 + aarch64 + riscv64 syscall numbers
```

- Pure Rust — no C dependency beyond `libseccomp-sys` (BSD-2). No glibc-only APIs; runs identically on glibc, musl, and any other libc.
- NAPI surface: `trackWithSeccomp(cmd, args, options) -> Promise<TrackingResult>`. Mirrors `trackWithStrace` exactly.
- Linux-only crate; gated by `#[cfg(target_os = "linux")]` so the workspace still builds on macOS/Windows.

### BPF filter

Minimal program — match on syscall number, return `SECCOMP_RET_USER_NOTIF` for the table above, `SECCOMP_RET_ALLOW` for everything else. Generate at runtime from `syscalls.rs` constants so the filter is correct per-architecture.

Filter installed _after_ `PR_SET_NO_NEW_PRIVS` in the child, _before_ `execve` — standard pattern. The filter's notify fd is returned to the parent via the seccomp `SECCOMP_FILTER_FLAG_NEW_LISTENER` flow.

### Integration with `file-access-tracker.ts`

Promote the existing two-branch dispatch to a four-branch one:

```ts
const trackImpl =
    platform() === "win32" && isDetoursAvailable()
        ? "detours" // see RFC
        : platform() === "linux" && isSeccompAvailable()
          ? "seccomp"
          : isStraceAvailable()
            ? "strace"
            : "preload";
```

`isSeccompAvailable()`:

1. `platform() === "linux"`.
2. Linux ≥ 5.0 (`uname.release`).
3. `/proc/self/status` has the kernel-build flag for `SECCOMP_FILTER` (universally true on modern distros — sanity check, not blocker).
4. The native binding is available for this triple.

Order matters: prefer `seccomp` over `strace` once available — it's faster (no ptrace context-switching), more accurate (catches static + musl), and requires no external binary.

## Plan

| Step                                                                            | Effort | Status                                                                                                                                                                                           |
| ------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scaffold `fspy_seccomp` crate; filter installer + minimal `openat` interception | 1d     | ✅ Done                                                                                                                                                                                          |
| Path resolution via `process_vm_readv` + `/proc/<pid>/cwd`                      | 1d     | ✅ Done                                                                                                                                                                                          |
| Full syscall table + flag→type mapping                                          | 1d     | ✅ Done (openat/openat2/open, stat/lstat/fstatat/newfstatat/statx, access/faccessat[2], getdents64, readlink[at], unlink[at], rename/renameat/renameat2, mkdir[at]/rmdir, symlink[at], link[at]) |
| NAPI surface + TS integration                                                   | 1d     | ✅ Done — dispatch in `src/file-access-tracker.ts` prefers seccomp over strace                                                                                                                   |
| CI packaging of helper bin per platform                                         | 0.5d   | 🔜 Follow-up — needs `build-native.yml` matrix update + binding-package `files` updates                                                                                                          |
| musl + Alpine test (CI matrix addition)                                         | 1d     | 🔜 Follow-up — new CI job: `node:alpine` container with a statically-linked test binary                                                                                                          |
| Performance benchmark vs strace                                                 | 0.5d   | 🔜 Follow-up — document the speedup in the crate README                                                                                                                                          |

**Implementation note (helper-binary pattern):** the first attempt
installed the seccomp filter directly in a `Command::pre_exec`
hook (the same way the strace path wraps spawns). It works
end-to-end from `cargo test` but breaks under Node's NAPI host —
forking from a multi-threaded runtime (V8 + libuv + tokio
workers) inherits allocator + libseccomp locks held by sibling
threads, and the child's `libseccomp` calls inside `pre_exec`
hit undefined behaviour (observed: cat exit 1, EBADF on fd 1).

Resolved by adopting the **helper-binary pattern** vite-task's
`fspy_seccomp_unotify` also uses: a tiny `fspy-seccomp-helper`
binary (`src/bin/helper.rs`) is `posix_spawn`-ed by the parent
(multi-thread-safe — uses vfork+exec internally). The helper
runs in a fresh single-threaded process where it's safe to call
`libseccomp`, installs the filter, sends the notify fd back to
the parent over a Unix socket via `SCM_RIGHTS`, then `execve`s
the target. From that point on the parent supervisor (in a
background thread) receives notifications and decodes them via
the syscall dispatch in `src/syscalls.rs`.

## Non-goals

- Intercepting writes for byte-level tracking. The "write" intent is captured at `open(O_WRONLY)` time; we don't need per-`write()` events for cache invalidation.
- Sandboxing. The filter uses `SECCOMP_USER_NOTIF_FLAG_CONTINUE` to always pass through — we observe, we never block. Sandboxing is a different problem and out of scope.
- Pre-Linux-5.0 kernels. The user-notify mechanism is the entire point; older kernels keep using strace.

## Risks

- **`SECCOMP_USER_NOTIF_FLAG_CONTINUE` race.** A determined attacker child could exploit the TOCTOU window between the supervisor receiving the notification and the kernel proceeding with the syscall. Documented kernel limitation; doesn't affect us because we're a passive observer of trusted code, not a sandbox.
- **`fork`/`clone` of children — not a gap.** Earlier drafts of this RFC claimed each forked task gets its own notify fd that our supervisor would miss. That was wrong: `SECCOMP_FILTER_FLAG_NEW_LISTENER` returns a fd associated with the **filter**, not the task. Tasks created via `fork`/`clone` inherit the filter and their notifications fire on the same parent listener — `notif.pid` tells us which task. A single supervisor naturally covers the whole process tree. Verified by `tests/syscall_coverage.rs::forked_descendants_emit_on_root_listener` (sh → sh → sh → cat, leaf openat lands on root listener).
- **`io_uring`-based file I/O.** Submission-queue ops aren't visible to seccomp filters in older kernels (fixed in 5.11+ for `io_uring_enter`-issued syscalls but historically a gap). Document the limitation; defer io_uring tracking until users actually report it as a problem.
- **CAP_SYS_PTRACE in containers.** `process_vm_readv` needs the cap or a yama-trace-friendly profile. Most container runtimes grant ptrace to a process reading its own children — verify on common base images (alpine, debian-slim, distroless) and document any exceptions.
