//! Name-based IAT hooking for the Win32 file-API surface.
//!
//! We walk **every loaded module's** import table and, for every imported
//! function whose name matches one we care about, swap the IAT pointer to our
//! hook and stash the original. Walking all modules (not just the main exe)
//! catches file calls made from other DLLs — the CRT, addon `.node`s, etc.
//! Matching by **function name across all import
//! descriptors** (not by DLL name) means API-set forwarders
//! (`api-ms-win-core-file-l1-1-0.dll` etc.) are handled the same as a direct
//! `kernel32.dll` import. Pointer-swapping (vs inline patching) is
//! arch-independent, so the same code covers x64 and ARM64.
//!
//! Each hook tail-calls the original and reports the path over the pipe.

#![cfg(windows)]
#![allow(non_snake_case)]

// 64-bit only: the IAT walk uses the *64 PE structures (IMAGE_NT_HEADERS64,
// IMAGE_THUNK_DATA64, IMAGE_ORDINAL_FLAG64). Both shipped Windows targets
// (x86_64, aarch64) are 64-bit — fail fast rather than miscompile if a 32-bit
// target is ever added.
#[cfg(not(target_pointer_width = "64"))]
compile_error!("fspy_windows: only 64-bit Windows targets are supported (the IAT walk uses IMAGE_*64 structures)");

use core::ffi::c_void;
use std::sync::atomic::{AtomicUsize, Ordering};

use windows_sys::Win32::Foundation::{HANDLE, HMODULE};
use windows_sys::Win32::System::Diagnostics::Debug::{IMAGE_DIRECTORY_ENTRY_IMPORT, IMAGE_NT_HEADERS64};
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
use windows_sys::Win32::System::Memory::{VirtualProtect, PAGE_PROTECTION_FLAGS, PAGE_READWRITE};
use windows_sys::Win32::System::ProcessStatus::EnumProcessModules;
use windows_sys::Win32::System::SystemServices::{
    IMAGE_DOS_HEADER, IMAGE_DOS_SIGNATURE, IMAGE_IMPORT_BY_NAME, IMAGE_IMPORT_DESCRIPTOR, IMAGE_ORDINAL_FLAG64,
};
use windows_sys::Win32::System::Threading::GetCurrentProcess;
use windows_sys::Win32::System::WindowsProgramming::IMAGE_THUNK_DATA64;

use crate::mode;
use crate::path::normalize_win;
use crate::pipe;

// Original function pointers, stored as usize. Loaded + transmuted in the hooks.
static ORIG_CREATE_FILE_W: AtomicUsize = AtomicUsize::new(0);
static ORIG_CREATE_FILE_A: AtomicUsize = AtomicUsize::new(0);
static ORIG_DELETE_FILE_W: AtomicUsize = AtomicUsize::new(0);
static ORIG_GET_FILE_ATTRS_EX_W: AtomicUsize = AtomicUsize::new(0);
static ORIG_GET_FILE_ATTRS_W: AtomicUsize = AtomicUsize::new(0);
static ORIG_FIND_FIRST_FILE_W: AtomicUsize = AtomicUsize::new(0);
static ORIG_FIND_FIRST_FILE_EX_W: AtomicUsize = AtomicUsize::new(0);
static ORIG_MOVE_FILE_EX_W: AtomicUsize = AtomicUsize::new(0);

/// Our own DLL's base address — skipped when walking modules so we never hook
/// our own pipe-IPC file calls (avoids self-reporting + re-entrancy).
static SELF_BASE: AtomicUsize = AtomicUsize::new(0);

/// Record this DLL's module base so [`install_all`] can skip it. Called from
/// `DllMain` with the `hinstDLL` the loader passes.
pub fn set_self_base(base: usize) {
    SELF_BASE.store(base, Ordering::Relaxed);
}

type CreateFileWFn = unsafe extern "system" fn(*const u16, u32, u32, *const c_void, u32, u32, HANDLE) -> HANDLE;
type CreateFileAFn = unsafe extern "system" fn(*const u8, u32, u32, *const c_void, u32, u32, HANDLE) -> HANDLE;
type DeleteFileWFn = unsafe extern "system" fn(*const u16) -> i32;
type GetFileAttrsExWFn = unsafe extern "system" fn(*const u16, i32, *mut c_void) -> i32;
type GetFileAttrsWFn = unsafe extern "system" fn(*const u16) -> u32;
type FindFirstFileWFn = unsafe extern "system" fn(*const u16, *mut c_void) -> HANDLE;
type FindFirstFileExWFn = unsafe extern "system" fn(*const u16, i32, *mut c_void, i32, *const c_void, u32) -> HANDLE;
type MoveFileExWFn = unsafe extern "system" fn(*const u16, *const u16, u32) -> i32;

// Win32 access flags implying write intent.
const GENERIC_WRITE: u32 = 0x4000_0000;
const FILE_WRITE_DATA: u32 = 0x0002;
const FILE_APPEND_DATA: u32 = 0x0004;

fn classify(access: u32) -> u8 {
    if access & (GENERIC_WRITE | FILE_WRITE_DATA | FILE_APPEND_DATA) != 0 {
        mode::WRITE
    } else {
        mode::READ
    }
}

fn report_w(path: *const u16, kind: u8) {
    if path.is_null() {
        return;
    }

    // Read the NUL-terminated UTF-16 string.
    let mut len = 0usize;
    unsafe {
        while *path.add(len) != 0 {
            len += 1;
        }
    }
    let slice = unsafe { std::slice::from_raw_parts(path, len) };
    let s = String::from_utf16_lossy(slice);

    pipe::send(kind, &normalize_win(&s));
}

fn report_a(path: *const u8, kind: u8) {
    if path.is_null() {
        return;
    }

    let mut len = 0usize;
    unsafe {
        while *path.add(len) != 0 {
            len += 1;
        }
    }
    let slice = unsafe { std::slice::from_raw_parts(path, len) };
    let s = String::from_utf8_lossy(slice).into_owned();

    pipe::send(kind, &normalize_win(&s));
}

unsafe extern "system" fn hook_CreateFileW(
    name: *const u16,
    access: u32,
    share: u32,
    sa: *const c_void,
    disposition: u32,
    flags: u32,
    template: HANDLE,
) -> HANDLE {
    let orig: CreateFileWFn = std::mem::transmute(ORIG_CREATE_FILE_W.load(Ordering::Relaxed));
    let result = orig(name, access, share, sa, disposition, flags, template);
    report_w(name, classify(access));
    result
}

unsafe extern "system" fn hook_CreateFileA(
    name: *const u8,
    access: u32,
    share: u32,
    sa: *const c_void,
    disposition: u32,
    flags: u32,
    template: HANDLE,
) -> HANDLE {
    let orig: CreateFileAFn = std::mem::transmute(ORIG_CREATE_FILE_A.load(Ordering::Relaxed));
    let result = orig(name, access, share, sa, disposition, flags, template);
    report_a(name, classify(access));
    result
}

unsafe extern "system" fn hook_DeleteFileW(name: *const u16) -> i32 {
    let orig: DeleteFileWFn = std::mem::transmute(ORIG_DELETE_FILE_W.load(Ordering::Relaxed));
    let result = orig(name);
    report_w(name, mode::WRITE);
    result
}

unsafe extern "system" fn hook_GetFileAttributesExW(name: *const u16, level: i32, info: *mut c_void) -> i32 {
    let orig: GetFileAttrsExWFn = std::mem::transmute(ORIG_GET_FILE_ATTRS_EX_W.load(Ordering::Relaxed));
    let result = orig(name, level, info);
    report_w(name, mode::STAT);
    result
}

unsafe extern "system" fn hook_GetFileAttributesW(name: *const u16) -> u32 {
    let orig: GetFileAttrsWFn = std::mem::transmute(ORIG_GET_FILE_ATTRS_W.load(Ordering::Relaxed));
    let result = orig(name);
    report_w(name, mode::STAT);
    result
}

unsafe extern "system" fn hook_FindFirstFileW(name: *const u16, data: *mut c_void) -> HANDLE {
    let orig: FindFirstFileWFn = std::mem::transmute(ORIG_FIND_FIRST_FILE_W.load(Ordering::Relaxed));
    let result = orig(name, data);
    report_w(name, mode::READDIR);
    result
}

unsafe extern "system" fn hook_FindFirstFileExW(
    name: *const u16,
    level: i32,
    data: *mut c_void,
    search_op: i32,
    filter: *const c_void,
    flags: u32,
) -> HANDLE {
    let orig: FindFirstFileExWFn = std::mem::transmute(ORIG_FIND_FIRST_FILE_EX_W.load(Ordering::Relaxed));
    let result = orig(name, level, data, search_op, filter, flags);
    report_w(name, mode::READDIR);
    result
}

unsafe extern "system" fn hook_MoveFileExW(existing: *const u16, new: *const u16, flags: u32) -> i32 {
    let orig: MoveFileExWFn = std::mem::transmute(ORIG_MOVE_FILE_EX_W.load(Ordering::Relaxed));
    let result = orig(existing, new, flags);
    // Both source and destination are mutated; `new` may be null (a pure delete
    // via MOVEFILE flags), which `report_w` ignores.
    report_w(existing, mode::WRITE);
    report_w(new, mode::WRITE);
    result
}

/// One (imported-name, hook, original-slot) row in the hook table.
struct HookEntry {
    name: &'static [u8],
    hook: *const c_void,
    orig: &'static AtomicUsize,
}

// SAFETY: only static fn pointers + static refs; read-only after init.
unsafe impl Sync for HookEntry {}

fn table() -> [HookEntry; 8] {
    [
        HookEntry { name: b"CreateFileW", hook: hook_CreateFileW as *const c_void, orig: &ORIG_CREATE_FILE_W },
        HookEntry { name: b"CreateFileA", hook: hook_CreateFileA as *const c_void, orig: &ORIG_CREATE_FILE_A },
        HookEntry { name: b"DeleteFileW", hook: hook_DeleteFileW as *const c_void, orig: &ORIG_DELETE_FILE_W },
        HookEntry {
            name: b"GetFileAttributesExW",
            hook: hook_GetFileAttributesExW as *const c_void,
            orig: &ORIG_GET_FILE_ATTRS_EX_W,
        },
        HookEntry {
            name: b"GetFileAttributesW",
            hook: hook_GetFileAttributesW as *const c_void,
            orig: &ORIG_GET_FILE_ATTRS_W,
        },
        HookEntry {
            name: b"FindFirstFileW",
            hook: hook_FindFirstFileW as *const c_void,
            orig: &ORIG_FIND_FIRST_FILE_W,
        },
        HookEntry {
            name: b"FindFirstFileExW",
            hook: hook_FindFirstFileExW as *const c_void,
            orig: &ORIG_FIND_FIRST_FILE_EX_W,
        },
        HookEntry { name: b"MoveFileExW", hook: hook_MoveFileExW as *const c_void, orig: &ORIG_MOVE_FILE_EX_W },
    ]
}

/// Compare a NUL-terminated C string to a byte slice (exact match).
unsafe fn c_str_eq(ptr: *const u8, want: &[u8]) -> bool {
    for (i, &w) in want.iter().enumerate() {
        if *ptr.add(i) != w {
            return false;
        }
    }
    *ptr.add(want.len()) == 0
}

/// Patch one module's IAT for every entry in [`table`]. Returns the number of
/// IAT slots swapped in this module.
fn install_in_module(base: *const u8) -> usize {
    let entries = table();
    let mut hooked = 0;

    unsafe {
        if base.is_null() {
            return 0;
        }

        let dos = base as *const IMAGE_DOS_HEADER;
        if (*dos).e_magic != IMAGE_DOS_SIGNATURE {
            return 0;
        }

        let nt = base.add((*dos).e_lfanew as usize) as *const IMAGE_NT_HEADERS64;
        let import_dir = (*nt).OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_IMPORT as usize];
        if import_dir.VirtualAddress == 0 {
            return 0;
        }

        let mut descriptor = base.add(import_dir.VirtualAddress as usize) as *const IMAGE_IMPORT_DESCRIPTOR;

        while (*descriptor).Name != 0 {
            // INT (names) — `OriginalFirstThunk`; IAT (pointers) — `FirstThunk`.
            let int_rva = (*descriptor).Anonymous.OriginalFirstThunk;
            let iat_rva = (*descriptor).FirstThunk;

            // Some toolchains zero the INT; fall back to the IAT for names.
            let names_rva = if int_rva != 0 { int_rva } else { iat_rva };

            let mut name_thunk = base.add(names_rva as usize) as *const IMAGE_THUNK_DATA64;
            let mut iat_thunk = base.add(iat_rva as usize) as *mut IMAGE_THUNK_DATA64;

            while (*name_thunk).u1.AddressOfData != 0 {
                let ordinal = (*name_thunk).u1.Ordinal;

                // Skip imports-by-ordinal (no name to match).
                if ordinal & IMAGE_ORDINAL_FLAG64 == 0 {
                    let by_name = base.add((*name_thunk).u1.AddressOfData as usize) as *const IMAGE_IMPORT_BY_NAME;
                    // `Name` is `[CHAR; 1]` (i8); compare as bytes.
                    let fn_name = (*by_name).Name.as_ptr() as *const u8;

                    for entry in &entries {
                        if c_str_eq(fn_name, entry.name) {
                            let slot = &mut (*iat_thunk).u1.Function;
                            let original = *slot;

                            let mut old: PAGE_PROTECTION_FLAGS = 0;
                            let cell = slot as *mut u64 as *mut c_void;
                            if VirtualProtect(cell, std::mem::size_of::<usize>(), PAGE_READWRITE, &mut old) != 0 {
                                if entry.orig.load(Ordering::Relaxed) == 0 {
                                    entry.orig.store(original as usize, Ordering::Relaxed);
                                }
                                *slot = entry.hook as usize as u64;
                                let mut restore: PAGE_PROTECTION_FLAGS = 0;
                                VirtualProtect(cell, std::mem::size_of::<usize>(), old, &mut restore);
                                hooked += 1;
                            }
                        }
                    }
                }

                name_thunk = name_thunk.add(1);
                iat_thunk = iat_thunk.add(1);
            }

            descriptor = descriptor.add(1);
        }
    }

    hooked
}

/// Install hooks across **every** currently-loaded module's IAT — not just the
/// main executable — so file calls made from other DLLs (the CRT, addon
/// `.node`s, etc.) are caught too. The first module to be patched records the
/// real function pointer; later modules reuse it (same import target). Our own
/// DLL is skipped so we never hook our pipe IPC. Returns the total slots
/// swapped. Falls back to the main module if enumeration fails.
pub fn install_all() -> usize {
    let self_base = SELF_BASE.load(Ordering::Relaxed);

    unsafe {
        let process = GetCurrentProcess();

        // First call sizes the module array; second fills it.
        let mut needed: u32 = 0;
        let ok = EnumProcessModules(process, std::ptr::null_mut(), 0, &mut needed) != 0;

        if !ok || needed == 0 {
            let base = GetModuleHandleW(std::ptr::null()) as *const u8;
            return install_in_module(base);
        }

        let count = needed as usize / std::mem::size_of::<HMODULE>();
        let mut modules: Vec<HMODULE> = vec![std::ptr::null_mut(); count];
        let mut written: u32 = 0;

        if EnumProcessModules(process, modules.as_mut_ptr(), needed, &mut written) == 0 {
            let base = GetModuleHandleW(std::ptr::null()) as *const u8;
            return install_in_module(base);
        }

        let actual = (written as usize / std::mem::size_of::<HMODULE>()).min(count);
        let mut hooked = 0;

        for &module in &modules[..actual] {
            if module.is_null() || module as usize == self_base {
                continue;
            }

            hooked += install_in_module(module as *const u8);
        }

        hooked
    }
}
