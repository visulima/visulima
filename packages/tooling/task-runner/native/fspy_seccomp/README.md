# fspy_seccomp

**Status: WIP scaffold.** Linux file-access tracker via `seccomp_unotify`.

This crate exists so the work has a home and so `cargo check` keeps the design honest as it lands. Nothing here actually traces a syscall today — `lib::track_command` errors `Unsupported` and the production runner keeps using its strace / preload fallback in `src/file-access-tracker.ts`.

See [`../../rfc/design-fspy-seccomp-unotify.md`](../../rfc/design-fspy-seccomp-unotify.md) for the full design (intercepted syscalls, fork-tracking pattern, BPF filter shape, integration plan).

## Module map

| File                | What goes here                                         |
| ------------------- | ------------------------------------------------------ |
| `src/lib.rs`        | Public NAPI surface (`track_command`, types)           |
| `src/filter.rs`     | BPF program builder                                    |
| `src/supervisor.rs` | In-process notify-fd consumer loop                     |
| `src/peer.rs`       | `/proc/<pid>/{cwd,fd}` resolution + `process_vm_readv` |
| `src/syscalls.rs`   | Per-arch syscall numbers + flag→AccessKind decoding    |

No separate supervisor binary — runs in-process as a Rust thread owned by the NAPI lib (decided during the RFC scaffold audit; out-of-process design adds IPC + packaging cost we don't yet need).
