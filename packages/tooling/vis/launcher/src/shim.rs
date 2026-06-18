//! PM-shim dispatch core — the launcher's argv0 behaviour when it's invoked as a
//! package-manager name (via the opt-in `.vis/shims/<pm>` symlinks `vis shim
//! install` creates). Models nub's design (researched 2026-06-18):
//!
//!   - persistent shims cover the **PM binaries only** (`npm npx pnpm pnpx yarn
//!     yarnpkg`) — never `node` (node routing is ephemeral + run-scoped, separate);
//!   - argv0 decides: invoked as `pnpm`, the binary checks the project's pinned PM
//!     and either runs it, refuses (top-level mismatch), or falls through (nested);
//!   - **transparent verbs** (`init create dlx exec`) and the runner shims
//!     (`npx`/`pnpx`) always pass — `npm create vite` must work in a pnpm repo;
//!   - **nesting** is read from `npm_config_user_agent` (the ecosystem-standard "a
//!     PM is running above me" marker): a mismatch typed at a shell is refused (the
//!     user can fix it); a mismatch from a lifecycle script three layers down falls
//!     through (refusing would break an install they never directly issued).
//!
//! This module is the PURE decision (no fs/exec) so it is fully unit-tested; the
//! shim-dir resolution + exec live in `main.rs`.

use crate::pm::Pm;

/// The PM-shaped binary names the shim dir intercepts. `node`/`vis` are NOT here.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShimName {
    Npm,
    Npx,
    Pnpm,
    Pnpx,
    Yarn,
    Yarnpkg,
}

impl ShimName {
    /// Parse an argv0 file stem (`.exe` already stripped by the caller). `None`
    /// means "not a PM shim name" → the launcher takes its normal `vis` dispatch.
    pub fn parse(stem: &str) -> Option<Self> {
        Some(match stem {
            "npm" => Self::Npm,
            "npx" => Self::Npx,
            "pnpm" => Self::Pnpm,
            "pnpx" => Self::Pnpx,
            "yarn" => Self::Yarn,
            "yarnpkg" => Self::Yarnpkg,
            _ => return None,
        })
    }

    /// The binary name as invoked — what the PATH fall-through searches for.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Npm => "npm",
            Self::Npx => "npx",
            Self::Pnpm => "pnpm",
            Self::Pnpx => "pnpx",
            Self::Yarn => "yarn",
            Self::Yarnpkg => "yarnpkg",
        }
    }

    /// The PM package this name belongs to (for the agreement check).
    pub fn pm(self) -> Pm {
        match self {
            Self::Npm | Self::Npx => Pm::Npm,
            Self::Pnpm | Self::Pnpx => Pm::Pnpm,
            Self::Yarn | Self::Yarnpkg => Pm::Yarn,
        }
    }

    /// `npx`/`pnpx` are runner binaries — transparent ALWAYS, whatever the verb.
    pub fn always_transparent(self) -> bool {
        matches!(self, Self::Npx | Self::Pnpx)
    }
}

/// Verbs that bypass the agreement check for npm|pnpm|yarn alike — `npm create
/// vite` in a pnpm repo must work. Matched against the FIRST positional verb.
pub const TRANSPARENT_VERBS: [&str; 4] = ["init", "create", "dlx", "exec"];

/// Whether this invocation was spawned by an already-running PM (nested) or typed
/// at a shell (top-level) — decides refuse vs fall-through on a mismatch.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Nesting {
    TopLevel,
    Nested,
}

impl Nesting {
    /// `npm_config_user_agent` / `npm_execpath` present ⇒ a PM spawned us (nested).
    /// These are `npm_*` vars the ecosystem owns — brand-safe, not our own sentinel.
    pub fn from_env(mut getenv: impl FnMut(&str) -> Option<String>) -> Self {
        if getenv("npm_config_user_agent").is_some() || getenv("npm_execpath").is_some() {
            Self::Nested
        } else {
            Self::TopLevel
        }
    }
}

/// What the launcher should do when invoked under a PM shim name.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShimDecision {
    /// Run the invoked PM (it agrees with the pin, is transparent, or there's no pin).
    Dispatch,
    /// Top-level mismatch — refuse and tell the user which PM the project uses.
    Refuse { invoked: ShimName, pinned: Pm },
}

/// Decide what a shim invocation should do. `pinned` is the project's PM (lockfile
/// detection; `None` = no pin), `first_verb` the first positional token.
pub fn decide(invoked: ShimName, pinned: Option<Pm>, first_verb: Option<&str>, nesting: Nesting) -> ShimDecision {
    // Runner shims and transparent verbs always pass.
    if invoked.always_transparent() {
        return ShimDecision::Dispatch;
    }

    if let Some(verb) = first_verb {
        if TRANSPARENT_VERBS.contains(&verb) {
            return ShimDecision::Dispatch;
        }
    }

    // No pin → no opinion; agreement → run it.
    let Some(pinned) = pinned else {
        return ShimDecision::Dispatch;
    };

    if invoked.pm() == pinned {
        return ShimDecision::Dispatch;
    }

    // Mismatch: refuse if the user typed it; fall through if a running PM spawned it.
    match nesting {
        Nesting::TopLevel => ShimDecision::Refuse { invoked, pinned },
        Nesting::Nested => ShimDecision::Dispatch,
    }
}

#[cfg(test)]
mod tests {
    use super::{decide, Nesting, ShimDecision, ShimName};
    use crate::pm::Pm;

    #[test]
    fn parses_pm_names_only() {
        assert_eq!(ShimName::parse("pnpm"), Some(ShimName::Pnpm));
        assert_eq!(ShimName::parse("yarnpkg"), Some(ShimName::Yarnpkg));
        assert_eq!(ShimName::parse("node"), None);
        assert_eq!(ShimName::parse("vis"), None);
    }

    #[test]
    fn agreement_dispatches() {
        let d = decide(ShimName::Pnpm, Some(Pm::Pnpm), Some("install"), Nesting::TopLevel);
        assert_eq!(d, ShimDecision::Dispatch);
    }

    #[test]
    fn top_level_mismatch_refuses() {
        let d = decide(ShimName::Npm, Some(Pm::Pnpm), Some("install"), Nesting::TopLevel);
        assert_eq!(d, ShimDecision::Refuse { invoked: ShimName::Npm, pinned: Pm::Pnpm });
    }

    #[test]
    fn nested_mismatch_falls_through() {
        let d = decide(ShimName::Npm, Some(Pm::Pnpm), Some("install"), Nesting::Nested);
        assert_eq!(d, ShimDecision::Dispatch);
    }

    #[test]
    fn transparent_verbs_and_runners_pass_despite_mismatch() {
        // `npm create vite` in a pnpm repo.
        assert_eq!(decide(ShimName::Npm, Some(Pm::Pnpm), Some("create"), Nesting::TopLevel), ShimDecision::Dispatch);
        // npx is always transparent.
        assert_eq!(decide(ShimName::Npx, Some(Pm::Pnpm), Some("anything"), Nesting::TopLevel), ShimDecision::Dispatch);
    }

    #[test]
    fn no_pin_dispatches() {
        assert_eq!(decide(ShimName::Yarn, None, Some("install"), Nesting::TopLevel), ShimDecision::Dispatch);
    }

    #[test]
    fn nesting_reads_npm_user_agent() {
        let nested = Nesting::from_env(|k| (k == "npm_config_user_agent").then(|| "pnpm/9".to_owned()));
        assert_eq!(nested, Nesting::Nested);

        let top = Nesting::from_env(|_| None);
        assert_eq!(top, Nesting::TopLevel);
    }
}
