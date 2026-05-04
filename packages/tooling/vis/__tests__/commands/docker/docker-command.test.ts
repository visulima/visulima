import { existsSync, mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import dockerExecute from "../../../src/commands/docker/handler";
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

describe("vis docker", () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-docker-cmd-");

        writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));

        const appDir = join(workspaceRoot, "packages", "app");
        const libDir = join(workspaceRoot, "packages", "lib");

        mkdirSync(appDir, { recursive: true });
        mkdirSync(libDir, { recursive: true });

        writeFileSync(
            join(appDir, "package.json"),
            JSON.stringify({ dependencies: { "@my/lib": "*" }, name: "@my/app" }),
        );
        writeFileSync(join(libDir, "package.json"), JSON.stringify({ name: "@my/lib" }));
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("throws when subcommand is missing", async () => {
        expect.assertions(1);

        const { logger } = makeLogger();

        await expect(
            dockerExecute({
                argument: [],
                logger,
                options: {},
                runtime: {} as never,
                visConfig: undefined,
                workspaceRoot,
            } as never),
        ).rejects.toThrow(/Missing subcommand/);
    });

    it("throws when an unknown subcommand is passed", async () => {
        expect.assertions(1);

        const { logger } = makeLogger();

        await expect(
            dockerExecute({
                argument: ["wat"],
                logger,
                options: {},
                runtime: {} as never,
                visConfig: undefined,
                workspaceRoot,
            } as never),
        ).rejects.toThrow(/Unknown subcommand/);
    });

    it("scaffold throws without --focus", async () => {
        expect.assertions(1);

        const { logger } = makeLogger();

        await expect(
            dockerExecute({
                argument: ["scaffold"],
                logger,
                options: {},
                runtime: {} as never,
                visConfig: undefined,
                workspaceRoot,
            } as never),
        ).rejects.toThrow(/Missing --focus/);
    });

    it("scaffold writes the workspace context for the focus closure", async () => {
        expect.assertions(3);

        const { calls, logger } = makeLogger();

        await dockerExecute({
            argument: ["scaffold"],
            logger,
            options: { focus: "@my/app" },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const outDir = join(workspaceRoot, ".vis/docker");

        expect(existsSync(join(outDir, "workspace", "packages", "app", "package.json"))).toBe(true);
        expect(existsSync(join(outDir, "workspace", "packages", "lib", "package.json"))).toBe(true);

        const text = calls.map((c) => c.slice(1).join(" ")).join("\n");

        expect(text).toContain("Scaffolded");
    });

    it("prune logs the number of removed projects", async () => {
        expect.assertions(1);

        // Scaffold first so we have a manifest to prune against
        const { logger: scaffoldLogger } = makeLogger();

        await dockerExecute({
            argument: ["scaffold"],
            logger: scaffoldLogger,
            options: { focus: "@my/app" },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const { calls, logger } = makeLogger();

        await dockerExecute({
            argument: ["prune"],
            logger,
            options: {},
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = calls.map((c) => c.slice(1).join(" ")).join("\n");

        expect(text).toMatch(/Pruned \d+ unfocused project/);
    });
});
