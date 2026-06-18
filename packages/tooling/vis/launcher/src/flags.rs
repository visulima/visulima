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
    // `sessionStorage` works with just this; `localStorage` also needs a backing
    // file (the `localstorage` key adds `--localstorage-file`, handled below).
    UnflagRule { key: "webstorage", flag: "--experimental-webstorage", min_major: 22, min_minor: 4 },
    // EventSource (server-sent events) client — experimental flag since 22.3,
    // still gated on the 22.x line (native on newer majors, where the flag is a
    // tolerated no-op). Matches nub's feature-matrix EventSource row.
    UnflagRule { key: "eventsource", flag: "--experimental-eventsource", min_major: 22, min_minor: 3 },
];

/// The `localstorage` key implies `webstorage` PLUS a backing file. Its min version
/// matches webstorage (22.4).
const LOCALSTORAGE_MIN: (u32, u32) = (22, 4);

fn version_satisfies(version: NodeVersion, rule: &UnflagRule) -> bool {
    version.major > rule.min_major || (version.major == rule.min_major && version.minor >= rule.min_minor)
}

fn version_ge(version: NodeVersion, min: (u32, u32)) -> bool {
    version.major > min.0 || (version.major == min.0 && version.minor >= min.1)
}

fn spec_wants_all(spec: &str) -> bool {
    let trimmed = spec.trim();

    trimmed.is_empty() || trimmed.eq_ignore_ascii_case("all") || trimmed == "1" || trimmed.eq_ignore_ascii_case("true")
}

fn spec_selects(spec: &str, key: &str) -> bool {
    spec_wants_all(spec) || spec.split(',').any(|part| part.trim().eq_ignore_ascii_case(key))
}

/// The flags to inject for a `VIS_UNFLAG` spec and Node version. Empty when no rule
/// is selected/satisfied — an opt-in with an unknown key is a no-op, not an error.
///
/// `localstorage_file` is the path used for `--localstorage-file` when the
/// `localstorage` key is selected (persistent `localStorage` needs a backing file;
/// `sessionStorage` alone needs only `--experimental-webstorage`).
pub fn unflag_args(spec: &str, version: NodeVersion, localstorage_file: &str) -> Vec<String> {
    let mut out: Vec<String> = RULES
        .iter()
        .filter(|rule| spec_selects(spec, rule.key) && version_satisfies(version, rule))
        .map(|rule| rule.flag.to_owned())
        .collect();

    // `localstorage` = web storage flag (if not already added) + a backing file.
    if spec_selects(spec, "localstorage") && version_ge(version, LOCALSTORAGE_MIN) {
        let webstorage = "--experimental-webstorage".to_owned();

        if !out.contains(&webstorage) {
            out.push(webstorage);
        }

        out.push(format!("--localstorage-file={localstorage_file}"));
    }

    out
}

#[cfg(test)]
mod tests {
    use super::unflag_args;
    use crate::node_version::NodeVersion;

    const V24: NodeVersion = NodeVersion { major: 24, minor: 15, patch: 0 };
    const LS: &str = "/tmp/ls.db";

    fn has(args: &[String], flag: &str) -> bool {
        args.iter().any(|a| a == flag)
    }

    #[test]
    fn all_selects_every_rule() {
        let args = unflag_args("all", V24, LS);

        assert!(has(&args, "--enable-source-maps"));
        assert!(has(&args, "--experimental-sqlite"));
        assert!(has(&args, "--experimental-webstorage"));
        assert!(has(&args, "--experimental-eventsource"));
        // `all` includes localstorage → backing-file flag present.
        assert!(has(&args, "--localstorage-file=/tmp/ls.db"));
    }

    #[test]
    fn comma_list_selects_subset() {
        let args = unflag_args("sqlite,sourcemaps", V24, LS);

        assert!(has(&args, "--experimental-sqlite"));
        assert!(has(&args, "--enable-source-maps"));
        assert!(!has(&args, "--experimental-webstorage"));
        assert!(!has(&args, "--experimental-eventsource"));
    }

    #[test]
    fn eventsource_selected_alone() {
        let args = unflag_args("eventsource", V24, LS);

        assert_eq!(args, vec!["--experimental-eventsource".to_owned()]);
    }

    #[test]
    fn localstorage_adds_webstorage_and_file_without_duplication() {
        // localstorage alone → webstorage flag + the backing file, no dupe.
        let args = unflag_args("localstorage", V24, LS);

        assert!(has(&args, "--experimental-webstorage"));
        assert!(has(&args, "--localstorage-file=/tmp/ls.db"));
        assert_eq!(args.iter().filter(|a| *a == "--experimental-webstorage").count(), 1);

        // webstorage + localstorage together must not double the flag.
        let both = unflag_args("webstorage,localstorage", V24, LS);

        assert_eq!(both.iter().filter(|a| *a == "--experimental-webstorage").count(), 1);
    }

    #[test]
    fn unknown_key_is_noop() {
        assert!(unflag_args("doesnotexist", V24, LS).is_empty());
    }

    #[test]
    fn version_gate_excludes_too_old() {
        let v22_4 = NodeVersion { major: 22, minor: 4, patch: 0 };
        let args = unflag_args("all", v22_4, LS);

        // sqlite needs 22.5; webstorage/sourcemaps/eventsource ok at 22.4.
        assert!(!has(&args, "--experimental-sqlite"));
        assert!(has(&args, "--experimental-webstorage"));
        assert!(has(&args, "--experimental-eventsource"));
    }
}
