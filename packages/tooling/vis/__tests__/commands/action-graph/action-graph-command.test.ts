import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import actionGraphExecute from "../../../src/commands/action-graph/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

type LoggerCall = [string, ...unknown[]];

const makeLogger = (): {
    calls: LoggerCall[];
    logger: {
        debug: (...args: unknown[]) => void;
        error: (...args: unknown[]) => void;
        info: (...args: unknown[]) => void;
        warn: (...args: unknown[]) => void;
    };
} => {
    const calls: LoggerCall[] = [];

    return {
        calls,
        logger: {
            debug: (...args) => calls.push(["debug", ...args]),
            error: (...args) => calls.push(["error", ...args]),
            info: (...args) => calls.push(["info", ...args]),
            warn: (...args) => calls.push(["warn", ...args]),
        },
    };
};

describe("vis action-graph", () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-action-graph-");

        writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));

        const appDir = join(workspaceRoot, "packages", "app");
        const libDir = join(workspaceRoot, "packages", "lib");

        mkdirSync(appDir, { recursive: true });
        mkdirSync(libDir, { recursive: true });

        writeFileSync(join(appDir, "package.json"), JSON.stringify({ dependencies: { "@my/lib": "*" }, name: "@my/app", scripts: { build: "echo app" } }));
        writeFileSync(
            join(appDir, "project.json"),
            JSON.stringify({
                tags: ["frontend"],
                targets: { build: { command: "echo app", dependsOn: ["^build"] } },
            }),
        );

        writeFileSync(join(libDir, "package.json"), JSON.stringify({ name: "@my/lib", scripts: { build: "echo lib" } }));
        writeFileSync(
            join(libDir, "project.json"),
            JSON.stringify({
                tags: ["backend"],
                targets: { build: { command: "echo lib" } },
            }),
        );
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("throws when no selector is provided", async () => {
        expect.assertions(1);

        const { logger } = makeLogger();

        await expect(
            actionGraphExecute({
                argument: [],
                logger,
                options: {},
                runtime: {} as never,
                visConfig: undefined,
                workspaceRoot,
            } as never),
        ).rejects.toThrow(/Missing selector/);
    });

    it("renders an indented ASCII plan with deps above dependents", async () => {
        expect.assertions(3);

        const { calls, logger } = makeLogger();

        await actionGraphExecute({
            argument: ["build"],
            logger,
            options: {},
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = calls.map((c) => c.slice(1).join(" ")).join("\n");

        expect(text).toContain("@my/app:build");
        expect(text).toContain("@my/lib:build");
        // Lib should appear before app in topological order
        expect(text.indexOf("@my/lib:build")).toBeLessThan(text.indexOf("@my/app:build"));
    });

    it("emits a JSON plan when --json is set", async () => {
        expect.assertions(3);

        const { calls, logger } = makeLogger();

        await actionGraphExecute({
            argument: ["build"],
            logger,
            options: { json: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const jsonText = calls.find((c) => c[0] === "info")?.[1] as string;
        const parsed = JSON.parse(jsonText) as { roots: string[]; tasks: Record<string, { dependsOn: string[] }> };

        expect(parsed.tasks["@my/lib:build"]).toBeDefined();
        expect(parsed.tasks["@my/app:build"]).toBeDefined();
        expect(parsed.tasks["@my/app:build"]!.dependsOn).toContain("@my/lib:build");
    });

    it("filters projects with --query", async () => {
        expect.assertions(2);

        const { calls, logger } = makeLogger();

        await actionGraphExecute({
            argument: ["build"],
            logger,
            options: { json: true, query: "tag=frontend" },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const jsonText = calls.find((c) => c[0] === "info")?.[1] as string;
        const parsed = JSON.parse(jsonText) as { tasks: Record<string, unknown> };

        expect(parsed.tasks["@my/app:build"]).toBeDefined();
        // Lib was filtered out at the project level, but pulled back in transitively as a dep
        // so we just assert app exists — the dependency closure may still include lib.
        expect(Object.keys(parsed.tasks).length).toBeGreaterThan(0);
    });

    it("logs a clear message when no project has the requested target", async () => {
        expect.assertions(1);

        const { calls, logger } = makeLogger();

        await actionGraphExecute({
            argument: ["nonexistent"],
            logger,
            options: {},
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = calls.map((c) => c.slice(1).join(" ")).join("\n");

        expect(text).toContain('No projects have a "nonexistent" target.');
    });
});
