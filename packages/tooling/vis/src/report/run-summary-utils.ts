import { readdir, readFile, stat } from "node:fs/promises";

import { join } from "@visulima/path";
import type { RunSummary, TaskHashDetails, TaskSummary } from "@visulima/task-runner";

import type { HashBucketDiff, HashDetailsDiff } from "./types";

export const findTaskInSummary = (summary: RunSummary, taskId: string): TaskSummary | undefined => summary.tasks.find((task) => task.taskId === taskId);

export const diffHashBuckets = (current: Record<string, string> | undefined, previous: Record<string, string> | undefined): HashBucketDiff => {
    const currentMap = current ?? {};
    const previousMap = previous ?? {};

    const added: string[] = [];
    const removed: string[] = [];
    const changed: string[] = [];

    for (const key of Object.keys(currentMap)) {
        if (!(key in previousMap)) {
            added.push(key);
        } else if (currentMap[key] !== previousMap[key]) {
            changed.push(key);
        }
    }

    for (const key of Object.keys(previousMap)) {
        if (!(key in currentMap)) {
            removed.push(key);
        }
    }

    added.sort();
    removed.sort();
    changed.sort();

    return { added, changed, removed };
};

export const diffHashDetails = (current: TaskHashDetails | undefined, previous: TaskHashDetails | undefined): HashDetailsDiff => {
    return {
        commandChanged: (current?.command ?? "") !== (previous?.command ?? ""),
        implicitDeps: diffHashBuckets(current?.implicitDeps, previous?.implicitDeps),
        nodes: diffHashBuckets(current?.nodes, previous?.nodes),
        runtime: diffHashBuckets(current?.runtime, previous?.runtime),
    };
};

/**
 * Loads a single run summary by ID (the file basename without `.json`)
 * from `.task-runner/runs/`. Returns `undefined` when missing or
 * unparseable so callers can render a friendly error rather than crash.
 */
export const readRunSummaryById = async (workspaceRoot: string, runId: string): Promise<RunSummary | undefined> => {
    const path = join(workspaceRoot, ".task-runner", "runs", `${runId}.json`);

    try {
        const content = await readFile(path, "utf8");

        return JSON.parse(content) as RunSummary;
    } catch {
        return undefined;
    }
};

/**
 * Returns the previous run summary — the second-most-recent file in
 * `.task-runner/runs/`. Excludes the currently-loaded summary by `id`
 * so callers passing a specific run via `--run` get *that run's*
 * prior, not just "the one before now."
 */
export const readPreviousRunSummary = async (workspaceRoot: string, currentId: string | undefined): Promise<RunSummary | undefined> => {
    const runsDirectory = join(workspaceRoot, ".task-runner", "runs");

    let dirents: string[];

    try {
        dirents = (await readdir(runsDirectory)) as unknown as string[];
    } catch {
        return undefined;
    }

    const candidates: { mtimeMs: number; path: string }[] = [];

    for (const name of dirents) {
        if (!name.endsWith(".json")) {
            continue;
        }

        if (currentId !== undefined && name === `${currentId}.json`) {
            continue;
        }

        const fullPath = join(runsDirectory, name);

        try {
            const s = await stat(fullPath);

            if (s.isFile()) {
                candidates.push({ mtimeMs: s.mtimeMs, path: fullPath });
            }
        } catch {
            // Skip — file may have been removed concurrently.
        }
    }

    if (candidates.length === 0) {
        return undefined;
    }

    candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);

    try {
        const content = await readFile(candidates[0]!.path, "utf8");

        return JSON.parse(content) as RunSummary;
    } catch {
        return undefined;
    }
};

/**
 * Lists every run summary recorded under `.task-runner/runs/`, sorted
 * newest-first by mtime. The id is the file basename without `.json`,
 * matching what {@link readRunSummaryById} expects.
 */
export const listRunSummaries = async (workspaceRoot: string): Promise<{ id: string; mtimeMs: number; path: string }[]> => {
    const runsDirectory = join(workspaceRoot, ".task-runner", "runs");

    let dirents: string[];

    try {
        dirents = (await readdir(runsDirectory)) as unknown as string[];
    } catch {
        return [];
    }

    const candidates: { id: string; mtimeMs: number; path: string }[] = [];

    for (const name of dirents) {
        if (!name.endsWith(".json")) {
            continue;
        }

        const fullPath = join(runsDirectory, name);

        try {
            const s = await stat(fullPath);

            if (s.isFile()) {
                candidates.push({ id: name.slice(0, -".json".length), mtimeMs: s.mtimeMs, path: fullPath });
            }
        } catch {
            // Skip — file may have been removed concurrently.
        }
    }

    candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);

    return candidates;
};

export type { HashBucketDiff, HashDetailsDiff } from "./types";
