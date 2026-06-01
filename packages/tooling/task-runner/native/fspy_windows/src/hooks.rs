//! Name-based IAT hooking for the Win32 file-API surface.
//!
//! We walk the main module's import table and, for every imported function
//! whose name matches one we care about, swap the IAT pointer to our hook and
//! stash the original. Matching by **function name across all import
//! descriptors** (not by DLL name) means API-set forwarders
//! (`api-ms-win-core-file-l1-1-0.dll` etc.) are handled the same as a direct
//! `kernel32.dll` import. Pointer-swapping (vs inline patching) is
//! arch-independent, so the same code covers x64 and ARM64.
//!
//! Each hook tail-calls the original and reports the path over the pipe.

#![cfg(windows)]
#![allow(non_snake_case)]

use core::ffi::c_void;
use std::sync::atomic::{AtomicUsize, Ordering};

use windows_sys::Win32::Foundation::HANDLE;
use windows_sys::Win32::System::Diagnostics::Debug::{IMAGE_DIRECTORY_ENTRY_IMPORT, IMAGE_NT_HEADERS64};
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
use windows_sys::Win32::System::Memory::{VirtualProtect, PAGE_PROTECTION_FLAGS, PAGE_READWRITE};
use windows_sys::Win32::System::SystemServices::{
    IMAGE_DOS_HEADER, IMAGE_DOS_SIGNATURE, IMAGE_IMPORT_BY_NAME, IMAGE_IMPORT_DESCRIPTOR, IMAGE_ORDINAL_FLAG64,
};
use windows_sys::Win32::System::WindowsProgramming::IMAGE_THUNK_DATA64;

use crate::mode;
use crate::path::normalize_win;
use crate::pipe;

// Original function pointers, stored as usize. Loaded + transmuted in the hooks.
static ORIG_CREATE_FILE_W: AtomicUsize = AtomicUsize::new(0);
static ORIG_CREATE_FILE_A: AtomicUsize = AtomicUsize::new(0);
static ORIG_DELETE_FILE_W: AtomicUsize = AtomicUsize::new(0);
static ORIG_GET_FILE_ATTRS_EX_W: AtomicUsize = AtomicUsize::new(0);

type CreateFileWFn = unsafe extern "system" fn(*const u16, u32, u32, *const c_void, u32, u32, HANDLE) -> HANDLE;
type CreateFileAFn = unsafe extern "system" fn(*const u8, u32, u32, *const c_void, u32, u32, HANDLE) -> HANDLE;
type DeleteFileWFn = unsafe extern "system" fn(*const u16) -> i32;
type GetFileAttrsExWFn = unsafe extern "system" fn(*const u16, i32, *mut c_void) -> i32;

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

/// One (imported-name, hook, original-slot) row in the hook table.
struct HookEntry {
    name: &'static [u8],
    hook: *const c_void,
    orig: &'static AtomicUsize,
}

// SAFETY: only static fn pointers + static refs; read-only after init.
unsafe impl Sync for HookEntry {}

fn table() -> [HookEntry; 4] {
    [
        HookEntry { name: b"CreateFileW", hook: hook_CreateFileW as *const c_void, orig: &ORIG_CREATE_FILE_W },
        HookEntry { name: b"CreateFileA", hook: hook_CreateFileA as *const c_void, orig: &ORIG_CREATE_FILE_A },
        HookEntry { name: b"DeleteFileW", hook: hook_DeleteFileW as *const c_void, orig: &ORIG_DELETE_FILE_W },
        HookEntry {
            name: b"GetFileAttributesExW",
            hook: hook_GetFileAttributesExW as *const c_void,
            orig: &ORIG_GET_FILE_ATTRS_EX_W,
        },
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

/// Install every hook by patching the main module's IAT. Returns the number of
/// entries successfully hooked.
pub fn install_all() -> usize {
    let entries = table();
    let mut hooked = 0;

    unsafe {
        let base = GetModuleHandleW(std::ptr::null()) as *const u8;
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
