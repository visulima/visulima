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

const EMPTY_STATE: DlxSeenState = { packages: {}, version: 1 };

const keyFor = (name: string, version: string): string => `${name}@${version}`;

export const readDlxSeen = (): DlxSeenState => {
    try {
        if (isAccessibleSync(STATE_FILE)) {
            const parsed = readJsonSync(STATE_FILE) as unknown as Partial<DlxSeenState>;

            if (parsed && typeof parsed === "object" && parsed.packages && parsed.version === 1) {
                return parsed as DlxSeenState;
            }
        }
    } catch {
        // Corrupt/unreadable state — treat as empty.
    }

    return { ...EMPTY_STATE, packages: {} };
};

const writeDlxSeen = (state: DlxSeenState): void => {
    try {
        ensureDirSync(getVisStateDir());
        writeFileSync(STATE_FILE, JSON.stringify(state));
    } catch {
        // Non-critical — failing to persist just means we re-prompt next time.
    }
};

export const getSeenEntry = (state: DlxSeenState, name: string, version: string): DlxSeenEntry | undefined => state.packages[keyFor(name, version)];

/**
 * Decide whether the gate should re-show for a package the user may have
 * approved before. Returns `true` (re-prompt) when the version was never
 * approved, or when a high/critical alert key is present now that wasn't part
 * of the recorded approval.
 */
export const shouldReprompt = (entry: DlxSeenEntry | undefined, currentAlertKeys: ReadonlyArray<string>): boolean => {
    if (!entry) {
        return true;
    }

    const known = new Set(entry.alertKeys);

    return currentAlertKeys.some((alertKey) => !known.has(alertKey));
};

/** Record an approval for `name@version` with the alert fingerprint at approval time. */
export const markSeen = (name: string, version: string, alertKeys: ReadonlyArray<string>, now: number): void => {
    const state = readDlxSeen();

    state.packages[keyFor(name, version)] = {
        alertKeys: [...alertKeys].sort(),
        seenAt: now,
    };

    writeDlxSeen(state);
};
