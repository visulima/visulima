// Heuristic false-positive filters ported from detect-secrets.
//
// Each filter takes a `Finding`-shaped slice and returns `true` when the
// finding is *likely* a false positive and should be dropped. Composition
// lives in `pipeline.ts` — this module is pure + test-friendly.
//
// Safety note: every filter here runs globally across the full ruleset.
// Keep them conservative — dropping a real secret because a heuristic
// over-matched is strictly worse than emitting a false positive that a
// per-rule allowlist would have caught anyway.

import { basename } from "node:path";

/**
 * Lock file names across the modern language ecosystem. Matched by basename
 * only — repo layout (`packages/foo/pnpm-lock.yaml`, `apps/web/yarn.lock`,
 * nested monorepo lock files) is handled implicitly.
 *
 * Starts from `detect_secrets/filters/heuristic.py::is_lock_file` (12 entries)
 * and extends with pnpm, bun, Go modules, Dart, Nix, Elixir, modern Python
 * tooling, and Gradle. Entries here are high-confidence generated files that
 * routinely churn — scanning them is almost never what the user wants, and
 * when it is, they can disable via `config.heuristics.lockFile: false`.
 */
const LOCK_FILE_NAMES = new Set<string>([
    // Terraform
    ".terraform.lock.hcl",
    // Chef
    "Berksfile.lock",
    // Homebrew
    "Brewfile.lock.json",
    // JavaScript / Node
    "bun.lock",
    "bun.lockb",
    // Rust
    "Cargo.lock",
    // Swift / iOS
    "Cartfile.resolved",
    // PHP
    "composer.lock",
    // Python
    "conda-lock.yml",
    // Nix
    "flake.lock",
    // Ruby
    "Gemfile.lock",
    // Go
    "go.sum",
    // Gradle (Java/Kotlin)
    "gradle.lockfile",
    // Elixir
    "mix.lock",
    "npm-shrinkwrap.json",
    "package-lock.json",
    "Package.resolved",
    // .NET
    "packages.lock.json",
    "pdm.lock",
    "Pipfile.lock",
    "pnpm-lock.yaml",
    "pnpm-lock.yml",
    "Podfile.lock",
    "poetry.lock",
    // Dart / Flutter
    "pubspec.lock",
    "shrinkwrap.yaml",
    "uv.lock",
    "yarn.lock",
]);

export const isLockFile = (file: string): boolean => LOCK_FILE_NAMES.has(basename(file));

/**
 * Pre-computed character sequences. A secret that is a substring of any of
 * these is almost certainly a placeholder (`abcdefgh`, `12345678`, `ABCABC`).
 *
 * Uppercased-only: the check uppercases the candidate, so we only compare
 * against uppercase sequences. Length 40 covers the longest common secret
 * formats (AWS, GitHub PAT, Slack token body).
 */
const SEQUENTIAL_SEQUENCES: ReadonlyArray<string> = (() => {
    // eslint-disable-next-line no-secrets/no-secrets -- alphabet, not a secret
    const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const digits = "0123456789";
    // eslint-disable-next-line no-secrets/no-secrets -- hex alphabet, not a secret
    const hex = "0123456789ABCDEF";

    return [
        // Letters repeated long enough to cover any plausible secret length.
        (alpha + alpha).slice(0, 60),
        digits.repeat(6).slice(0, 60),
        hex.repeat(4).slice(0, 60),
    ];
})();

/** Single-character repetition — `AAAAAAAA`, `xxxxxxxx`, `00000000`. */
const SINGLE_CHAR_REPETITION = /^(.)\1+$/u;

/**
 * Detect "sequential" / "repeating" placeholder-looking secrets.
 *
 * Ports `detect_secrets/filters/heuristic.py::is_sequential_string` plus a
 * cheap extension: a secret consisting of a single repeating character
 * (`AAAAAAAA`, `xxxxxxxx`, `00000000`) is also flagged, since those slip
 * past detect-secrets' substring check but are obvious placeholders.
 *
 * Short secrets (< 6 chars) are always allowed; the check is too permissive
 * at that length.
 */
export const isSequentialString = (secret: string): boolean => {
    if (secret.length < 6) {
        return false;
    }

    if (SINGLE_CHAR_REPETITION.test(secret)) {
        return true;
    }

    const upper = secret.toUpperCase();

    return SEQUENTIAL_SEQUENCES.some((sequence) => sequence.includes(upper));
};

/**
 * Standard UUID shape — 8-4-4-4-12 hex groups, case-insensitive.
 *
 * Ports `detect_secrets/filters/heuristic.py::is_potential_uuid`. A secret
 * in this shape is almost always an object identifier (trace id, request
 * id, user id) rather than a credential.
 */
const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export const isPotentialUuid = (secret: string): boolean => UUID_PATTERN.test(secret);

/**
 * Secret contains zero alphanumeric characters — typically masked values
 * (`*****`, `------`, `//////`) that a greedy regex captured.
 *
 * Ports `detect_secrets/filters/heuristic.py::is_not_alphanumeric_string`.
 */
const ALPHANUMERIC_PATTERN = /[\da-z]/i;

export const isNotAlphanumericString = (secret: string): boolean => {
    // Empty `secret` indicates a path-only rule finding (no captured content
    // — the rule fires on filename match alone). Those must skip every
    // content-shape heuristic, since "no capture" trivially has no
    // alphanumeric chars and would otherwise be silently dropped here.
    if (secret.length === 0) {
        return false;
    }

    return !ALPHANUMERIC_PATTERN.test(secret);
};
