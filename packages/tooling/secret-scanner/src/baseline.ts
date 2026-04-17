import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

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
export const loadBaselineSet = async (baselinePath: string | undefined): Promise<Set<string>> => {
    if (!baselinePath || !existsSync(baselinePath)) {
        return new Set();
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

    const set = new Set<string>();

    for (const entry of parsed) {
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
