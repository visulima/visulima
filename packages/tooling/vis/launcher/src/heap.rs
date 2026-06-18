//! Native V8 heap-flag computation, mirroring cerebro's `applyHeapTuning`.
//!
//! cerebro normally re-execs Node with `--max-old-space-size` /
//! `--max-semi-space-size` (~290 ms, a full extra process boot). The launcher
//! computes the same flags here and passes them on the *first* Node spawn, then
//! sets `VIS_HEAP_TUNED=1` so the JS side skips its re-exec — heap tuned once,
//! no second boot.
//!
//! Heuristic (kept in lockstep with `heap-tuning.ts`):
//!   - old space  = floor(totalRAM_MiB * 0.75)
//!   - semi space = tiered (4/8/16/32/64 MiB up to 8 GiB; floor(log2(old))*8 above)
//!
//! RAM detection is Unix-only for now (`sysconf`, covers macOS + Linux). On
//! platforms where total RAM can't be read, `flags()` returns `None` and the
//! caller leaves heap tuning to the JS side (correct, just not native yet).

/// Total physical RAM in bytes, or `None` if it can't be determined.
#[cfg(unix)]
fn total_mem_bytes() -> Option<u64> {
    // sysconf(_SC_PHYS_PAGES) * sysconf(_SC_PAGE_SIZE). Both are POSIX and present
    // on macOS and Linux; a non-positive return means "unknown" → None.
    // SAFETY: sysconf takes an int and returns a long; no pointers, no state.
    let pages = unsafe { libc::sysconf(libc::_SC_PHYS_PAGES) };
    let page_size = unsafe { libc::sysconf(libc::_SC_PAGE_SIZE) };

    if pages > 0 && page_size > 0 {
        Some(pages as u64 * page_size as u64)
    } else {
        None
    }
}

#[cfg(not(unix))]
fn total_mem_bytes() -> Option<u64> {
    // TODO(launcher): native Windows RAM via GlobalMemoryStatusEx so Windows also
    // skips the JS re-exec. Until then, returning None delegates to JS tuning.
    None
}

/// Semi-space size (MiB) for a given old-space size (MiB). Mirrors the tier table
/// in `heap-tuning.ts` exactly.
fn semi_space_mib(old_space_mib: u64) -> u64 {
    match old_space_mib {
        0..=512 => 4,
        513..=1024 => 8,
        1025..=2048 => 16,
        2049..=4096 => 32,
        4097..=8192 => 64,
        // floor(log2(old)) * 8 — integer log2 via leading zeros.
        _ => (63 - old_space_mib.leading_zeros() as u64) * 8,
    }
}

/// Computed `(max-old-space-size, max-semi-space-size)` in MiB, or `None` when RAM
/// is undetectable (caller should then leave tuning to the JS side).
pub fn flags() -> Option<(u64, u64)> {
    let total_mib = total_mem_bytes()? / 1024 / 1024;
    let old_space = (total_mib as f64 * 0.75).floor() as u64;

    if old_space == 0 {
        return None;
    }

    Some((old_space, semi_space_mib(old_space)))
}

#[cfg(test)]
mod tests {
    use super::semi_space_mib;

    #[test]
    fn semi_space_tiers_match_js() {
        assert_eq!(semi_space_mib(256), 4);
        assert_eq!(semi_space_mib(512), 4);
        assert_eq!(semi_space_mib(1024), 8);
        assert_eq!(semi_space_mib(2048), 16);
        assert_eq!(semi_space_mib(4096), 32);
        assert_eq!(semi_space_mib(8192), 64);
        // 16384 MiB → floor(log2(16384)) * 8 = 14 * 8 = 112
        assert_eq!(semi_space_mib(16384), 112);
        // 12288 MiB → floor(log2(12288)) = 13 → 104
        assert_eq!(semi_space_mib(12288), 104);
    }
}
