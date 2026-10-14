/**
 * Plan every Python edit for a release wave, the counterpart of `cargo-plan.ts`.
 *
 * Per released project:
 *   - `[project].version` in its `pyproject.toml`;
 *   - the `uv.lock` entry for the project, which uv records as a workspace
 *     member (`source = { editable = "." }` or `{ virtual = "." }`).
 *
 * Dependents are not rewritten. A workspace dependency's specifier is checked
 * against the new version, and one that would exclude it is reported, because
 * rewriting a PEP 440 specifier safely needs more than a line edit.
 */

import { readFile } from "node:fs/promises";
import { dirname } from "node:path";

import { VisReleaseError } from "../errors";
import { findLockfile } from "./cargo-lock";
import { normalizePythonName } from "./python-projects";
import { rewriteCargoVersion } from "./version-files";

const PROJECT_TABLE: ReadonlySet<string> = new Set(["project"]);
const WORKSPACE_SOURCE = /^source\s*=\s*\{\s*(?:editable|virtual|directory)\s*=/;

export interface PythonPlanRelease {
    manifestPath: string;
    name: string;
    newVersion: string;
}

export interface PythonPlanOptions {
    cwd: string;
    /** Every discovered Python project and its workspace-dependency specifiers, for the dependent check. */
    dependents: ReadonlyArray<{ dependencies: Record<string, string>; name: string }>;
    pending: Map<string, string>;
    releases: ReadonlyArray<PythonPlanRelease>;
}

export interface PythonPlanResult {
    touched: Set<string>;
    warnings: string[];
}

/** Numeric release tuple of a plain version (`1.2.3`), ignoring pre/post/dev suffixes. */
const releaseTuple = (version: string): number[] => {
    const release = /^\s*v?(\d+(?:\.\d+)*)/.exec(version);

    return release ? (release[1] ?? "").split(".").map(Number) : [];
};

const compareTuples = (a: number[], b: number[]): number => {
    const length = Math.max(a.length, b.length);

    for (let index = 0; index < length; index++) {
        const diff = (a[index] ?? 0) - (b[index] ?? 0);

        if (diff !== 0) {
            return Math.sign(diff);
        }
    }

    return 0;
};

/** One specifier clause against a version's release tuple. `~=` is the compatible-release rule. */
const clauseHolds = (op: string, target: number[], bound: number[]): boolean => {
    const cmp = compareTuples(target, bound);

    switch (op) {
        case "!=": {
            return cmp !== 0;
        }
        case "<": {
            return cmp < 0;
        }
        case "<=": {
            return cmp <= 0;
        }
        case "==": {
            return cmp === 0;
        }
        case ">": {
            return cmp > 0;
        }
        case ">=": {
            return cmp >= 0;
        }
        default: {
            // ~=X.Y: at least X.Y, and the prefix before the last component must match.
            // ~=1.2 is ==1.*; ~=1.2.0 is ==1.2.*. Compare the prefix of len(bound) - 1.
            return cmp >= 0 && target.slice(0, bound.length - 1).join(".") === bound.slice(0, -1).join(".");
        }
    }
};

/**
 * Does `version` satisfy every clause of `specifier`? Only the common clauses
 * are checked (`>=`, `>`, `&lt;=`, `&lt;`, `==`, `!=`, `~=`). Anything else counts as
 * satisfied, so this never warns about a clause it cannot read.
 */
export const specifierAccepts = (specifier: string, version: string): boolean => {
    const target = releaseTuple(version);

    for (const raw of specifier.split(",")) {
        const clause = /^\s*(>=|<=|==|!=|~=|>|<)\s*(\S+)\s*$/.exec(raw);

        if (!clause) {
            continue;
        }

        const op = clause[1]!;
        const bound = releaseTuple(clause[2]!);

        if (bound.length === 0) {
            continue;
        }

        if (!clauseHolds(op, target, bound)) {
            return false;
        }
    }

    return true;
};

/**
 * Rewrite the `version` of the uv workspace-member entry named `name`.
 * An entry with a registry or git source is never touched, even if the name matches.
 */
export const rewriteUvLockVersion = (raw: string, name: string, newVersion: string): { content?: string; found: boolean } => {
    const lines = raw.split("\n");
    const wanted = normalizePythonName(name);
    const starts: number[] = [];

    lines.forEach((line, index) => {
        if (line.trim() === "[[package]]") {
            starts.push(index);
        }
    });

    let found = false;

    for (let block = 0; block < starts.length; block++) {
        const start = starts[block]!;
        const end = starts[block + 1] ?? lines.length;
        let blockName: string | undefined;
        let versionLine = -1;
        let isMember = false;

        for (let index = start + 1; index < end; index++) {
            const line = lines[index]!.trim();
            const nameMatch = /^name\s*=\s*"([^"]+)"$/.exec(line);
            const versionMatch = /^version\s*=\s*"[^"]*"$/.test(line);

            if (nameMatch && blockName === undefined) {
                [, blockName] = nameMatch;
            } else if (versionMatch && versionLine === -1) {
                versionLine = index;
            } else if (WORKSPACE_SOURCE.test(line)) {
                isMember = true;
            }
        }

        if (blockName === undefined || versionLine === -1 || !isMember || normalizePythonName(blockName) !== wanted) {
            continue;
        }

        const indent = /^(\s*)/.exec(lines[versionLine]!)?.[1] ?? "";

        lines[versionLine] = `${indent}version = "${newVersion}"${lines[versionLine]!.endsWith("\r") ? "\r" : ""}`;
        found = true;
    }

    return found ? { content: lines.join("\n"), found } : { found };
};

const readPending = async (pending: Map<string, string>, path: string): Promise<string> => pending.get(path) ?? readFile(path, "utf8");

/**
 * Apply every Python edit for the wave to `pending`: project versions, a
 * warning for each workspace dependency specifier the new version falls
 * outside, and the `uv.lock` entries.
 */
export const planPythonWorkspace = async (options: PythonPlanOptions): Promise<PythonPlanResult> => {
    const { cwd, dependents, pending, releases } = options;
    const touched = new Set<string>();
    const warnings: string[] = [];

    for (const release of releases) {
        const raw = await readPending(pending, release.manifestPath);
        const result = rewriteCargoVersion(raw, release.newVersion, PROJECT_TABLE);

        if (result.content !== undefined) {
            pending.set(release.manifestPath, result.content);
            touched.add(release.manifestPath);
        }

        if (!result.found) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                file: release.manifestPath,
                message: `${release.manifestPath} has no literal [project].version to bump.`,
            });
        }

        const lockPath = await findLockfile(dirname(release.manifestPath), cwd, "uv.lock");

        if (lockPath === undefined) {
            continue;
        }

        const lock = pending.get(lockPath) ?? (await readFile(lockPath, "utf8"));
        const updated = rewriteUvLockVersion(lock, release.name, release.newVersion);

        if (!updated.found) {
            warnings.push(`uv-lock: ${release.name} has no workspace-member entry in ${lockPath}; run \`uv lock\` to add it.`);

            continue;
        }

        if (updated.content !== undefined) {
            pending.set(lockPath, updated.content);
            touched.add(lockPath);
        }
    }

    // Dependents keep their specifiers. One that the new version falls outside
    // is reported, so the operator can widen it.
    for (const dependent of dependents) {
        for (const release of releases) {
            const specifier = dependent.dependencies[release.name];

            if (specifier !== undefined && specifier !== "*" && !specifierAccepts(specifier, release.newVersion)) {
                warnings.push(
                    `python-deps: ${dependent.name} requires ${release.name}${specifier}, which excludes ${release.newVersion}; widen the specifier before release.`,
                );
            }
        }
    }

    return { touched, warnings };
};
