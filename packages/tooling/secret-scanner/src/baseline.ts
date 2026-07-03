import { existsSync } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";

import { fingerprint, legacyFingerprint } from "./fingerprint";
import type { Finding } from "./types";

const isFinding = (value: unknown): value is Finding => {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const candidate = value as Finding;

    return typeof candidate.ruleId === "string" && typeof candidate.file === "string" && typeof candidate.startLine === "number";
};

/**
 * Index an array of findings into a suppression `Set`. Each entry is added
 * under **both** its content-hash fingerprint and its legacy line-based
 * fingerprint — the same dual-indexing the on-disk loader uses — so a
 * `Finding[]` baseline suppresses identically whether it came from a file or
 * was passed inline. `secret` is treated as optional (older / redacted
 * findings) and falls back to an empty string for the content hash.
 */
export const buildBaselineSet = (findings: ReadonlyArray<Finding>): Set<string> => {
    const set = new Set<string>();

    for (const entry of findings) {
        if (!isFinding(entry)) {
            continue;
        }

        const withSecret: Finding = {
            ...entry,
            secret: typeof entry.secret === "string" ? entry.secret : "",
        };

        set.add(fingerprint(withSecret));
        set.add(legacyFingerprint(entry));
    }

    return set;
};

/**
 * Read a baseline file and return a `Set` of fingerprints we should suppress.
 *
 * The set indexes **both** the content-hash fingerprint and the legacy
 * line-based fingerprint for every entry — that way a baseline written before
 * the content-hash switch (or one where the same finding moved lines since
 * capture) still suppresses correctly without a migration step. `secret` is
 * treated as optional in older baselines; we fall back to an empty string so
 * the content-hash index stays populated and the legacy-line index still
 * catches them.
 *
 * Returns an empty set when the file is missing, unreadable, non-JSON, or not
 * an array — errors are logged to stderr so CI surfaces misuse without
 * crashing the scan.
 */
// Path → { mtimeMs, size, set } cache. An editor integration calling
// `scanString` per save re-reads and re-hashes the same baseline on every
// keystroke otherwise. Keyed on mtime+size so an edited baseline invalidates
// without a manual reset; reset explicitly via `resetBaselineCacheForTests`.
const baselineFileCache = new Map<string, { mtimeMs: number; set: Set<string>; size: number }>();

/** Test-only: drop the path+mtime baseline cache so fixture mutations don't leak across tests. */
export const resetBaselineCacheForTests = (): void => {
    baselineFileCache.clear();
};

export const loadBaselineSet = async (baselinePath: string | undefined): Promise<Set<string>> => {
    if (!baselinePath || !existsSync(baselinePath)) {
        return new Set();
    }

    // mtime+size cache hit — skip the read + parse + hash entirely.
    let cacheKey: { mtimeMs: number; size: number } | undefined;

    try {
        const stats = await stat(baselinePath);

        cacheKey = { mtimeMs: stats.mtimeMs, size: stats.size };

        const cached = baselineFileCache.get(baselinePath);

        if (cached?.mtimeMs === cacheKey.mtimeMs && cached?.size === cacheKey.size) {
            return cached.set;
        }
    } catch {
        // stat failed (race / permissions) — fall through to the read path,
        // which has its own error handling and won't be cached.
        cacheKey = undefined;
    }

    // Single try/catch around read + parse. `existsSync` above is advisory —
    // the file can still disappear / lose read permission / be replaced
    // between the check and the read (TOCTOU). Any failure in the read-parse
    // path falls back to "no baseline" with a stderr note.
    let parsed: unknown;

    try {
        const raw = await readFile(baselinePath, "utf8");

        parsed = JSON.parse(raw);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        // eslint-disable-next-line no-console -- Diagnostic output; stderr is the intended channel for library warnings.
        console.error(`secret-scanner: ignoring malformed baseline ${baselinePath}: ${message}`);

        return new Set();
    }

    if (!Array.isArray(parsed)) {
        // eslint-disable-next-line no-console -- Diagnostic output; stderr is the intended channel for library warnings.
        console.error(`secret-scanner: baseline ${baselinePath} must be an array of findings; ignoring`);

        return new Set();
    }

    const set = buildBaselineSet(parsed as Finding[]);

    // Only cache when we have a fresh stat key (a read that raced past a failed
    // stat stays uncached so the next call re-validates).
    if (cacheKey) {
        baselineFileCache.set(baselinePath, { mtimeMs: cacheKey.mtimeMs, set, size: cacheKey.size });
    }

    return set;
};

/**
 * Resolve a `ScanOptions.baseline` value into the suppression `Set` the
 * pipeline consults. Accepts the supported forms:
 *
 * - `undefined` - empty set (no suppression).
 * - `string` - path; read and parsed via {@link loadBaselineSet}.
 * - `ReadonlySet` - returned as-is (already a fingerprint set).
 * - `Finding` array - indexed inline via {@link buildBaselineSet} (zero file IO).
 */
export const resolveBaselineSet = async (baseline: Finding[] | ReadonlySet<string> | string | undefined): Promise<ReadonlySet<string>> => {
    if (baseline === undefined) {
        return new Set();
    }

    if (typeof baseline === "string") {
        return loadBaselineSet(baseline);
    }

    if (baseline instanceof Set) {
        return baseline;
    }

    if (Array.isArray(baseline)) {
        return buildBaselineSet(baseline);
    }

    return new Set();
};

/**
 * Serialise findings into the baseline-file JSON shape (a plain findings array,
 * pretty-printed). Pairs with `baseline: "./path.json"` on the read side -
 * write the output here, point a later scan at it. Returning a string (rather
 * than writing) keeps the helper IO-free for editor/library hosts; use
 * {@link writeBaseline} when you want it persisted.
 */
export const createBaseline = (findings: ReadonlyArray<Finding>): string => `${JSON.stringify(findings, undefined, 2)}\n`;

/** Write `findings` to `path` in the baseline-file JSON shape (see {@link createBaseline}). */
export const writeBaseline = async (path: string, findings: ReadonlyArray<Finding>): Promise<void> => {
    await writeFile(path, createBaseline(findings), "utf8");
};
