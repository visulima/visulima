//! Unflag layer — a Node-version-keyed feature matrix for `vis x`.
//!
//! Some runtime features are gated behind experimental flags on the Node floor
//! (e.g. `node:sqlite`, web storage) that vis can flip on for the user's script,
//! the way nub's feature matrix unflags capabilities. This is STRICTLY opt-in
//! (`VIS_UNFLAG`) — default `vis x` is byte-for-byte unchanged — and version-gated
//! so the launcher never passes a flag the running Node would reject.
//!
//! `VIS_UNFLAG` values: `all` (or `1`/`true`/empty) enables every rule whose
//! version window includes the running Node; a comma list (`sqlite,webstorage`)
//! enables a subset by key. Only applied on the `x` Node spawn (a runtime feature
//! for user code) — never on vis's own CLI spawn.

use crate::node_version::NodeVersion;

/// One unflag rule: a key (for the comma-list spec), the flag to inject, and the
/// minimum Node version at which the flag exists. All current rules sit below the
/// 22.14 floor, so the gate is satisfied across supported Node — kept explicit so
/// adding a newer-only flag stays correct.
struct UnflagRule {
    key: &'static str,
    flag: &'static str,
    min_major: u32,
    min_minor: u32,
}

const RULES: &[UnflagRule] = &[
    // Better stack traces for the user script. Stable since Node 12.
    UnflagRule { key: "sourcemaps", flag: "--enable-source-maps", min_major: 22, min_minor: 0 },
    // node:sqlite — experimental flag introduced in Node 22.5.
    UnflagRule { key: "sqlite", flag: "--experimental-sqlite", min_major: 22, min_minor: 5 },
    // Web Storage (localStorage/sessionStorage) — experimental flag since 22.4.
    UnflagRule { key: "webstorage", flag: "--experimental-webstorage", min_major: 22, min_minor: 4 },
];

fn version_satisfies(version: NodeVersion, rule: &UnflagRule) -> bool {
    version.major > rule.min_major || (version.major == rule.min_major && version.minor >= rule.min_minor)
}

fn spec_wants_all(spec: &str) -> bool {
    let trimmed = spec.trim();

    trimmed.is_empty() || trimmed.eq_ignore_ascii_case("all") || trimmed == "1" || trimmed.eq_ignore_ascii_case("true")
}

/// The flags to inject for a given `VIS_UNFLAG` spec and Node version. Empty when
/// no rule is selected/satisfied — so an opt-in with an unknown key is a no-op
/// rather than an error.
pub fn unflag_args(spec: &str, version: NodeVersion) -> Vec<&'static str> {
    let all = spec_wants_all(spec);

    RULES
        .iter()
        .filter(|rule| {
            let selected = all || spec.split(',').any(|part| part.trim().eq_ignore_ascii_case(rule.key));

            selected && version_satisfies(version, rule)
        })
        .map(|rule| rule.flag)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::unflag_args;
    use crate::node_version::NodeVersion;

    const V24: NodeVersion = NodeVersion { major: 24, minor: 15, patch: 0 };

    #[test]
    fn all_selects_every_rule() {
        let args = unflag_args("all", V24);

        assert!(args.contains(&"--enable-source-maps"));
        assert!(args.contains(&"--experimental-sqlite"));
        assert!(args.contains(&"--experimental-webstorage"));
    }

    #[test]
    fn comma_list_selects_subset() {
        let args = unflag_args("sqlite,sourcemaps", V24);

        assert!(args.contains(&"--experimental-sqlite"));
        assert!(args.contains(&"--enable-source-maps"));
        assert!(!args.contains(&"--experimental-webstorage"));
    }

    #[test]
    fn unknown_key_is_noop() {
        assert!(unflag_args("doesnotexist", V24).is_empty());
    }

    #[test]
    fn version_gate_excludes_too_old() {
        let v22_4 = NodeVersion { major: 22, minor: 4, patch: 0 };
        let args = unflag_args("all", v22_4);

        // sqlite needs 22.5; webstorage/sourcemaps are satisfied at 22.4.
        assert!(!args.contains(&"--experimental-sqlite"));
        assert!(args.contains(&"--experimental-webstorage"));
    }
}
