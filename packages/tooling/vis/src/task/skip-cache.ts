import type { WorkspaceConfiguration } from "@visulima/task-runner";

import type { VisProjectConfiguration } from "../config/workspace";
import type { ParsedSelector } from "./selectors";
import { parseTargetSelector } from "./selectors";

export interface SkipCacheResolution {
    /** Patterns that did not match any task in the graph. */
    unmatchedPatterns: string[];
    /**
     * The set of `project:target` task IDs whose cache should be bypassed
     * for this run. Tested against the resolved task graph, including
     * dependency tasks.
     */
    skipTaskIds: Set<string>;
}

const splitPatterns = (raw: string): string[] => raw
    .split(",")
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern !== "");

/**
 * Resolves `--skip-cache=<patterns>` into a Set of task IDs whose cache
 * should be bypassed. Reuses the run-target selector grammar so the
 * patterns the user already knows from `vis run` work here too.
 *
 * Supported forms:
 *
 * - `pkg:target` — exact ID; only the named (project, target) is flagged
 * - `:target`    — every project's `target` in the graph
 * - `#tag:target` — every tagged project's `target`
 * - `target`    — bare form, equivalent to `:target`
 *
 * `~:target` (closest-to-cwd) is rejected — it's ambiguous in a graph
 * walker context and the user almost certainly means one of the forms
 * above. Patterns that match nothing in the graph are returned in
 * `unmatchedPatterns` so the caller can warn (not throw — a pattern may
 * legitimately match a task pruned by `--projects` / `--query`).
 */
export const resolveSkipCachePatterns = (
    raw: string | undefined,
    workspace: WorkspaceConfiguration,
    graphTaskIds: Iterable<string>,
): SkipCacheResolution => {
    const skipTaskIds = new Set<string>();
    const unmatchedPatterns: string[] = [];

    if (raw === undefined || raw.trim() === "") {
        return { skipTaskIds, unmatchedPatterns };
    }

    const taskIds = [...graphTaskIds];
    const taskIdSet = new Set(taskIds);
    const idsByTarget = new Map<string, string[]>();

    for (const id of taskIds) {
        const colon = id.lastIndexOf(":");

        if (colon === -1) {
            continue;
        }

        const targetName = id.slice(colon + 1);
        const list = idsByTarget.get(targetName);

        if (list === undefined) {
            idsByTarget.set(targetName, [id]);
        } else {
            list.push(id);
        }
    }

    for (const pattern of splitPatterns(raw)) {
        if (pattern.startsWith("~:")) {
            throw new Error(
                `--skip-cache does not support the closest-project selector "~:" (received "${pattern}"). Use \`pkg:target\`, \`:target\`, or \`#tag:target\`.`,
            );
        }

        // Exact task-ID lookup first — covers `pkg:target` for project
        // names that don't include `-`, `/`, or `@` (which the selector
        // grammar can't distinguish from a bare target containing `:`).
        // The user sees task IDs in logs and dry-run output and expects
        // them to be valid skip-cache patterns.
        if (taskIdSet.has(pattern)) {
            skipTaskIds.add(pattern);
            continue;
        }

        const parsed = parseTargetSelector(pattern);

        if (!parsed) {
            unmatchedPatterns.push(pattern);
            continue;
        }

        let matchedAny = false;

        if (parsed.kind === "all") {
            const matches = idsByTarget.get(parsed.target) ?? [];

            for (const id of matches) {
                skipTaskIds.add(id);
                matchedAny = true;
            }
        } else if (parsed.kind === "project") {
            const projectName = (parsed as ParsedSelector).projects?.[0];

            if (projectName !== undefined) {
                const id = `${projectName}:${parsed.target}`;

                if (taskIdSet.has(id)) {
                    skipTaskIds.add(id);
                    matchedAny = true;
                }
            }
        } else if (parsed.kind === "tag") {
            const tag = parsed.tag;

            if (tag !== undefined) {
                const matches = idsByTarget.get(parsed.target) ?? [];

                for (const id of matches) {
                    const projectName = id.slice(0, id.lastIndexOf(":"));
                    const project = workspace.projects[projectName] as VisProjectConfiguration | undefined;

                    if (project?.tags?.includes(tag) === true) {
                        skipTaskIds.add(id);
                        matchedAny = true;
                    }
                }
            }
        }

        if (!matchedAny) {
            unmatchedPatterns.push(pattern);
        }
    }

    return { skipTaskIds, unmatchedPatterns };
};
