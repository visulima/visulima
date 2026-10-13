import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import runExecute from "../../../src/commands/run/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

const silentLogger = { debug: () => undefined, error: () => undefined, info: () => undefined, warn: () => undefined };

// A target whose command is a two-segment `&&` chain. Each segment appends its
// argv as one JSON line to its own log, so a cache hit adds no line and the
// arguments each segment received are visible.
const seedWorkspace = (workspaceRoot: string, secondSegment: string): void => {
    writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
    writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));

    const packageDir = join(workspaceRoot, "packages", "app");

    mkdirSync(packageDir, { recursive: true });
    writeFileSync(join(packageDir, "package.json"), JSON.stringify({ name: "@my/app" }));
    writeFileSync(join(packageDir, "input.txt"), "input\n");

    for (const segment of ["a", "b"]) {
        writeFileSync(
            join(packageDir, `step-${segment}.cjs`),
            `require("node:fs").appendFileSync(${JSON.stringify(join(workspaceRoot, `log-${segment}.txt`))}, JSON.stringify(process.argv.slice(2)) + "\\n");\n`,
        );
    }

    writeFileSync(
        join(packageDir, "project.json"),
        JSON.stringify({
            targets: {
                build: {
                    command: `node step-a.cjs && ${secondSegment}`,
                    inputs: ["{projectRoot}/input.txt"],
                    outputs: [],
                    splitCompound: true,
                },
            },
        }),
    );
};

describe("vis run splitCompound", () => {
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
        workspaceRoot = createTemporaryDirectory("vis-run-split-");
        seedWorkspace(workspaceRoot, "node step-b.cjs");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("forwards splitCompound to the engine: changing the last segment re-runs only that segment", async () => {
        expect.assertions(4);

        await run();

        expect([runs("a").length, runs("b").length]).toStrictEqual([1, 1]);

        await run();

        expect([runs("a").length, runs("b").length]).toStrictEqual([1, 1]);

        // Only the second segment's command text changes. The chain keeps
        // segment 1 cached, so only the changed segment executes.
        seedWorkspace(workspaceRoot, "node step-b.cjs --changed");

        await run();

        expect(runs("a")).toHaveLength(1);
        expect(runs("b")).toHaveLength(2);
    });

    it("hands forwarded arguments to the last segment only", async () => {
        expect.assertions(2);

        await run(["build", "--flag"]);

        expect(runs("a")).toStrictEqual(["[]"]);
        expect(runs("b")).toStrictEqual(["[\"--flag\"]"]);
    });

    it("lists each segment in the dry-run plan", async () => {
        expect.assertions(2);

        const lines: string[] = [];
        const capturing = { ...silentLogger, info: (message: unknown) => lines.push(String(message)) };

        await run(["build"], { dryRun: true }, capturing as never);

        expect(lines.some((line) => line.includes("@my/app:build#1") && line.includes("segment 1/2"))).toBe(true);
        expect(lines.some((line) => line.includes("@my/app:build#2") && line.includes("segment 2/2"))).toBe(true);
    });
});
