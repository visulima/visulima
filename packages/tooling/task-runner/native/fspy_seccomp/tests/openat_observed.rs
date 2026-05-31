//! End-to-end smoke test for the helper-binary + listener
//! architecture. Spawns `cat` against a real file via the helper,
//! verifies the supervisor observed at least one `openat` AND
//! resolved its path string from the child's address space.
//!
//! Runs as a Cargo integration test (`tests/` is one binary per
//! file, separate from the lib's test threads).

#![cfg(target_os = "linux")]

use std::path::{Path, PathBuf};

use fspy_seccomp::{AccessKind, SpawnOptions, track_command};

/// Locate the helper binary that Cargo built alongside this test.
/// `CARGO_BIN_EXE_<name>` is the official mechanism — populated by
/// Cargo when running tests so a test can invoke a sibling bin
/// without hardcoding a target path.
fn helper_path() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_fspy-seccomp-helper"))
}

#[test]
fn observes_openat_from_cat() {
    let result = track_command(
        &["/usr/bin/cat".to_string(), "/etc/hostname".to_string()],
        &helper_path(),
        &SpawnOptions::default(),
    )
    .expect("track_command should succeed on this Linux host");

    assert_eq!(
        result.exit_code, 0,
        "cat /etc/hostname should exit 0, got {} (accesses captured: {})",
        result.exit_code,
        result.accesses.len(),
    );

    let reads: Vec<_> = result
        .accesses
        .iter()
        .filter(|a| a.kind == AccessKind::Read)
        .collect();

    assert!(
        !reads.is_empty(),
        "expected at least one Read access, got {} accesses total",
        result.accesses.len(),
    );

    // Path-resolution check: the child opened `/etc/hostname`
    // explicitly. After process_vm_readv it should appear verbatim
    // in the observed accesses.
    let saw_target = result
        .accesses
        .iter()
        .any(|a| a.path == Path::new("/etc/hostname"));

    assert!(
        saw_target,
        "expected /etc/hostname in resolved accesses, got: {:?}",
        result.accesses.iter().map(|a| &a.path).collect::<Vec<_>>(),
    );
}

#[test]
fn relative_path_resolves_via_cwd() {
    let tmpdir = std::env::temp_dir().join(format!("fspy-rel-{}", std::process::id()));
    std::fs::create_dir_all(&tmpdir).expect("mkdir tmpdir");
    let target = tmpdir.join("data.txt");
    std::fs::write(&target, b"hello").expect("write tmp file");

    let result = track_command(
        &[
            "/bin/sh".to_string(),
            "-c".to_string(),
            format!("cd {} && cat data.txt", tmpdir.display()),
        ],
        &helper_path(),
        &SpawnOptions::default(),
    )
    .expect("track_command should succeed");

    let _ = std::fs::remove_dir_all(&tmpdir);

    assert_eq!(result.exit_code, 0, "shell pipeline should exit 0");

    let saw_relative_resolved = result.accesses.iter().any(|a| a.path == target);

    assert!(
        saw_relative_resolved,
        "expected resolved {} in accesses, got: {:?}",
        target.display(),
        result.accesses.iter().map(|a| &a.path).collect::<Vec<_>>(),
    );
}
