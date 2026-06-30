/**
 * Replay changelogs (tegami parity).
 *
 * A change file may carry `replay` conditions instead of (or alongside being)
 * a normal one-shot bump. A replay file is *retained* on `version` — not
 * deleted — and its body is re-emitted into a package's changelog when a
 * milestone fires:
 *
 *   - `name@1.2.0`            — that package reaches that exact version
 *   - `exit-prerelease:name`  — that package leaves a prerelease line
 *
 * Replay files are changelog-only: they never contribute a version bump (the
 * file is long-lived, so bumping off it would re-bump on every run). The file
 * is deleted once every one of its conditions has fired.
 *
 * Pure functions only — the plan assembler injects bodies + decides retention.
 */

import { VisReleaseError } from "../errors";
import type { ChangeFile, ChangeFileNested, PlannedRelease, ReplayCondition } from "../types";

const EXIT_PRERELEASE_RE = /^exit[\s-]prerelease\s*:\s*(.+)$/i;
const VERSION_RE = /^(.+)@(\d+\.\d+\.\d+(?:[-+].*)?)$/;

/** Parse a single raw `replay` entry (`"name@1.2.0"` or `"exit-prerelease:name"`). */
export const parseReplayCondition = (raw: unknown, file: string): ReplayCondition => {
    if (typeof raw !== "string" || raw.trim() === "") {
        throw new VisReleaseError({
            code: "BUMP_FILE_INVALID",
            file,
            message: `Invalid replay condition: ${JSON.stringify(raw)}. Expected "name@1.2.0" or "exit-prerelease:name".`,
        });
    }

    const value = raw.trim();
    const exitMatch = EXIT_PRERELEASE_RE.exec(value);

    if (exitMatch) {
        return { kind: "exit-prerelease", package: (exitMatch[1] ?? "").trim() };
    }

    const versionMatch = VERSION_RE.exec(value);

    if (versionMatch) {
        return { kind: "version", package: (versionMatch[1] ?? "").trim(), version: versionMatch[2] ?? "" };
    }

    throw new VisReleaseError({
        code: "BUMP_FILE_INVALID",
        file,
        message: `Invalid replay condition "${value}". Expected "name@1.2.0" or "exit-prerelease:name".`,
    });
};

/** Parse the `replay` array from a nested change file's frontmatter. */
export const parseReplayConditions = (raw: unknown, file: string): ReplayCondition[] => {
    if (!Array.isArray(raw)) {
        throw new VisReleaseError({
            code: "BUMP_FILE_INVALID",
            file,
            message: `\`replay\` must be a list of conditions (e.g. ["name@1.2.0", "exit-prerelease:name"]).`,
        });
    }

    return raw.map((entry) => parseReplayCondition(entry, file));
};

/** True when a change file carries replay conditions (and is therefore retained). */
export const isReplayFile = (file: ChangeFile): file is ChangeFile & { payload: ChangeFileNested & { replay: ReplayCondition[] } } =>
    !("bumps" in file.payload) && Array.isArray(file.payload.replay) && file.payload.replay.length > 0;

/** A semver value is a prerelease when it carries a `-&lt;id>` suffix. */
export const isPrereleaseVersion = (version: string): boolean => /^\d+\.\d+\.\d+-/.test(version);

/** Whether a planned release satisfies a single replay condition. */
export const conditionSatisfiedBy = (condition: ReplayCondition, release: PlannedRelease): boolean => {
    if (condition.package !== release.name) {
        return false;
    }

    if (condition.kind === "version") {
        return release.newVersion === condition.version;
    }

    // exit-prerelease: was a prerelease, now isn't.
    return isPrereleaseVersion(release.oldVersion) && !isPrereleaseVersion(release.newVersion);
};

export interface ReplayEvaluation {
    /** Replay files whose every condition has now fired — safe to delete. */
    consumed: ChangeFile[];
    /** package name → replay bodies to inject into that package's changelog this run. */
    injectionsByPackage: Map<string, ChangeFile[]>;
    /** Replay files with conditions still pending — keep on disk. */
    retained: ChangeFile[];
}

/**
 * Evaluate replay files against the computed releases. Produces the per-package
 * changelog injections, plus the consumed/retained partition.
 */
export const evaluateReplayFiles = (replayFiles: ChangeFile[], releases: PlannedRelease[]): ReplayEvaluation => {
    const injectionsByPackage = new Map<string, ChangeFile[]>();
    const consumed: ChangeFile[] = [];
    const retained: ChangeFile[] = [];

    for (const file of replayFiles) {
        if (!isReplayFile(file)) {
            continue;
        }

        const conditions = file.payload.replay;
        let allFired = true;

        for (const condition of conditions) {
            const match = releases.find((release) => conditionSatisfiedBy(condition, release));

            if (match) {
                const list = injectionsByPackage.get(match.name) ?? [];

                // De-dup by file id: a file with two conditions that both match
                // the same release (e.g. `name@1.0.0` + `exit-prerelease:name`
                // when an rc graduates to 1.0.0) must inject its body once, not
                // once per condition.
                if (!list.some((existing) => existing.id === file.id)) {
                    list.push(file);
                }

                injectionsByPackage.set(match.name, list);
            } else {
                allFired = false;
            }
        }

        if (allFired) {
            consumed.push(file);
        } else {
            retained.push(file);
        }
    }

    return { consumed, injectionsByPackage, retained };
};
