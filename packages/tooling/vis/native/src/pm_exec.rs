use napi_derive::napi;
use std::process::Command;

#[napi(object)]
pub struct ExecResult {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

/// Executes a package manager command synchronously.
/// Uses Rust's std::process::Command for maximum performance.
#[napi]
pub fn exec_pm_command(bin: String, args: Vec<String>, cwd: String) -> ExecResult {
    let result = Command::new(&bin)
        .args(&args)
        .current_dir(&cwd)
        .output();

    match result {
        Ok(output) => ExecResult {
            code: output.status.code().unwrap_or(1),
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        },
        Err(e) => ExecResult {
            code: 127,
            stdout: String::new(),
            stderr: format!("Failed to execute '{}': {}", bin, e),
        },
    }
}

/// Executes a package manager command with inherited stdio (interactive).
/// Returns exit code only.
#[napi]
pub fn exec_pm_command_interactive(bin: String, args: Vec<String>, cwd: String) -> i32 {
    let result = Command::new(&bin)
        .args(&args)
        .current_dir(&cwd)
        .stdin(std::process::Stdio::inherit())
        .stdout(std::process::Stdio::inherit())
        .stderr(std::process::Stdio::inherit())
        .status();

    match result {
        Ok(status) => status.code().unwrap_or(1),
        Err(_) => 127,
    }
}

/// Finds the full path to a binary using `which`-style lookup.
#[napi]
pub fn which_bin(name: String) -> Option<String> {
    which::which(&name)
        .ok()
        .map(|p| p.to_string_lossy().into_owned())
}
