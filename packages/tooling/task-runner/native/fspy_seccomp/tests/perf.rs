//! Coarse performance baseline: tracked-vs-untracked timing for
//! a workload that does N stat/read syscalls. Establishes that
//! seccomp overhead is bounded and not pathological.
//!
//! `#[ignore]` by default — opt in via `cargo test --test perf
//! --release -- --ignored`. Runs at default verbosity; the
//! reported numbers are best-effort wall-clock (not statistical).

#![cfg(target_os = "linux")]

use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::Instant;

use fspy_seccomp::{track_command, SpawnOptions};

fn helper_path() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_fspy-seccomp-helper"))
}

#[test]
#[ignore = "perf bench; opt in via --ignored"]
fn seccomp_overhead_is_bounded() {
    // Workload: create 500 small files, then `ls -la` + `cat` them
    // through a single shell pipeline. Realistic shape for build
    // tools (lots of stat + small reads).
    let dir = std::env::temp_dir().join(format!("fspy-perf-{}", std::process::id()));
    fs::create_dir_all(&dir).expect("mkdir");

    const N_FILES: usize = 500;
    for i in 0..N_FILES {
        fs::write(dir.join(format!("f{i:04}.txt")), format!("content {i}\n")).expect("seed");
    }

    let cmd_str = format!("ls -la {dir} > /dev/null && cat {dir}/*.txt > /dev/null", dir = dir.display());

    // --- untracked baseline ---
    let untracked_start = Instant::now();
    let untracked_status = Command::new("/bin/sh").args(["-c", &cmd_str]).status().expect("untracked exec");
    let untracked_elapsed = untracked_start.elapsed();
    assert!(untracked_status.success(), "untracked baseline must succeed");

    // --- tracked under seccomp ---
    let tracked_start = Instant::now();
    let tracked_result = track_command(
        &["/bin/sh".to_string(), "-c".to_string(), cmd_str.clone()],
        &helper_path(),
        &SpawnOptions::default(),
        None,
    )
    .expect("tracked exec");
    let tracked_elapsed = tracked_start.elapsed();
    assert_eq!(tracked_result.exit_code, 0, "tracked workload must succeed");

    let _ = fs::remove_dir_all(&dir);

    let overhead_ms =
        tracked_elapsed.as_secs_f64().max(untracked_elapsed.as_secs_f64()) - untracked_elapsed.as_secs_f64();
    let overhead_pct = if untracked_elapsed.as_nanos() > 0 {
        (tracked_elapsed.as_nanos() as f64 / untracked_elapsed.as_nanos() as f64 - 1.0) * 100.0
    } else {
        0.0
    };

    println!(
        "perf: N={N_FILES} files; untracked={untracked:?}; seccomp-tracked={tracked:?}; \
         overhead={overhead_ms:.1}ms ({overhead_pct:+.1}%); accesses_captured={accesses}",
        untracked = untracked_elapsed,
        tracked = tracked_elapsed,
        overhead_ms = overhead_ms * 1000.0,
        accesses = tracked_result.accesses.len(),
    );

    // Sanity bound: tracker shouldn't be more than 10x untracked.
    // Real measurements on this box typically land around 1.2-2x.
    // A 10x ceiling catches regressions (e.g. accidental
    // per-notification heap thrash) without false-flagging on slow
    // shared CI runners.
    assert!(
        tracked_elapsed.as_secs_f64() < untracked_elapsed.as_secs_f64() * 10.0 + 0.5,
        "seccomp tracking overhead too high: {tracked_elapsed:?} vs {untracked_elapsed:?} baseline",
    );

    // Sanity check: we captured at least one access for every file.
    assert!(
        tracked_result.accesses.len() >= N_FILES,
        "expected ≥{N_FILES} accesses (one per file at minimum), got {}",
        tracked_result.accesses.len(),
    );
}
