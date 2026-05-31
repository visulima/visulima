# Design — Windows file-access tracker via Microsoft Detours

Spec for closing the Windows gap in `file-access-tracker.ts`. Today auto-fingerprint (`autoFingerprint: true` or per-target `hashMode: "trace"`) silently degrades on Windows: the strace path is Linux-only and the Node preload is bypassed by any native binary. Vite-task's [`fspy_detours_sys`](https://github.com/voidzero-dev/vite-task/tree/main/crates/fspy_detours_sys) closes the same gap with [Microsoft Detours](https://github.com/microsoft/Detours); this RFC plans the equivalent for `@visulima/task-runner`.

## Why

Auto-fingerprint correctness on Windows is currently a known-bad path:

- `isStraceAvailable()` returns `false` on Windows.
- The Node preload only fires for `node`-spawned children that go through `node:fs`. A native build (msbuild, `tsc` going through its native binary, `cargo`, `protoc`, any compiled CLI) does its file I/O via `kernel32!CreateFileW` and `ntdll!NtReadFile` — invisible to a JS preload.
- Today the orchestrator sees an empty access set, sets `emptyFingerprint: true`, refuses to seed the cache, and the user gets a cache-miss every run. The diagnostic is honest, but the _capability_ is missing.

Windows is a first-class target for vis (it ships a `win32-x64-msvc` / `win32-arm64-msvc` native binding pair). The runner's "intelligent caching" pitch falls apart on Windows for any project that compiles native code.

## Approach

Detours hooks the Windows loader's Import Address Table at process start. We inject `task-runner-fspy.dll` into the child via `DetourCreateProcessWithDllEx`, the DLL patches the IAT entries for the file-API surface, and every hooked call forwards the path back to the parent over a named pipe before tail-calling the original.

### Hook surface

Equivalent to fspy's set; minimum viable cut:

| API                    | Access type      | Why                                                 |
| ---------------------- | ---------------- | --------------------------------------------------- |
| `CreateFileW`          | `read` / `write` | The funnel — fopen/open/\_wopen all bottom out here |
| `CreateFileA`          | same             | ANSI variant still used by older toolchains         |
| `GetFileAttributesExW` | `stat`           | Existence checks (tsc resolution, npm)              |
| `FindFirstFileExW`     | `readdir`        | Directory enumeration (glob, watch)                 |
| `MoveFileExW`          | `write` (both)   | Rename = write to both paths                        |
| `DeleteFileW`          | `write`          | Cache invalidation needs to see deletes             |
| `NtCreateFile`         | `read` / `write` | Bypass-the-Win32-API tools (cargo, MSVC linker)     |
| `NtOpenFile`           | `read`           | Same                                                |

`NtCreateFile`/`NtOpenFile` hooks are the ones that actually matter for "static-binary" cases. Without them we miss the same set of children the preload misses today.

Match the existing TS contract:

```ts
interface FileAccess {
    path: string;
    type: "missing" | "read" | "readdir" | "stat" | "write";
}
```

The DLL emits these events; the supervisor reads them and folds them into `TrackingResult.accesses` exactly like the strace branch does.

### Architecture

```text
+---------------------+
| task-runner (node)  |
|  spawns child via   |
|  DetourCreateProcess|
|  WithDllExW         |
+----+----------------+
     |
     |  inherited handle: named pipe "\\.\pipe\fspy-<pid>"
     v
+---------------------+
| child.exe           |
|  task-runner-fspy.dll loaded at start
|  IAT hooked for the table above
|  on hook: serialize {api, path, flags} -> pipe
|  tail-call original
+---------------------+
```

- Named pipe per spawn (not a shared pipe) — keeps multi-process runs clean.
- Pipe is `PIPE_TYPE_MESSAGE` so the supervisor reads whole events, not byte streams.
- Each event is a 16-byte header (op, flags, path-len-utf16, reserved) + UTF-16 path. Cheap to serialize, cheap to parse.
- The DLL must be exported as both x64 and arm64 — Windows enforces architecture match for IAT hooking.

### Path normalization

- Strip `\\?\` and `\\.\` long-path prefixes.
- Canonicalize via `GetFinalPathNameByHandleW` only when the hook has the handle (post-`CreateFileW`); else leave as the literal argument and let the supervisor resolve it. Doing the cheap thing in the hot path matters — every hook adds latency.
- Map Windows backslash paths to forward-slash workspace-relative paths in the supervisor, _not_ in the DLL, so the DLL stays minimal.

### Crate layout

```text
packages/tooling/task-runner/native/fspy_windows/
  Cargo.toml          # cdylib, target = x86_64-pc-windows-msvc + aarch64
  build.rs            # link detours.lib, find Detours via vcpkg or vendored
  src/lib.rs          # DllMain, hook installers, pipe writer
  src/hooks.rs        # one fn per API in the table above
  src/pipe.rs         # message framing
  src/path.rs         # \\?\ stripping
```

Build wiring:

- Add a new entry to `native/Cargo.toml` workspace members.
- Ship the DLL as a sidecar inside each `@visulima/task-runner-binding-win32-*` package (place under `bin/task-runner-fspy.dll`). The supervisor resolves it via the same `npm/<target>` lookup the existing native addon uses.
- CI: the existing `build-native.yml` already runs `windows-2022` for `x86_64-pc-windows-msvc` and `aarch64-pc-windows-msvc`. Extend the matrix to also build `fspy_windows` for the same triples; publish via the existing `semantic-release-native-addons.mjs` plugin (add the DLL to its `files` set).

### Detours licensing

Detours is **MIT** (since 2016) — compatible with our license, no special attribution beyond the standard MIT notice. Bundle the upstream copy via vcpkg or a vendored submodule under `native/fspy_windows/vendor/Detours/`. Document the version pin in `native/fspy_windows/THIRD_PARTY.md`.

### Integration with `file-access-tracker.ts`

Add a third tracking branch alongside strace and preload:

```ts
const trackImpl: "detours" | "preload" | "strace" = platform() === "win32" && isDetoursAvailable() ? "detours" : isStraceAvailable() ? "strace" : "preload";
```

- New `isDetoursAvailable()` checks for the sidecar DLL in the platform binding.
- New `trackWithDetours(cmd, args, options)` mirrors the existing `trackWithStrace` shape and returns the same `TrackingResult`.
- Falls back to preload (and an `emptyFingerprint: true` diagnostic when the child is a native binary) when the DLL isn't shippable in a given install — keeps non-Windows installs unaffected.

## Plan

| Step                                                                     | Effort | Validation                                                          |
| ------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------- |
| Scaffold `fspy_windows` crate; stub `DllMain` + one hook (`CreateFileW`) | 1d     | DLL loads, emits one event                                          |
| Add IPC pipe + supervisor reader                                         | 1d     | Round-trip a `CreateFileW` event                                    |
| Implement the full hook table (Win32 + Nt\* via Detours IAT)             | 2d     | Hook surface complete; cargo + MSVC linker covered                  |
| TS integration (`trackWithDetours`, dispatch)                            | 1d     | Existing unit tests pass with `VIS_FORCE_DETOURS=1` on Windows      |
| CI matrix wiring (build + publish)                                       | 1d     | DLL ships inside the win32 binding packages                         |
| Integration tests on real Windows runners                                | 1d     | At least one test covering a native-binary child (cargo or msbuild) |

**Total**: ~1 week of focused work on a Windows box. Cannot be developed reliably from Linux — requires a Windows VM/CI loop.

## Non-goals

- Bypass-injection (process hollowing, ptrace-equivalents) — Detours' IAT patching is enough for our workload and avoids EDR false positives.
- Hooking `WriteFile` for partial-write tracking. The "write" intent is captured at `CreateFileW` time (`dwDesiredAccess & GENERIC_WRITE`); per-write byte counts aren't needed for cache invalidation.
- Windows < 10. Detours supports older, but the existing `engines.node` floor already excludes them.

## Risks

- **EDR / Defender flags.** IAT patching is a malware-adjacent technique; some enterprise EDR will quarantine the DLL. Document the workaround (path-allowlist) and provide a SHA-256 hash users can pin in their EDR config.
- **DLL search order.** If the user has a same-named DLL in `%PATH%`, ours could be shadowed. Mitigate by embedding a unique resource version + the supervisor verifying via `GetModuleFileNameExW` post-spawn.
- **ARM64 emulation.** On WoA running x64 children under emulation, the IAT hooks need the right arch DLL. The supervisor must inspect the child PE arch before injecting. Add explicit handling; don't silently fall back to "no tracking".
