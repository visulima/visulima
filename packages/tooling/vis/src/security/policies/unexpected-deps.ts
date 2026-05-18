/**
 * `unexpectedDeps` policy — flags packages that aren't on a static
 * allow-list, or that appear in the current lockfile but not in a
 * saved baseline lockfile.
 *
 * Both modes (allow + baseline) can be combined; the engine emits a
 * decision when the package fails *either* check. Allow-list entries
 * support glob suffixes (`@scope/*`, `eslint-*`). The baseline file
 * is parsed with the same lockfile reader as the live tree, so any
 * supported lockfile format works as a baseline.
 *
 * Offline-clean: only reads local files.
 */

import { readFileSync } from "@visulima/fs";
import type { LockFileType } from "@visulima/package";
import { parseLockFileContent } from "@visulima/package";
import { isAbsolute, resolve } from "@visulima/path";

import type { VisConfig } from "../../config/types";
import { LOCKFILE_NAMES } from "../dependency-scan";
import { findAcceptedRisk } from "../socket-security";
import type { PolicyDecision, PolicyInput } from "./index";

/**
 * Best-effort lockfile-type detection from a filename. Accepts both the
 * canonical name (`pnpm-lock.yaml`) and any path ending in
 * `&lt;sep>&lt;canonical-name>` so users can prefix baseline files (e.g.
 * `baseline.pnpm-lock.yaml`, `2026-01.yarn.lock`).
 */
const detectLockfileType = (path: string): LockFileType | undefined => {
    for (const info of Object.values(LOCKFILE_NAMES)) {
        if (path === info.file || path.endsWith(`/${info.file}`) || path.endsWith(`.${info.file}`)) {
            return info.type;
        }
    }

    return undefined;
};

/**
 * Loads a baseline lockfile from disk. Returns a Set of `name@version`
 * keys present in the baseline. Returns `undefined` when the file is
 * unreadable or unparseable so the engine can skip the baseline portion
 * of the check without blowing up.
 */
const loadBaselineKeys = (workspaceRoot: string, baselinePath: string, packageManager: string): Set<string> | undefined => {
    const absolute = isAbsolute(baselinePath) ? baselinePath : resolve(workspaceRoot, baselinePath);

    let content: string;

    try {
        content = readFileSync(absolute);
    } catch {
        return undefined;
    }

    const type: LockFileType | undefined = detectLockfileType(absolute) ?? LOCKFILE_NAMES[packageManager]?.type;

    if (!type) {
        return undefined;
    }

    const entries = parseLockFileContent(content, type);

    if (entries.length === 0) {
        return undefined;
    }

    const set = new Set<string>();

    for (const entry of entries) {
        set.add(`${entry.name}@${entry.version}`);
    }

    return set;
};

/**
 * True when `name` matches any allow-list pattern. Supports trailing
 * `*` globs (`@scope/*`, `eslint-*`); bare names match exactly.
 */
const matchesAllowList = (name: string, allow: string[]): boolean => {
    for (const pattern of allow) {
        if (pattern === name) {
            return true;
        }

        if (pattern.endsWith("*") && name.startsWith(pattern.slice(0, -1))) {
            return true;
        }
    }

    return false;
};

export const evaluateUnexpectedDepsPolicy = (input: PolicyInput, config: VisConfig): PolicyDecision[] => {
    const unexpectedConfig = config.security?.policies?.unexpectedDeps;

    if (!unexpectedConfig) {
        return [];
    }

    const allow = unexpectedConfig.allow ?? [];
    const baselinePath = unexpectedConfig.baselineLockfile;

    if (allow.length === 0 && !baselinePath) {
        return [];
    }

    const baselineKeys = baselinePath ? loadBaselineKeys(input.workspaceRoot, baselinePath, input.packageManager) : undefined;
    const acceptedRisks = config.security?.acceptedRisks;
    const decisions: PolicyDecision[] = [];

    for (const pkg of input.packages) {
        const allowMatches = allow.length === 0 || matchesAllowList(pkg.name, allow);
        const baselineMatches = baselineKeys ? baselineKeys.has(`${pkg.name}@${pkg.version}`) : true;

        if (allowMatches && baselineMatches) {
            continue;
        }

        const reasons: string[] = [];
        const data: Record<string, unknown> = {};

        if (!allowMatches) {
            reasons.push(`not on allow-list (${allow.length} entr${allow.length === 1 ? "y" : "ies"})`);
            data.allowList = allow;
        }

        if (!baselineMatches && baselineKeys) {
            reasons.push(`not present in baseline lockfile (${baselinePath})`);
            data.baselineLockfile = baselinePath;
        }

        decisions.push({
            acceptedRisk: findAcceptedRisk(pkg.name, pkg.version, acceptedRisks, "unexpectedDeps"),
            data,
            packageName: pkg.name,
            policy: "unexpectedDeps",
            reason: `${pkg.name}@${pkg.version} is unexpected: ${reasons.join("; ")}`,
            severity: "block",
            version: pkg.version,
        });
    }

    return decisions;
};
