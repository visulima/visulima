import { describe, expect, it } from "vitest";

import { analyzeCacheMiss } from "../src/dashboard/cache-diff";

const makeTask = (overrides: Record<string, unknown> = {}): any => {
    return {
        cacheStatus: "MISS",
        hash: "new-hash",
        hashDetails: {
            command: "tsc -b",
            implicitDeps: { "package.json": "lock-1" },
            nodes: { "src/index.ts": "aaa" },
            runtime: {},
        },
        target: { project: "app", target: "build" },
        taskId: "app:build",
        ...overrides,
    };
};

const makeRun = (id: string, startTime: string, tasks: unknown[]): any => {
    return {
        id,
        startTime,
        tasks,
    };
};

describe(analyzeCacheMiss, () => {
    it("returns a first-observation reason when no prior run exists", () => {
        expect.assertions(3);

        const result = analyzeCacheMiss([], "run-1", makeTask());

        expect(result.entries).toStrictEqual([]);
        expect(result.previousHash).toBeUndefined();
        expect(result.reason).toContain("first observation");
    });

    it("detects a command change and flags it as the primary reason", () => {
        expect.assertions(3);

        const previous = makeRun("run-1", "2026-01-01T00:00:00Z", [
            {
                ...makeTask(),
                cacheStatus: "HIT",
                hash: "old-hash",
                hashDetails: {
                    command: "tsc -b",
                    implicitDeps: { "package.json": "lock-1" },
                    nodes: { "src/index.ts": "aaa" },
                    runtime: {},
                },
            },
        ]);
        const current = makeTask({
            hashDetails: {
                command: "tsc -b --force",
                implicitDeps: { "package.json": "lock-1" },
                nodes: { "src/index.ts": "aaa" },
                runtime: {},
            },
        });

        const result = analyzeCacheMiss([previous], "run-2", current);

        expect(result.entries.some((e) => e.kind === "command")).toBe(true);
        expect(result.reason).toContain("command");
        expect(result.previousHash).toBe("old-hash");
    });

    it("detects added, removed, and modified file inputs", () => {
        expect.assertions(3);

        const previous = makeRun("run-1", "2026-01-01T00:00:00Z", [
            {
                ...makeTask(),
                cacheStatus: "HIT",
                hash: "old",
                hashDetails: {
                    command: "tsc -b",
                    implicitDeps: {},
                    nodes: { "src/a.ts": "a1", "src/b.ts": "b1" },
                    runtime: {},
                },
            },
        ]);
        const current = makeTask({
            hashDetails: {
                command: "tsc -b",
                implicitDeps: {},
                nodes: { "src/a.ts": "a2", "src/c.ts": "c1" },
                runtime: {},
            },
        });

        const result = analyzeCacheMiss([previous], "run-2", current);
        const byKey = new Map(result.entries.map((e) => [e.key, e]));

        expect(byKey.get("src/a.ts")?.change).toBe("modified");
        expect(byKey.get("src/b.ts")?.change).toBe("removed");
        expect(byKey.get("src/c.ts")?.change).toBe("added");
    });

    it("ignores the current run when searching for a reference", () => {
        expect.assertions(1);

        const currentRun = makeRun("run-current", "2026-01-02T00:00:00Z", [
            { ...makeTask(), cacheStatus: "MISS", hash: "current" },
        ]);
        const prior = makeRun("run-prior", "2026-01-01T00:00:00Z", [
            {
                ...makeTask(),
                cacheStatus: "HIT",
                hash: "prior-hash",
            },
        ]);

        const result = analyzeCacheMiss([currentRun, prior], "run-current", makeTask({ hash: "current" }));

        expect(result.previousRunId).toBe("run-prior");
    });

    it("falls back to most recent execution with hash details when no HIT exists", () => {
        expect.assertions(2);

        const prior = makeRun("run-prior", "2026-01-01T00:00:00Z", [
            {
                ...makeTask(),
                cacheStatus: "MISS",
                hash: "prior-hash",
            },
        ]);

        const result = analyzeCacheMiss([prior], "run-current", makeTask({ hash: "current" }));

        expect(result.previousRunId).toBe("run-prior");
        expect(result.previousHash).toBe("prior-hash");
    });

    it("detects runtime value changes", () => {
        expect.assertions(2);

        const prior = makeRun("run-prior", "2026-01-01T00:00:00Z", [
            {
                ...makeTask(),
                cacheStatus: "HIT",
                hashDetails: {
                    command: "tsc -b",
                    implicitDeps: {},
                    nodes: {},
                    runtime: { NODE_ENV: "development" },
                },
            },
        ]);
        const current = makeTask({
            hashDetails: {
                command: "tsc -b",
                implicitDeps: {},
                nodes: {},
                runtime: { NODE_ENV: "production" },
            },
        });

        const result = analyzeCacheMiss([prior], "run-current", current);

        expect(result.entries).toHaveLength(1);
        expect(result.entries[0]).toMatchObject({ change: "modified", key: "NODE_ENV", kind: "runtime" });
    });
});
