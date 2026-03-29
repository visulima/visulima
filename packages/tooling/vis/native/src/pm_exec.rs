use napi_derive::napi;
use std::process::Command;

/// Allowed binaries that can be executed via NAPI.
const ALLOWED_BINS: &[&str] = &[
    "pnpm", "npm", "npx", "yarn", "bun", "bunx",
    "node", "sh", "echo", "curl", "where", "which",
];

fn validate_bin(bin: &str) -> Result<(), String> {
    // Extract the binary name from a full path (e.g., /usr/bin/npm -> npm)
    let name = std::path::Path::new(bin)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(bin);

    if ALLOWED_BINS.contains(&name) {
        Ok(())
    } else {
        Err(format!("Disallowed binary: '{}'. Allowed: {}", bin, ALLOWED_BINS.join(", ")))
    }
}

#[napi(object)]
pub struct ExecResult {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

/// Executes a package manager command synchronously.
/// Uses Rust's std::process::Command for maximum performance.
/// Only allowed binaries can be executed (see ALLOWED_BINS).
#[napi]
pub fn exec_pm_command(bin: String, args: Vec<String>, cwd: String) -> ExecResult {
    if let Err(msg) = validate_bin(&bin) {
        return ExecResult {
            code: 126,
            stdout: String::new(),
            stderr: msg,
        };
    }

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
/// Returns exit code only. Only allowed binaries can be executed.
#[napi]
pub fn exec_pm_command_interactive(bin: String, args: Vec<String>, cwd: String) -> i32 {
    if let Err(msg) = validate_bin(&bin) {
        eprintln!("error: {}", msg);
        return 126;
    }

    let result = Command::new(&bin)
        .args(&args)
        .current_dir(&cwd)
        .stdin(std::process::Stdio::inherit())
        .stdout(std::process::Stdio::inherit())
        .stderr(std::process::Stdio::inherit())
        .status();

    match result {
        Ok(status) => status.code().unwrap_or(1),
        Err(e) => {
            eprintln!("error: Failed to execute '{}': {}", bin, e);
            127
        }
    }
}

/// Finds the full path to a binary using `which`-style lookup.
#[napi]
pub fn which_bin(name: String) -> Option<String> {
    which::which(&name)
        .ok()
        .map(|p| p.to_string_lossy().into_owned())
}
