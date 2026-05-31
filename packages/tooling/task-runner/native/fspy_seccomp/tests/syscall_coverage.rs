//! Step 3 coverage: confirm the expanded syscall table actually
//! decodes the syscalls that real build tools hit — stat-family,
//! unlink, readdir. The supervisor must classify and resolve each
//! correctly through `peer::read_path`.

#![cfg(target_os = "linux")]

use std::fs;
use std::path::PathBuf;

use fspy_seccomp::{AccessKind, SpawnOptions, track_command};

fn helper_path() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_fspy-seccomp-helper"))
}

fn tmpdir(label: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("fspy-{label}-{}", std::process::id()));
    fs::create_dir_all(&dir).expect("mkdir tmpdir");
    dir
}

#[test]
fn unlinkat_records_write_access() {
    let dir = tmpdir("unlink");
    let target = dir.join("delete-me.txt");
    fs::write(&target, b"x").expect("seed file");

    let result = track_command(
        &[
            "/usr/bin/rm".to_string(),
            target.to_string_lossy().into_owned(),
        ],
        &helper_path(),
        &SpawnOptions::default(),
        None,
    )
    .expect("track_command should succeed");

    let _ = fs::remove_dir_all(&dir);

    assert_eq!(result.exit_code, 0, "rm should exit 0");

    let writes: Vec<_> = result
        .accesses
        .iter()
        .filter(|a| a.kind == AccessKind::Write && a.path == target)
        .collect();

    assert!(
        !writes.is_empty(),
        "expected Write access for {}, got: {:?}",
        target.display(),
        result.accesses,
    );
}

#[test]
fn stat_family_records_stat_access() {
    let dir = tmpdir("stat");
    let target = dir.join("probe.txt");
    fs::write(&target, b"x").expect("seed file");

    let result = track_command(
        &[
            "/usr/bin/test".to_string(),
            "-e".to_string(),
            target.to_string_lossy().into_owned(),
        ],
        &helper_path(),
        &SpawnOptions::default(),
        None,
    )
    .expect("track_command should succeed");

    let _ = fs::remove_dir_all(&dir);

    assert_eq!(result.exit_code, 0, "test -e should exit 0");

    let stats: Vec<_> = result
        .accesses
        .iter()
        .filter(|a| a.kind == AccessKind::Stat && a.path == target)
        .collect();

    assert!(
        !stats.is_empty(),
        "expected Stat access for {}, got: {:?}",
        target.display(),
        result.accesses,
    );
}

#[test]
fn forked_descendants_emit_on_root_listener() {
    // Verify the kernel's documented behaviour: a seccomp filter
    // installed with SECCOMP_FILTER_FLAG_NEW_LISTENER produces a
    // notify fd associated with the FILTER, not with the task.
    // Forked descendants inherit the filter and their notifications
    // fire on the same parent listener — `notif.pid` tells us
    // which task. So a single supervisor naturally covers the whole
    // process tree without any per-task fd plumbing.
    //
    // This test makes that explicit by forking three levels deep
    // (sh → sh → sh → cat) and asserting we still see the leaf
    // openat for the target file.
    let dir = tmpdir("fork-tree");
    let target = dir.join("leaf.txt");
    fs::write(&target, b"hello").expect("seed leaf");

    let result = track_command(
        &[
            "/bin/sh".to_string(),
            "-c".to_string(),
            // Two nested `sh -c` invocations before cat — each
            // shell forks to run the next layer.
            format!(
                "sh -c 'sh -c \"cat {}\"'",
                target.display()
            ),
        ],
        &helper_path(),
        &SpawnOptions::default(),
        None,
    )
    .expect("track_command should succeed");

    let _ = fs::remove_dir_all(&dir);

    assert_eq!(result.exit_code, 0, "nested-shell pipeline should exit 0");

    let saw_leaf = result.accesses.iter().any(|a| a.path == target);
    assert!(
        saw_leaf,
        "expected leaf openat for {} to fire on root listener despite 3-deep fork tree, got: {:?}",
        target.display(),
        result.accesses.iter().map(|a| &a.path).collect::<Vec<_>>(),
    );
}

#[test]
fn getdents_records_readdir_against_resolved_path() {
    let dir = tmpdir("readdir");
    fs::write(dir.join("a"), b"").expect("seed a");
    fs::write(dir.join("b"), b"").expect("seed b");

    let result = track_command(
        &[
            "/usr/bin/ls".to_string(),
            dir.to_string_lossy().into_owned(),
        ],
        &helper_path(),
        &SpawnOptions::default(),
        None,
    )
    .expect("track_command should succeed");

    let _ = fs::remove_dir_all(&dir);

    assert_eq!(result.exit_code, 0, "ls should exit 0");

    let readdirs: Vec<_> = result
        .accesses
        .iter()
        .filter(|a| a.kind == AccessKind::ReadDir && a.path == dir)
        .collect();

    assert!(
        !readdirs.is_empty(),
        "expected ReadDir on {}, got: {:?}",
        dir.display(),
        result.accesses,
    );
}
