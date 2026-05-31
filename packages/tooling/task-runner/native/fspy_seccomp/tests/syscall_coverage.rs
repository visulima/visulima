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
