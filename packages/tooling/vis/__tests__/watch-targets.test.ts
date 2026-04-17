import type { Task, TaskResult, TaskResults } from "@visulima/task-runner";
import { describe, expect, it } from "vitest";

import { collectTrackedWatchTargets, createTrackedFileFilter } from "../src/watch";

const makeResult = (taskId: string, nodes: Record<string, string> | undefined): [string, TaskResult] => {
    const task: Task = {
        hashDetails: nodes ? { command: "", nodes } : undefined,
        id: taskId,
        outputs: [],
        overrides: {},
        target: { project: taskId.split(":")[0] ?? "a", target: taskId.split(":")[1] ?? "build" },
    };

    return [
        taskId,
        {
            code: 0,
            status: "success",
            task,
            terminalOutput: "",
        },
    ];
};

describe(collectTrackedWatchTargets, () => {
    it("returns empty sets when no task has hashDetails", () => {
        expect.assertions(2);

        const results: TaskResults = new Map([makeResult("a:build", undefined)]);
        const targets = collectTrackedWatchTargets(results, "/workspace");

        expect(targets.files.size).toBe(0);
        expect(targets.directories).toStrictEqual([]);
    });

    it("dedupes parent directories — watching a parent covers children", () => {
        expect.assertions(2);

        const results: TaskResults = new Map([
            makeResult("a:build", {
                "packages/a/src/index.ts": "h1",
                "packages/a/src/utils/format.ts": "h2",
            }),
        ]);
        const targets = collectTrackedWatchTargets(results, "/workspace");

        // Only `/workspace/packages/a/src` remains — `src/utils` is pruned.
        expect(targets.directories).toStrictEqual(["/workspace/packages/a/src"]);
        expect(targets.files.size).toBe(2);
    });

    it("merges files from multiple tasks", () => {
        expect.assertions(1);

        const results: TaskResults = new Map([
            makeResult("a:build", { "packages/a/src/index.ts": "h1" }),
            makeResult("b:build", { "packages/b/src/main.ts": "h2" }),
        ]);
        const targets = collectTrackedWatchTargets(results, "/workspace");

        expect(targets.directories).toStrictEqual(["/workspace/packages/a/src", "/workspace/packages/b/src"]);
    });
});

describe(createTrackedFileFilter, () => {
    it("returns true for tracked paths emitted relative to the watched directory", () => {
        expect.assertions(2);

        const files = new Set(["packages/a/src/index.ts"]);
        const directories = ["/workspace/packages/a/src"];
        const filter = createTrackedFileFilter(files, "/workspace", directories);

        // node:fs.watch emits paths relative to the watched dir,
        // so the filter must accept "index.ts" (not the full path).
        expect(filter("index.ts")).toBe(true);
        expect(filter("untracked.ts")).toBe(false);
    });

    it("normalizes backslashes on Windows-style paths", () => {
        expect.assertions(1);

        const files = new Set(["packages/a/src/sub/file.ts"]);
        const directories = ["/workspace/packages/a/src"];
        const filter = createTrackedFileFilter(files, "/workspace", directories);

        expect(filter(String.raw`sub\file.ts`)).toBe(true);
    });
});
