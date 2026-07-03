/**
 * Detect peer-dependency warnings emitted by package managers during
 * install / update. Patterns cover pnpm, npm, yarn (classic + berry),
 * and bun. Each PM has its own dialect:
 *
 * - pnpm: a per-line `unmet peer …` row inside a tree, and a trailing
 *   `Issues with peer dependencies found` summary line.
 * - npm: `npm WARN ERESOLVE …` (npm v7+).
 * - yarn classic: `warning … has unmet peer dependency …`.
 * - yarn berry: structured `YN0060` (INCOMPATIBLE_PEER_DEPENDENCY).
 *   `YN0002` (MISSING_PEER_DEPENDENCY) intentionally omitted — it
 *   fires for legitimate dev-only setups, producing false positives.
 * - bun: `incorrect peer dependency` (verbose mode).
 *
 * `peer dep missing` (npm v3-v6) is omitted: that npm series is EOL
 * and the phrase appears in unrelated diagnostic strings.
 *
 * Kept as plain regexes — we only need a boolean to decide whether
 * to show the `vis update --peer` hint; we don't try to parse the
 * tree itself.
 */
const PEER_WARNING_PATTERNS: ReadonlyArray<RegExp> = [
    /Issues with peer dependencies found/i,
    /\bunmet peer\b/i,
    /\bERESOLVE\b/,
    /unmet peer dependency/i,
    /\bYN0060\b/,
    /incorrect peer dependency/i,
];

/**
 * Hint surfaced after an install / update emits peer-dependency
 * warnings. Single source of truth so the install handler, the
 * `applyCatalogAndInstall` path in update, and the `executePmWrapper`
 * path in update can never drift.
 */
export const PEER_HINT = "Peer dependency issues detected. Run `vis update --peer` to inspect and bump mismatched peer dependencies.";

export const hasPeerDependencyWarnings = (output: string): boolean => {
    if (!output) {
        return false;
    }

    return PEER_WARNING_PATTERNS.some((re) => re.test(output));
};
