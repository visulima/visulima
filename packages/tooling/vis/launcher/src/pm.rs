//! Native package-manager detection + exec/dlx command building, in Rust.
//!
//! The hybrid CLI's fast path: `vis exec` / `vis dlx` are pure child-dispatchers
//! (resolve a binary, spawn it) — `securityEnforcementPlugin` gates only the
//! install/PM verbs, not these — so the launcher handles them WITHOUT booting the
//! Node CLI or the napi addon. It detects the PM by walking up for a lockfile
//! (mirroring the JS `pm-runner` table) and builds that PM's exec/dlx argv.

use std::path::Path;

/// Package managers the launcher's fast path understands.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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
/// Detect the PM from the nearest lockfile, or `None` if none is found — the shim
/// agreement check needs to tell "no pin" (no opinion) apart from "npm".
pub fn detect_opt(cwd: &Path) -> Option<Pm> {
    // (filename, pm) in priority order — MUST match pm-runner.ts's
    // `findNonAubeLockfile` table (src/pm/pm-runner.ts) exactly, so the native
    // fast path and the JS path pick the same PM in a repo that carries more than
    // one lockfile (a migration artifact, but a real divergence if the orders
    // disagree). Order there: pnpm, yarn, npm (package-lock then shrinkwrap), bun.
    const LOCKFILES: &[(&str, Pm)] = &[
        ("pnpm-lock.yaml", Pm::Pnpm),
        ("yarn.lock", Pm::Yarn),
        ("package-lock.json", Pm::Npm),
        ("npm-shrinkwrap.json", Pm::Npm),
        ("bun.lock", Pm::Bun),
        ("bun.lockb", Pm::Bun),
    ];

    let mut dir = cwd;

    loop {
        for (file, pm) in LOCKFILES {
            if dir.join(file).is_file() {
                return Some(*pm);
            }
        }

        match dir.parent() {
            Some(parent) if parent != dir => dir = parent,
            _ => return None,
        }
    }
}

/// Detect the PM for the exec/dlx fast path, defaulting to npm when no lockfile is
/// found (matches `detectPm`'s conservative fallback).
pub fn detect(cwd: &Path) -> Pm {
    detect_opt(cwd).unwrap_or(Pm::Npm)
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

/// Build the argv to run a remote package: `vis dlx <pkg> [args]`. `rest[0]` is the
/// package (possibly version-specced/scoped), `rest[1..]` its args.
///
/// npm needs the full non-interactive shape `exec --yes --package=<pkg> -- <bin>
/// [args]` (mirrors `resolve_dlx` in native/src/pm_resolve.rs): without `--yes` npm
/// prompts (breaking CI), and without `--package=…/-- <bin>` npm treats a
/// version-specced/scoped token as the bin name and fails. pnpm/yarn `dlx <pkg>`
/// and bun `x <pkg>` take the package directly.
pub fn dlx_args(pm: Pm, rest: &[String]) -> Vec<String> {
    match pm {
        Pm::Bun => prepend("x", rest),
        Pm::Npm => {
            let Some((package, args)) = rest.split_first() else {
                return vec!["exec".to_owned(), "--yes".to_owned()];
            };

            let mut argv = vec![
                "exec".to_owned(),
                "--yes".to_owned(),
                format!("--package={package}"),
                "--".to_owned(),
                npm_dlx_bin(package).to_owned(),
            ];

            argv.extend_from_slice(args);
            argv
        }
        Pm::Pnpm | Pm::Yarn => prepend("dlx", rest),
    }
}

/// The bin name npm should run for a dlx package spec: strip a leading scope
/// (`@scope/`) then a trailing `@version`. `cowsay` → `cowsay`, `cowsay@1.2` →
/// `cowsay`, `@scope/pkg@1.0` → `pkg`.
fn npm_dlx_bin(package: &str) -> &str {
    let after_scope = match package.strip_prefix('@').and_then(|rest| rest.split_once('/')) {
        Some((_scope, name_version)) => name_version,
        None => package,
    };

    after_scope.split('@').next().unwrap_or(after_scope)
}

pub fn binary(pm: Pm) -> &'static str {
    pm.bin()
}

fn prepend(verb: &str, rest: &[String]) -> Vec<String> {
    let mut argv = vec![verb.to_owned()];
    argv.extend_from_slice(rest);
    argv
}

#[cfg(test)]
mod tests {
    use super::{dlx_args, npm_dlx_bin, Pm};

    fn v(items: &[&str]) -> Vec<String> {
        items.iter().map(|s| (*s).to_owned()).collect()
    }

    #[test]
    fn npm_dlx_bin_strips_scope_and_version() {
        assert_eq!(npm_dlx_bin("cowsay"), "cowsay");
        assert_eq!(npm_dlx_bin("cowsay@1.2.0"), "cowsay");
        assert_eq!(npm_dlx_bin("@scope/pkg@1.0"), "pkg");
        assert_eq!(npm_dlx_bin("@scope/pkg"), "pkg");
    }

    #[test]
    fn npm_dlx_is_non_interactive_with_explicit_bin() {
        // `vis dlx cowsay@1.2 hi` → npm exec --yes --package=cowsay@1.2 -- cowsay hi
        assert_eq!(
            dlx_args(Pm::Npm, &v(&["cowsay@1.2", "hi"])),
            v(&["exec", "--yes", "--package=cowsay@1.2", "--", "cowsay", "hi"]),
        );
    }

    #[test]
    fn pnpm_and_bun_dlx_pass_package_through() {
        assert_eq!(dlx_args(Pm::Pnpm, &v(&["cowsay", "hi"])), v(&["dlx", "cowsay", "hi"]));
        assert_eq!(dlx_args(Pm::Bun, &v(&["cowsay", "hi"])), v(&["x", "cowsay", "hi"]));
    }
}
