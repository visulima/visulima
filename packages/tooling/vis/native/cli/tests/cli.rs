//! Integration tests for the `vis` CLI front-end binary.
//!
//! These drive the compiled binary (`CARGO_BIN_EXE_vis`, injected by Cargo) and
//! assert the hermetic, cross-platform legs of the dispatch shell: native output
//! and the two delegation failure modes. The happy-path delegation (argv
//! passthrough + exit-code forwarding through a real Node) is covered by the
//! vitest integration test, which has Node available.

use std::process::Command;

fn binary() -> Command {
    Command::new(env!("CARGO_BIN_EXE_vis"))
}

#[test]
fn native_info_prints_diagnostics_and_injected_version() {
    let output = binary().arg("__native-info").env("VIS_VERSION", "9.9.9-test").output().expect("run binary");

    assert!(output.status.success(), "expected exit 0, got {:?}", output.status);

    let stdout = String::from_utf8_lossy(&output.stdout);

    assert!(stdout.contains("vis native front-end"), "stdout was: {stdout}");
    assert!(stdout.contains("9.9.9-test"), "injected VIS_VERSION missing: {stdout}");
}

#[test]
fn version_prints_bare_injected_semver() {
    let output = binary().arg("--version").env("VIS_VERSION", "1.2.3-alpha.7").output().expect("run binary");

    assert!(output.status.success());
    assert_eq!(String::from_utf8_lossy(&output.stdout), "1.2.3-alpha.7\n");
}

#[test]
fn pm_shim_rejects_unknown_shim() {
    let output = binary().args(["__pm-shim", "bogus", "install"]).output().expect("run binary");

    assert_eq!(output.status.code(), Some(1));
    assert!(String::from_utf8_lossy(&output.stderr).contains("is not a known package-manager shim"));
}

#[test]
fn pm_shim_refuses_top_level_mismatch() {
    // A throwaway project pinned to pnpm via its lockfile; invoking the `npm`
    // shim there must be refused. Cleared PM env vars so the run is not "nested".
    let directory = std::env::temp_dir().join(format!("vis-pmshim-{}", std::process::id()));
    std::fs::create_dir_all(&directory).expect("mkdir");
    std::fs::write(directory.join("pnpm-lock.yaml"), "lockfileVersion: 9\n").expect("write lock");

    let output = binary()
        .args(["__pm-shim", "npm", "install"])
        .current_dir(&directory)
        .env_remove("npm_config_user_agent")
        .env_remove("npm_execpath")
        .output()
        .expect("run binary");

    std::fs::remove_dir_all(&directory).ok();

    assert_eq!(output.status.code(), Some(1));
    assert!(String::from_utf8_lossy(&output.stderr).contains("this project uses pnpm"));
}

#[cfg(unix)]
#[test]
fn exec_resolves_and_runs_via_detected_pm() {
    use std::os::unix::fs::PermissionsExt;

    // A throwaway project pinned to pnpm (lockfile) + a stub `pnpm` on PATH that
    // echoes its argv, so we can assert the resolved invocation end to end.
    let base = std::env::temp_dir().join(format!("vis-exec-{}", std::process::id()));
    let project = base.join("project");
    let bindir = base.join("bin");
    std::fs::create_dir_all(&project).unwrap();
    std::fs::create_dir_all(&bindir).unwrap();
    std::fs::write(project.join("pnpm-lock.yaml"), "lockfileVersion: 9\n").unwrap();

    let stub = bindir.join("pnpm");
    std::fs::write(&stub, "#!/bin/sh\necho \"PNPM:$*\"\n").unwrap();
    std::fs::set_permissions(&stub, std::fs::Permissions::from_mode(0o755)).unwrap();

    let path = format!("{}:{}", bindir.display(), std::env::var("PATH").unwrap_or_default());

    // Tool flags after the command are forwarded to the tool (verified to match
    // the fixed Node handler). resolve_exec maps pnpm -> `exec <command> <args>`.
    let output = binary()
        .args(["exec", "eslint", "--fix"])
        .current_dir(&project)
        .env("PATH", path)
        .env_remove("npm_config_user_agent")
        .env_remove("VIS_RUNTIME")
        .output()
        .expect("run binary");

    std::fs::remove_dir_all(&base).ok();

    assert!(output.status.success(), "exec failed: {:?}", output);
    assert_eq!(String::from_utf8_lossy(&output.stdout).trim(), "PNPM:exec eslint --fix");
}

#[test]
fn delegate_without_fallback_entry_exits_ex_software() {
    let output = binary().arg("run").env_remove("VIS_FALLBACK_ENTRY").output().expect("run binary");

    assert_eq!(output.status.code(), Some(70));

    let stderr = String::from_utf8_lossy(&output.stderr);

    assert!(stderr.contains("VIS_FALLBACK_ENTRY"), "stderr was: {stderr}");
}

#[test]
fn delegate_with_unlaunchable_node_exits_ex_software() {
    let output = binary()
        .arg("run")
        .env("VIS_FALLBACK_ENTRY", "/some/entry.js")
        .env("VIS_NODE", "/nonexistent/definitely/not/node")
        .output()
        .expect("run binary");

    assert_eq!(output.status.code(), Some(70));

    let stderr = String::from_utf8_lossy(&output.stderr);

    assert!(stderr.contains("failed to launch Node CLI"), "stderr was: {stderr}");
}
