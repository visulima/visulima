/**
 * Single source of truth for the lockfile filenames this package recognizes, in the
 * priority order `findUp` scans them per directory (first match wins). `package-manager`
 * and `lockfile` both consume this list so the two modules can never disagree about which
 * lockfile a directory resolves to.
 *
 * Ordering rationale:
 * - `pnpm-lock.yaml` first: after a migration a stale `yarn.lock` is often left behind, so
 *   the pnpm lockfile should win when both are present (this matches the parser module).
 * - `npm-shrinkwrap.json` shares `package-lock.json`'s JSON shape and is grouped with it.
 * - `bun.lock` (modern text) before `bun.lockb` (legacy binary) so a migrated project with a
 *   stale binary lockfile still picks the parseable one.
 */
// eslint-disable-next-line import/prefer-default-export
export const LOCKFILE_CANDIDATES = [
    "pnpm-lock.yaml",
    "package-lock.json",
    "npm-shrinkwrap.json",
    "yarn.lock",
    "bun.lock",
    "bun.lockb",
] as const;
