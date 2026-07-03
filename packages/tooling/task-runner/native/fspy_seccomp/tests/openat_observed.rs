//! End-to-end smoke test for the helper-binary + listener
//! architecture. Spawns `cat` against a real file via the helper,
//! verifies the supervisor observed at least one `openat` AND
//! resolved its path string from the child's address space.
//!
//! Runs as a Cargo integration test (`tests/` is one binary per
//! file, separate from the lib's test threads).

#![cfg(target_os = "linux")]

use std::path::PathBuf;

use fspy_seccomp::{track_command, AccessKind, SpawnOptions};

/// Locate the helper binary that Cargo built alongside this test.
/// `CARGO_BIN_EXE_<name>` is the official mechanism — populated by
/// Cargo when running tests so a test can invoke a sibling bin
/// without hardcoding a target path.
fn helper_path() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_fspy-seccomp-helper"))
}

#[test]
fn observes_openat_from_cat() {
    // Use a temp file we create ourselves rather than a host file
    // like `/etc/hostname` — the latter isn't guaranteed present on
    // every valid Linux environment, which would fail the test even
    // when tracking is correct. `cat` is resolved via PATH by the
    // helper's execvp (works on both FHS and busybox layouts).
    let target = std::env::temp_dir().join(format!("fspy-openat-{}.txt", std::process::id()));
    std::fs::write(&target, b"hello").expect("write tmp file");

    let result = track_command(
        &["cat".to_string(), target.to_string_lossy().into_owned()],
        &helper_path(),
        &SpawnOptions::default(),
        None,
    )
    .expect("track_command should succeed on this Linux host");

    let _ = std::fs::remove_file(&target);

    assert_eq!(
        result.exit_code,
        0,
        "cat <tmpfile> should exit 0, got {} (accesses captured: {})",
        result.exit_code,
        result.accesses.len(),
    );

    let reads: Vec<_> = result.accesses.iter().filter(|a| a.kind == AccessKind::Read).collect();

    assert!(!reads.is_empty(), "expected at least one Read access, got {} accesses total", result.accesses.len(),);

    // Path-resolution check: the child opened our temp file
    // explicitly. After process_vm_readv it should appear verbatim
    // in the observed accesses.
    let saw_target = result.accesses.iter().any(|a| a.path == target);

    assert!(
        saw_target,
        "expected {} in resolved accesses, got: {:?}",
        target.display(),
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
        &["sh".to_string(), "-c".to_string(), format!("cd {} && cat data.txt", tmpdir.display())],
        &helper_path(),
        &SpawnOptions::default(),
        None,
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
