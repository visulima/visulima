import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { initExecute, pruneExecute, scaffoldExecute } from "../../../src/commands/docker/handler";
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

const callText = (calls: LoggerCall[]): string => calls.map((c) => c.slice(1).join(" ")).join("\n");

describe("vis docker", () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-docker-cmd-");

        writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));
        writeFileSync(join(workspaceRoot, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");

        const appDir = join(workspaceRoot, "packages", "app");
        const libDir = join(workspaceRoot, "packages", "lib");

        mkdirSync(appDir, { recursive: true });
        mkdirSync(libDir, { recursive: true });

        writeFileSync(join(appDir, "package.json"), JSON.stringify({ dependencies: { "@my/lib": "*" }, name: "@my/app" }));
        writeFileSync(join(libDir, "package.json"), JSON.stringify({ name: "@my/lib" }));
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("scaffold throws without --focus", async () => {
        expect.assertions(1);

        const { logger } = makeLogger();

        await expect(
            scaffoldExecute({ argument: [], logger, options: {}, runtime: {} as never, visConfig: undefined, workspaceRoot } as never),
        ).rejects.toThrow(/Missing --focus/);
    });

    it("scaffold writes the workspace context for the focus closure", async () => {
        expect.assertions(3);

        const { calls, logger } = makeLogger();

        await scaffoldExecute({ argument: [], logger, options: { focus: "@my/app" }, runtime: {} as never, visConfig: undefined, workspaceRoot } as never);

        const outDir = join(workspaceRoot, ".vis/docker");

        expect(existsSync(join(outDir, "workspace", "packages", "app", "package.json"))).toBe(true);
        expect(existsSync(join(outDir, "workspace", "packages", "lib", "package.json"))).toBe(true);
        expect(callText(calls)).toContain("Scaffolded");
    });

    it("prune logs the number of removed projects", async () => {
        expect.assertions(1);

        const { logger: scaffoldLogger } = makeLogger();

        await scaffoldExecute({ argument: [], logger: scaffoldLogger, options: { focus: "@my/app" }, runtime: {} as never, visConfig: undefined, workspaceRoot } as never);

        const { calls, logger } = makeLogger();

        await pruneExecute({ argument: [], logger, options: {}, runtime: {} as never, visConfig: undefined, workspaceRoot } as never);

        expect(callText(calls)).toMatch(/Pruned \d+ unfocused project/);
    });

    it("init writes a Dockerfile for the detected package manager", async () => {
        expect.assertions(3);

        const { logger } = makeLogger();

        await initExecute({ argument: [], logger, options: { focus: "@my/app" }, runtime: {} as never, visConfig: undefined, workspaceRoot } as never);

        const dockerfile = join(workspaceRoot, "Dockerfile");

        expect(existsSync(dockerfile)).toBe(true);

        const content = readFileSync(dockerfile, "utf8");

        expect(content).toContain("FROM node:22-slim AS base");
        // pnpm-lock.yaml present → pnpm install command
        expect(content).toContain("pnpm install --frozen-lockfile");
    });
});
