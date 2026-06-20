/**
 * Per-user "seen packages" store for the dlx first-run info gate.
 *
 * The first time a package is run via `visx` / `vx` / `vis dlx`, the gate
 * shows an info panel (size, security score, permissions, changelog) and asks
 * for confirmation. Once approved, the resolved `name@version` is recorded
 * here so subsequent runs skip the panel.
 *
 * Re-prompt rules (see {@link shouldReprompt}):
 *   - the resolved version differs from any approved entry, OR
 *   - a *new* high/critical security alert appeared on an already-approved
 *     version (the approval recorded the alert fingerprint at the time).
 *
 * Mirrors the `tips.ts` state pattern: a single JSON file under
 * `~/.vis/state/`, best-effort reads/writes that never throw.
 */

import { renameSync } from "node:fs";

import { ensureDirSync, isAccessibleSync, readJsonSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { getVisStateDir } from "../util/vis-paths";

const STATE_FILE = join(getVisStateDir(), "dlx-seen.json");

/** A single approved package entry, keyed by `name@version`. */
export interface DlxSeenEntry {
    /** Sorted high/critical security alert keys present when the user approved. */
    alertKeys: string[];
    /** Epoch millis when the user approved this package. */
    seenAt: number;
}

export interface DlxSeenState {
    /** Approved packages keyed by `name@version`. */
    packages: Record<string, DlxSeenEntry>;
    /** Schema version for forward-compatible migrations. */
    version: 1;
}

const keyFor = (name: string, version: string): string => `${name}@${version}`;

const isValidEntry = (value: unknown): value is DlxSeenEntry => {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const entry = value as DlxSeenEntry;

    return Array.isArray(entry.alertKeys) && entry.alertKeys.every((key) => typeof key === "string") && typeof entry.seenAt === "number";
};

/**
 * Read the on-disk "seen packages" store, dropping any malformed entries.
 * @returns The parsed state, or an empty store on miss / corrupt / unreadable.
 */
export const readDlxSeen = (): DlxSeenState => {
    try {
        if (isAccessibleSync(STATE_FILE)) {
            const parsed = readJsonSync(STATE_FILE) as unknown as Partial<DlxSeenState>;

            if (parsed && typeof parsed === "object" && parsed.packages && typeof parsed.packages === "object" && parsed.version === 1) {
                // Drop malformed entries rather than trusting the on-disk shape.
                const packages: Record<string, DlxSeenEntry> = {};

                for (const [key, entry] of Object.entries(parsed.packages)) {
                    if (isValidEntry(entry)) {
                        packages[key] = entry;
                    }
                }

                return { packages, version: 1 };
            }
        }
    } catch {
        // Corrupt/unreadable state — treat as empty.
    }

    return { packages: {}, version: 1 };
};

const writeDlxSeen = (state: DlxSeenState): void => {
    try {
        ensureDirSync(getVisStateDir());
        // Write-then-rename so a concurrent reader never sees a half-written file.
        const temporary = `${STATE_FILE}.${String(process.pid)}.tmp`;

        writeFileSync(temporary, JSON.stringify(state));
        renameSync(temporary, STATE_FILE);
    } catch {
        // Non-critical — failing to persist just means we re-prompt next time.
    }
};

/**
 * Look up the approval entry for `name@version`, if any.
 * @param state The seen-packages store to read from.
 * @param name The package name.
 * @param version The resolved package version.
 * @returns The matching entry, or `undefined` when the version was never approved.
 */
export const getSeenEntry = (state: DlxSeenState, name: string, version: string): DlxSeenEntry | undefined => state.packages[keyFor(name, version)];

/**
 * Decide whether the gate should re-show for a package the user may have
 * approved before. Returns `true` (re-prompt) when the version was never
 * approved, or when a high/critical alert key is present now that wasn't part
 * of the recorded approval.
 * @param entry The recorded approval, or `undefined` if never approved.
 * @param currentAlertKeys High/critical alert keys observed on this run.
 * @returns `true` when the gate should re-prompt.
 */
export const shouldReprompt = (entry: DlxSeenEntry | undefined, currentAlertKeys: ReadonlyArray<string>): boolean => {
    if (!entry) {
        return true;
    }

    const known = new Set(Array.isArray(entry.alertKeys) ? entry.alertKeys : []);

    return currentAlertKeys.some((alertKey) => !known.has(alertKey));
};

/**
 * Record an approval for `name@version` with the alert fingerprint at approval time.
 * @param name The approved package name.
 * @param version The approved, resolved package version.
 * @param alertKeys High/critical alert keys present at approval time.
 * @param now Approval timestamp (epoch ms).
 */
export const markSeen = (name: string, version: string, alertKeys: ReadonlyArray<string>, now: number): void => {
    const state = readDlxSeen();

    state.packages[keyFor(name, version)] = {
        alertKeys: [...alertKeys].sort(),
        seenAt: now,
    };

    writeDlxSeen(state);
};
