//! Native package-manager detection + exec/dlx command building, in Rust.
//!
//! The hybrid CLI's fast path: `vis exec` / `vis dlx` are pure child-dispatchers
//! (resolve a binary, spawn it) — `securityEnforcementPlugin` gates only the
//! install/PM verbs, not these — so the launcher handles them WITHOUT booting the
//! Node CLI or the napi addon. It detects the PM by walking up for a lockfile
//! (mirroring the JS `pm-runner` table) and builds that PM's exec/dlx argv.

use std::path::Path;

/// Package managers the launcher's fast path understands.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Pm {
    Bun,
    Npm,
    Pnpm,
    Yarn,
}

impl Pm {
    fn bin(self) -> &'static str {
        match self {
            Pm::Bun => "bun",
            Pm::Npm => "npm",
            Pm::Pnpm => "pnpm",
            Pm::Yarn => "yarn",
        }
    }
}

/// Walk up from `cwd` looking for a lockfile. Mirrors pm-runner's table; defaults
/// to npm when none is found (matches `detectPm`'s conservative fallback).
pub fn detect(cwd: &Path) -> Pm {
    // (filename, pm) in priority order, same as pm-runner's findNonAubeLockfile.
    const LOCKFILES: &[(&str, Pm)] = &[
        ("pnpm-lock.yaml", Pm::Pnpm),
        ("bun.lock", Pm::Bun),
        ("bun.lockb", Pm::Bun),
        ("yarn.lock", Pm::Yarn),
        ("package-lock.json", Pm::Npm),
        ("npm-shrinkwrap.json", Pm::Npm),
    ];

    let mut dir = cwd;

    loop {
        for (file, pm) in LOCKFILES {
            if dir.join(file).is_file() {
                return *pm;
            }
        }

        match dir.parent() {
            Some(parent) if parent != dir => dir = parent,
            _ => return Pm::Npm,
        }
    }
}

/// Build the argv (after the pm binary) to run a locally-installed bin: the
/// `vis exec <bin> [args]` path → `<pm> exec <bin> [args]` (bun: `x`).
pub fn exec_args(pm: Pm, rest: &[String]) -> Vec<String> {
    match pm {
        Pm::Bun => prepend("x", rest),
        // npm needs `--` so flags after the bin go to the bin, not npm.
        Pm::Npm => {
            let mut argv = vec!["exec".to_owned(), "--".to_owned()];
            argv.extend_from_slice(rest);
            argv
        }
        Pm::Pnpm | Pm::Yarn => prepend("exec", rest),
    }
}

/// Build the argv to run a remote package: `vis dlx <pkg> [args]` →
/// `<pm> dlx <pkg>` (bun: `x`, npm: `exec`).
pub fn dlx_args(pm: Pm, rest: &[String]) -> Vec<String> {
    match pm {
        Pm::Bun => prepend("x", rest),
        Pm::Npm => prepend("exec", rest),
        Pm::Pnpm | Pm::Yarn => prepend("dlx", rest),
    }
}

pub fn binary(pm: Pm) -> &'static str {
    pm.bin()
}

fn prepend(verb: &str, rest: &[String]) -> Vec<String> {
    let mut argv = vec![verb.to_owned()];
    argv.extend_from_slice(rest);
    argv
}
