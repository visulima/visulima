import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import syncExecute from "../../../src/commands/sync/handler";
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

describe("vis sync codeowners", () => {
    let workspaceRoot: string;
    let originalExitCode: number | string | undefined;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-sync-");
        originalExitCode = process.exitCode;

        writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));

        const aDir = join(workspaceRoot, "packages", "a");

        mkdirSync(aDir, { recursive: true });
        writeFileSync(join(aDir, "package.json"), JSON.stringify({ name: "@my/a" }));
        writeFileSync(
            join(aDir, "project.json"),
            JSON.stringify({
                owners: [{ owners: ["@team-a"], path: "src/**" }],
            }),
        );
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
        process.exitCode = originalExitCode;
    });

    it("throws when the kind argument is missing", async () => {
        expect.assertions(1);

        const { logger } = makeLogger();

        await expect(
            syncExecute({
                argument: [],
                logger,
                options: {},
                runtime: {} as never,
                visConfig: undefined,
                workspaceRoot,
            } as never),
        ).rejects.toThrow(/Missing sync kind/);
    });

    it("throws on an unknown kind", async () => {
        expect.assertions(1);

        const { logger } = makeLogger();

        await expect(
            syncExecute({
                argument: ["wat"],
                logger,
                options: {},
                runtime: {} as never,
                visConfig: undefined,
                workspaceRoot,
            } as never),
        ).rejects.toThrow(/Unknown sync kind/);
    });

    it("writes a CODEOWNERS file with each project's owners", async () => {
        expect.assertions(2);

        const { logger } = makeLogger();

        await syncExecute({
            argument: ["codeowners"],
            logger,
            options: {},
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const content = readFileSync(join(workspaceRoot, "CODEOWNERS"), "utf8");

        expect(content).toContain("/packages/a/src/**");
        expect(content).toContain("@team-a");
    });

    it("writes to a custom --out path when provided", async () => {
        expect.assertions(1);

        const { logger } = makeLogger();

        await syncExecute({
            argument: ["codeowners"],
            logger,
            options: { out: ".github/CODEOWNERS" },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const content = readFileSync(join(workspaceRoot, ".github/CODEOWNERS"), "utf8");

        expect(content).toContain("/packages/a/src/**");
    });

    it("--check sets process.exitCode=1 when the file is stale", async () => {
        expect.assertions(2);

        const { calls, logger } = makeLogger();

        writeFileSync(join(workspaceRoot, "CODEOWNERS"), "outdated content\n");

        await syncExecute({
            argument: ["codeowners"],
            logger,
            options: { check: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = calls.map((c) => c.slice(1).join(" ")).join("\n");

        expect(process.exitCode).toBe(1);
        expect(text).toContain("out of date");

        process.exitCode = 0;
    });

    it("--check is a no-op when the file is up to date", async () => {
        expect.assertions(2);

        const { calls, logger } = makeLogger();

        await syncExecute({
            argument: ["codeowners"],
            logger,
            options: {},
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const beforeChecks = process.exitCode;

        await syncExecute({
            argument: ["codeowners"],
            logger,
            options: { check: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = calls.map((c) => c.slice(1).join(" ")).join("\n");

        expect(process.exitCode).toBe(beforeChecks);
        expect(text).toContain("is up to date");
    });

    it("logs 'Nothing to sync' when no project declares owners", async () => {
        expect.assertions(1);

        // Replace project.json with one that has no owners
        const aDir = join(workspaceRoot, "packages", "a");

        writeFileSync(join(aDir, "project.json"), JSON.stringify({}));

        const { calls, logger } = makeLogger();

        await syncExecute({
            argument: ["codeowners"],
            logger,
            options: {},
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = calls.map((c) => c.slice(1).join(" ")).join("\n");

        expect(text).toContain("Nothing to sync");
    });
});
