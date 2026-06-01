//! NAPI surface for the Windows file-access tracker — Windows-only.
//!
//! `trackWithIatHook(argv, dllPath, options, onStarted)`:
//! 1. `CreateProcessW` the target **suspended** (so nothing runs before the
//!    hooks are in place).
//! 2. Create the per-spawn named-pipe server `\\.\pipe\fspy-<childPid>`.
//! 3. Inject `fspy_windows.dll` via `VirtualAllocEx` + `WriteProcessMemory` +
//!    `CreateRemoteThread(LoadLibraryW)`; the DLL's `DllMain` connects the pipe
//!    (derived from its own PID) and installs the IAT hooks.
//! 4. Resume the main thread; drain `[mode][path]` messages off the pipe until
//!    the child exits.
//!
//! Pure Win32 (no Detours/vcpkg). IAT pointer-swapping in the DLL is
//! arch-independent, so the same path covers x64 and ARM64.
//!
//! v1 inherits the parent's stdio (no capture yet — the orchestrator's
//! fingerprinting needs the accesses + exit code; stdout/stderr capture is a
//! follow-up), so `stdout`/`stderr` come back empty.

#![cfg(target_os = "windows")]
#![allow(clippy::too_many_lines)]

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::mpsc;
use std::thread;

use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use windows_sys::Win32::Foundation::{CloseHandle, GetLastError, FALSE, HANDLE, INVALID_HANDLE_VALUE, TRUE, WAIT_OBJECT_0};
use windows_sys::Win32::Storage::FileSystem::{ReadFile, PIPE_ACCESS_INBOUND};
use windows_sys::Win32::System::Diagnostics::Debug::WriteProcessMemory;
use windows_sys::Win32::System::LibraryLoader::{GetModuleHandleW, GetProcAddress};
use windows_sys::Win32::System::Memory::{VirtualAllocEx, VirtualFreeEx, MEM_COMMIT, MEM_RELEASE, MEM_RESERVE, PAGE_READWRITE};
use windows_sys::Win32::System::Pipes::{ConnectNamedPipe, CreateNamedPipeW, PIPE_READMODE_MESSAGE, PIPE_TYPE_MESSAGE, PIPE_WAIT};
use windows_sys::Win32::System::Threading::{
    CreateProcessW, CreateRemoteThread, GetExitCodeProcess, ResumeThread, WaitForSingleObject, CREATE_SUSPENDED, CREATE_UNICODE_ENVIRONMENT, INFINITE,
    LPTHREAD_START_ROUTINE, PROCESS_INFORMATION, STARTUPINFOW,
};

#[napi(object)]
pub struct WinFileAccess {
    pub path: String,
    pub kind: String,
}

#[napi(object)]
pub struct WinTrackingResult {
    pub accesses: Vec<WinFileAccess>,
    pub exit_code: i32,
    pub stdout: Buffer,
    pub stderr: Buffer,
}

#[napi(object)]
pub struct WinSpawnOptions {
    pub cwd: Option<String>,
    pub env: Option<HashMap<String, String>>,
}

/// `trackWithIatHook(argv, dllPath, options?, onStarted?)`. `argv` is a direct
/// binary invocation; the DLL at `dllPath` is injected and reports accesses.
#[napi(
    catch_unwind,
    ts_args_type = "argv: Array<string>, dllPath: string, options?: WinSpawnOptions | undefined | null, onStarted?: ((pid: number) => void) | undefined | null"
)]
pub async fn track_with_iat_hook(
    argv: Vec<String>,
    dll_path: String,
    options: Option<WinSpawnOptions>,
    on_started: Option<ThreadsafeFunction<u32, (), u32, Status, false>>,
) -> Result<WinTrackingResult> {
    if argv.is_empty() {
        return Err(Error::new(Status::InvalidArg, "argv must not be empty"));
    }

    let cwd = options.as_ref().and_then(|o| o.cwd.clone());
    let env = options.and_then(|o| o.env);

    let (pid_tx, pid_rx) = mpsc::sync_channel::<u32>(1);

    let work = tokio::task::spawn_blocking(move || run(argv, dll_path, cwd, env, pid_tx));

    if let Some(tsfn) = on_started {
        tokio::task::spawn_blocking(move || {
            if let Ok(pid) = pid_rx.recv() {
                tsfn.call(pid, ThreadsafeFunctionCallMode::NonBlocking);
            }
        });
    }

    work.await
        .map_err(|e| Error::new(Status::GenericFailure, format!("windows tracker panicked: {e}")))?
        .map_err(|e| Error::new(Status::GenericFailure, format!("windows tracker failed: {e}")))
}

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

/// Quote one argv element per the `CommandLineToArgvW` rules so the child
/// re-parses the exact arguments.
fn quote_arg(arg: &str) -> String {
    if !arg.is_empty() && !arg.contains([' ', '\t', '\n', '\u{0b}', '"']) {
        return arg.to_string();
    }

    let mut out = String::from('"');
    let mut backslashes = 0;

    for ch in arg.chars() {
        match ch {
            '\\' => {
                backslashes += 1;
            }
            '"' => {
                out.extend(std::iter::repeat('\\').take(backslashes * 2 + 1));
                out.push('"');
                backslashes = 0;
            }
            _ => {
                out.extend(std::iter::repeat('\\').take(backslashes));
                backslashes = 0;
                out.push(ch);
            }
        }
    }

    out.extend(std::iter::repeat('\\').take(backslashes * 2));
    out.push('"');
    out
}

/// Build the `CREATE_UNICODE_ENVIRONMENT` block: `key=value\0…\0\0`. The
/// caller's overrides are merged on top of the current process environment.
fn build_env_block(overrides: &HashMap<String, String>) -> Vec<u16> {
    let mut merged: HashMap<String, String> = std::env::vars().collect();
    for (k, v) in overrides {
        merged.insert(k.clone(), v.clone());
    }

    let mut block: Vec<u16> = Vec::new();
    for (k, v) in &merged {
        block.extend(format!("{k}={v}").encode_utf16());
        block.push(0);
    }
    block.push(0);
    block
}

fn close(handle: HANDLE) {
    if !handle.is_null() && handle != INVALID_HANDLE_VALUE {
        unsafe { CloseHandle(handle) };
    }
}

fn run(
    argv: Vec<String>,
    dll_path: String,
    cwd: Option<String>,
    env: Option<HashMap<String, String>>,
    pid_tx: mpsc::SyncSender<u32>,
) -> std::io::Result<WinTrackingResult> {
    let command_line = argv.iter().map(|a| quote_arg(a)).collect::<Vec<_>>().join(" ");
    let mut cmd_wide = wide(&command_line);

    let cwd_wide = cwd.as_deref().map(wide);
    let mut env_block = env.as_ref().map(build_env_block);

    let mut startup: STARTUPINFOW = unsafe { std::mem::zeroed() };
    startup.cb = std::mem::size_of::<STARTUPINFOW>() as u32;

    let mut info: PROCESS_INFORMATION = unsafe { std::mem::zeroed() };

    let creation_flags = CREATE_SUSPENDED | if env_block.is_some() { CREATE_UNICODE_ENVIRONMENT } else { 0 };

    let ok = unsafe {
        CreateProcessW(
            std::ptr::null(),
            cmd_wide.as_mut_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            FALSE,
            creation_flags,
            env_block.as_mut().map_or(std::ptr::null(), |b| b.as_mut_ptr().cast()),
            cwd_wide.as_ref().map_or(std::ptr::null(), |w| w.as_ptr()),
            &startup,
            &mut info,
        )
    };

    if ok == FALSE {
        return Err(std::io::Error::from_raw_os_error(unsafe { GetLastError() } as i32));
    }

    let child_pid = info.dwProcessId;
    let _ = pid_tx.send(child_pid);

    // Create the per-spawn pipe server BEFORE injecting, so the DLL's connect
    // (on attach, before resume) always finds it.
    let pipe_name = wide(&format!(r"\\.\pipe\fspy-{child_pid}"));
    let pipe = unsafe {
        CreateNamedPipeW(
            pipe_name.as_ptr(),
            PIPE_ACCESS_INBOUND,
            PIPE_TYPE_MESSAGE | PIPE_READMODE_MESSAGE | PIPE_WAIT,
            1,
            0,
            64 * 1024,
            0,
            std::ptr::null(),
        )
    };

    // Inject the DLL. Failures here degrade to "no tracking": resume the child
    // so it still runs, just untracked.
    let injected = pipe != INVALID_HANDLE_VALUE && inject_dll(info.hProcess, &dll_path);

    // Reader thread drains the pipe until the child closes its write end (EOF).
    let reader = if injected {
        let handle = pipe as isize;
        Some(thread::spawn(move || drain_pipe(handle as HANDLE)))
    } else {
        if pipe != INVALID_HANDLE_VALUE {
            close(pipe);
        }
        None
    };

    unsafe { ResumeThread(info.hThread) };
    unsafe { WaitForSingleObject(info.hProcess, INFINITE) };

    let mut exit_code: u32 = 1;
    unsafe { GetExitCodeProcess(info.hProcess, &mut exit_code) };

    let accesses = reader.map(|r| r.join().unwrap_or_default()).unwrap_or_default();

    close(info.hThread);
    close(info.hProcess);

    Ok(WinTrackingResult {
        accesses,
        exit_code: exit_code as i32,
        stdout: Buffer::from(Vec::new()),
        stderr: Buffer::from(Vec::new()),
    })
}

/// `VirtualAllocEx` + `WriteProcessMemory` the wide DLL path into the child,
/// then `CreateRemoteThread(LoadLibraryW)` to load it. Returns true on success.
fn inject_dll(process: HANDLE, dll_path: &str) -> bool {
    let path_wide = wide(dll_path);
    let bytes = path_wide.len() * std::mem::size_of::<u16>();

    unsafe {
        let remote = VirtualAllocEx(process, std::ptr::null(), bytes, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
        if remote.is_null() {
            return false;
        }

        let mut written = 0usize;
        let wrote = WriteProcessMemory(process, remote, path_wide.as_ptr().cast(), bytes, &mut written);
        if wrote == FALSE {
            VirtualFreeEx(process, remote, 0, MEM_RELEASE);
            return false;
        }

        let kernel32 = GetModuleHandleW(wide("kernel32.dll").as_ptr());
        if kernel32.is_null() {
            VirtualFreeEx(process, remote, 0, MEM_RELEASE);
            return false;
        }

        let load_library = GetProcAddress(kernel32, c"LoadLibraryW".as_ptr().cast());
        let Some(load_library) = load_library else {
            VirtualFreeEx(process, remote, 0, MEM_RELEASE);
            return false;
        };

        // LoadLibraryW(LPCWSTR) matches the LPTHREAD_START_ROUTINE shape
        // (one pointer arg); the remote allocation is that arg.
        let start: LPTHREAD_START_ROUTINE = Some(std::mem::transmute(load_library));
        let thread = CreateRemoteThread(process, std::ptr::null(), 0, start, remote, 0, std::ptr::null_mut());

        if thread == INVALID_HANDLE_VALUE || thread.is_null() {
            VirtualFreeEx(process, remote, 0, MEM_RELEASE);
            return false;
        }

        WaitForSingleObject(thread, INFINITE);
        close(thread);
        VirtualFreeEx(process, remote, 0, MEM_RELEASE);
        true
    }
}

/// Read `[u8 mode][utf-8 path]` messages off the pipe until EOF, de-duplicating.
fn drain_pipe(pipe: HANDLE) -> Vec<WinFileAccess> {
    let mut seen = std::collections::HashSet::<(String, u8)>::new();
    let mut out = Vec::new();

    // Block until the injected DLL connects (or the child exited without it).
    unsafe { ConnectNamedPipe(pipe, std::ptr::null_mut()) };

    let mut buf = [0u8; 1 + 32 * 1024];

    loop {
        let mut read: u32 = 0;
        let ok = unsafe { ReadFile(pipe, buf.as_mut_ptr().cast(), buf.len() as u32, &mut read, std::ptr::null_mut()) };

        if ok == FALSE || read == 0 {
            break; // pipe closed (child + DLL gone) or error.
        }

        let n = read as usize;
        if n < 2 {
            continue;
        }

        let mode = buf[0];
        let path = String::from_utf8_lossy(&buf[1..n]).into_owned();

        if !path.is_empty() && seen.insert((path.clone(), mode)) {
            out.push(WinFileAccess { path, kind: kind_str(mode).to_string() });
        }
    }

    close(pipe);
    out
}

fn kind_str(mode: u8) -> &'static str {
    match mode {
        1 => "write",
        2 => "stat",
        3 => "readdir",
        _ => "read",
    }
}

// Touch otherwise-unused imports referenced only in specific control-flow
// branches so the windows-gnu check stays warning-clean.
#[allow(dead_code)]
fn _anchors() {
    let _ = WAIT_OBJECT_0;
    let _ = TRUE;
}
