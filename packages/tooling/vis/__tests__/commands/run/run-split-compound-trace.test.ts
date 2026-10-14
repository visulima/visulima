import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { strip } from "@visulima/colorize";
import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import runExecute from "../../../src/commands/run/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

const silentLogger = { debug: () => undefined, error: () => undefined, info: () => undefined, warn: () => undefined };

// A traced target whose command is a two-segment `&&` chain. Each segment reads
// its own input file (so the tracker records it) and appends its argv as one
// JSON line to its own log, so a cache hit adds no line and the arguments each
// segment received are visible.
const seedWorkspace = (workspaceRoot: string, secondSegment: string): void => {
    writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
    writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));

    const packageDir = join(workspaceRoot, "packages", "app");

    mkdirSync(packageDir, { recursive: true });
    writeFileSync(join(packageDir, "package.json"), JSON.stringify({ name: "@my/app" }));

    for (const segment of ["a", "b"]) {
        writeFileSync(join(packageDir, `input-${segment}.txt`), `${segment}-input\n`);
        writeFileSync(
            join(packageDir, `step-${segment}.cjs`),
            [
                `const { appendFileSync, readFileSync } = require("node:fs");`,
                `readFileSync(${JSON.stringify(join(packageDir, `input-${segment}.txt`))}, "utf8");`,
                String.raw`appendFileSync(${JSON.stringify(join(workspaceRoot, `log-${segment}.txt`))}, JSON.stringify(process.argv.slice(2)) + "\n");`,
                ``,
            ].join("\n"),
        );
    }

    writeFileSync(
        join(packageDir, "project.json"),
        JSON.stringify({
            targets: {
                build: {
                    command: `node step-a.cjs && ${secondSegment}`,
                    hashMode: "trace",
                    outputs: [],
                    splitCompound: true,
                },
            },
        }),
    );
};

describe("vis run splitCompound on a traced target", () => {
    let workspaceRoot: string;

    const runs = (segment: "a" | "b"): string[] => {
        try {
            return readFileSync(join(workspaceRoot, `log-${segment}.txt`), "utf8").split("\n").filter(Boolean);
        } catch {
            return [];
        }
    };

    const run = async (argument: string[] = ["build"], options: Record<string, unknown> = {}, logger = silentLogger): Promise<void> => {
        await runExecute({
            argument,
            logger,
            options: { cache: true, cacheDir: join(workspaceRoot, ".cache"), parallel: 1, preflight: false, skipToolchain: true, ...options },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);
    };

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-run-split-trace-");
        seedWorkspace(workspaceRoot, "node step-b.cjs");
    });

    afterEach(() => {
        vi.restoreAllMocks();
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("re-runs only the last segment when only its command changes, and an unchanged rerun executes nothing", async () => {
        expect.assertions(4);

        await run();

        expect([runs("a").length, runs("b").length]).toStrictEqual([1, 1]);

        await run();

        expect([runs("a").length, runs("b").length]).toStrictEqual([1, 1]);

        seedWorkspace(workspaceRoot, "node step-b.cjs --changed");

        await run();

        expect(runs("a")).toHaveLength(1);
        expect(runs("b")).toHaveLength(2);
    });

    it("re-runs every segment when the first segment's input file changes, though the second reads only its own file", async () => {
        expect.assertions(2);

        await run();

        writeFileSync(join(workspaceRoot, "packages", "app", "input-a.txt"), "a-changed\n");

        await run();

        // Segment two never read input-a, so it re-runs only because segment one's trace key moved.
        expect([runs("a").length, runs("b").length]).toStrictEqual([2, 2]);

        await run();

        expect([runs("a").length, runs("b").length]).toStrictEqual([2, 2]);
    });

    it("hands forwarded arguments to the last segment only", async () => {
        expect.assertions(2);

        await run(["build", "--flag"]);

        expect(runs("a")).toStrictEqual(["[]"]);
        expect(runs("b")).toStrictEqual(["[\"--flag\"]"]);
    });

    it("lists each traced segment in the dry-run plan with its trace annotation", async () => {
        expect.assertions(2);

        const lines: string[] = [];
        const capturing = { ...silentLogger, info: (message: unknown) => lines.push(strip(String(message))) };

        await run(["build"], { dryRun: true }, capturing as never);

        expect(lines.some((line) => line.includes("@my/app:build#1") && line.includes("(trace)") && line.includes("segment 1/2"))).toBe(true);
        expect(lines.some((line) => line.includes("@my/app:build#2") && line.includes("(trace)") && line.includes("segment 2/2"))).toBe(true);
    });
});
