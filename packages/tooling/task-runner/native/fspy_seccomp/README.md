# fspy_seccomp

Linux file-access tracker via `seccomp_unotify`. Closes the
Alpine / musl / static-binary gap the strace + Node-preload paths
in `src/file-access-tracker.ts` can't cover.

## How it works

The supervisor (called from the NAPI binding in
`../src/seccomp.rs`) sets up a per-spawn Unix socket listener,
then `Command::spawn`s the helper binary with `FSPY_SOCK=<path>`
and the target argv. `Command` without `pre_exec` uses
`posix_spawn` under the hood, which is multi-thread-safe (vfork

- exec internally) — the fork-from-multithreaded hazard that
  ruled out installing seccomp directly in `pre_exec` doesn't
  apply.

The helper runs in a fresh single-threaded process where
libseccomp is safe to call: it does `prctl(PR_SET_NO_NEW_PRIVS)`,
installs the BPF filter, retrieves the kernel notify fd, connects
to `FSPY_SOCK` and hands the fd to the parent via `SCM_RIGHTS`,
then `execve`s the target.

From that point the parent's supervisor thread loops on
`seccomp_notify_receive`, decodes each notification through
`syscalls::classify` (`process_vm_readv` to read pathname strings
from the child's address space; `/proc/<pid>/cwd` and
`/proc/<pid>/fd/<n>` to resolve `dirfd`-relative paths), and acks
with `SECCOMP_USER_NOTIF_FLAG_CONTINUE` so the syscall runs
unchanged.

```text
parent (Node + .node addon)
┌──────────────────────────────┐
│ create Unix socket listener  │
│ at $TMPDIR/fspy-XXXX.sock    │
│                              │
│ Command::spawn(              │   ┌────────────────────────────┐
│   "fspy-seccomp-helper",     │   │ helper (fresh single-      │
│   argv=[target_cmd, args],   │──►│ threaded process)          │
│   env={FSPY_SOCK=<path>})    │   │  1. PR_SET_NO_NEW_PRIVS    │
│   (posix_spawn under hood —  │   │  2. seccomp_load -> fd     │
│    no pre_exec hook)         │   │  3. connect to FSPY_SOCK   │
│                              │   │  4. send fd via SCM_RIGHTS │
│ accept connection            │◄──│  5. execve(target)         │
│ recv notify_fd via SCM_RIGHTS│◄──│                            │
│                              │   └────────────────────────────┘
│ supervisor thread:           │
│   seccomp_notify_receive     │
│   -> classify(notif, pid)    │
│   -> CONTINUE                │
│ drain stdout/stderr pipes    │
│ wait(child)                  │
└──────────────────────────────┘
```

See [`../../rfc/design-fspy-seccomp-unotify.md`](../../rfc/design-fspy-seccomp-unotify.md) for the full design (intercepted syscalls, fork-tracking, BPF filter shape, integration plan).

## Module map

| File                | What it does                                                       |
| ------------------- | ------------------------------------------------------------------ |
| `src/lib.rs`        | Orchestrator: listener + spawn + supervisor thread + stdio capture |
| `src/bin/helper.rs` | Per-spawn helper binary — installs filter and hands fd back        |
| `src/filter.rs`     | libseccomp wrapper — registers tracked syscalls, returns notify fd |
| `src/supervisor.rs` | Notify-fd consumer loop (receive → classify → respond)             |
| `src/syscalls.rs`   | Full syscall table + per-call decoders (openat, stat, etc.)        |
| `src/peer.rs`       | `/proc/<pid>/{cwd,fd}` + `process_vm_readv` for path resolution    |

## Testing

```bash
cargo test
```

Covers:

- `openat` end-to-end with path resolution (cat /etc/hostname)
- Relative-path resolution via `/proc/<pid>/cwd` (cd + cat)
- `unlinkat` write classification (rm)
- `fstatat`/`faccessat` stat classification (test -e)
- `getdents64` readdir classification with fd resolution (ls)

## Why a helper bin (not pre_exec)

A `Command::pre_exec` hook that calls libseccomp works fine from
single-threaded callers (cargo's test harness), but breaks when
the parent is Node's multi-threaded NAPI runtime: forking from
a thread inherits allocator + libseccomp locks held by sibling
threads, and the child's pre_exec libseccomp calls hit undefined
behaviour (observed: cat exit 1, EBADF on fd 1, locale-lookup
storms instead of the actual openat).

The helper binary sidesteps the fork hazard entirely — `Command`
without `pre_exec` uses `posix_spawn` under the hood, which is
multi-thread-safe (vfork+exec internally). The helper does the
unsafe-from-multithread work in its own fresh process. Same
pattern vite-task's `fspy_seccomp_unotify` uses.
