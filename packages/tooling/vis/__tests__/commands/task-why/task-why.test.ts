import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import taskWhyExecute from "../../../src/commands/task-why/handler";

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

describe("vis task-why", () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        // eslint-disable-next-line sonarjs/pseudo-random -- temp-dir suffix in tests, not security-sensitive
        workspaceRoot = join(tmpdir(), `vis-taskwhy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

        await mkdir(workspaceRoot, { recursive: true });
        await writeFile(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root", workspaces: ["packages/*"] }));

        await mkdir(join(workspaceRoot, "packages/app"), { recursive: true });
        await writeFile(join(workspaceRoot, "packages/app/package.json"), JSON.stringify({ dependencies: { "@my/lib": "*" }, name: "@my/app" }));
        await writeFile(
            join(workspaceRoot, "packages/app/project.json"),
            JSON.stringify({
                targets: {
                    build: { command: "echo app-build", dependsOn: ["^build"] },
                    test: { command: "echo app-test", dependsOn: ["build"] },
                },
            }),
        );

        await mkdir(join(workspaceRoot, "packages/lib"), { recursive: true });
        await writeFile(join(workspaceRoot, "packages/lib/package.json"), JSON.stringify({ name: "@my/lib" }));
        await writeFile(
            join(workspaceRoot, "packages/lib/project.json"),
            JSON.stringify({
                targets: {
                    build: { command: "echo lib-build" },
                },
            }),
        );
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    it("throws when the task ID is malformed", async () => {
        expect.assertions(1);

        const { logger } = makeLogger();

        await expect(
            taskWhyExecute({
                argument: ["notacolon"],
                logger,
                options: {},
                runtime: {} as never,
                visConfig: undefined,
                workspaceRoot,
            } as never),
        ).rejects.toThrow(/expected format/);
    });

    it("throws for an unknown project", async () => {
        expect.assertions(1);

        const { logger } = makeLogger();

        await expect(
            taskWhyExecute({
                argument: ["@unknown/pkg:build"],
                logger,
                options: {},
                runtime: {} as never,
                visConfig: undefined,
                workspaceRoot,
            } as never),
        ).rejects.toThrow(/Unknown project/);
    });

    it("prints a chain for a dependency that was pulled in transitively", async () => {
        expect.assertions(2);

        const { calls, logger } = makeLogger();

        await taskWhyExecute({
            argument: ["@my/lib:build"],
            logger,
            options: {},
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = calls.map((c) => c.slice(1).join(" ")).join("\n");

        expect(text).toContain("Why @my/lib:build");
        // lib:build is pulled in by app:build via "^build" → the path must mention app:build
        expect(text).toContain("@my/app:build");
    });
});
