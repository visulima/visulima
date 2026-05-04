import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import runExecute from "../../../src/commands/run/handler";
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

// Two-package workspace where `@my/app` depends on `@my/lib` via the
// `^build` chain. Forward order is lib → app; reversed should flip it.
const seedWorkspace = (workspaceRoot: string): void => {
    writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
    writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));

    const appDir = join(workspaceRoot, "packages", "app");
    const libDir = join(workspaceRoot, "packages", "lib");

    mkdirSync(appDir, { recursive: true });
    mkdirSync(libDir, { recursive: true });

    writeFileSync(
        join(appDir, "package.json"),
        JSON.stringify({ dependencies: { "@my/lib": "*" }, name: "@my/app", scripts: { build: "echo app" } }),
    );
    writeFileSync(
        join(appDir, "project.json"),
        JSON.stringify({ targets: { build: { command: "echo app", dependsOn: ["^build"] } } }),
    );

    writeFileSync(join(libDir, "package.json"), JSON.stringify({ name: "@my/lib", scripts: { build: "echo lib" } }));
    writeFileSync(
        join(libDir, "project.json"),
        JSON.stringify({ targets: { build: { command: "echo lib" } } }),
    );
};

describe("vis run --reverse", () => {
    let workspaceRoot: string;
    let originalPath: string | undefined;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-run-reverse-");
        originalPath = process.env["PATH"];

        // Stub PATH so toolchain preflight can't shell out to corepack/mise.
        const binDir = join(workspaceRoot, "bin");

        mkdirSync(binDir, { recursive: true });
        process.env["PATH"] = binDir;

        seedWorkspace(workspaceRoot);
    });

    afterEach(() => {
        if (originalPath === undefined) {
            delete process.env["PATH"];
        } else {
            process.env["PATH"] = originalPath;
        }

        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("prints lib before app in forward (default) dry-run order", async () => {
        expect.assertions(3);

        const { calls, logger } = makeLogger();

        await runExecute({
            argument: ["build"],
            logger,
            options: { cache: false, dryRun: true, parallel: 1, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = calls
            .filter((c) => c[0] === "info")
            .map((c) => c.slice(1).join(" "))
            .join("\n");

        expect(text).toContain("@my/app:build");
        expect(text).toContain("@my/lib:build");
        expect(text.indexOf("@my/lib:build")).toBeLessThan(text.indexOf("@my/app:build"));
    });

    it("prints app before lib when --reverse flips the graph", async () => {
        expect.assertions(3);

        const { calls, logger } = makeLogger();

        await runExecute({
            argument: ["build"],
            logger,
            options: { cache: false, dryRun: true, parallel: 1, reverse: true, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = calls
            .filter((c) => c[0] === "info")
            .map((c) => c.slice(1).join(" "))
            .join("\n");

        expect(text).toContain("@my/app:build");
        expect(text).toContain("@my/lib:build");
        // Reversed: dependent (`@my/app:build`) runs before dep (`@my/lib:build`).
        expect(text.indexOf("@my/app:build")).toBeLessThan(text.indexOf("@my/lib:build"));
    });
});
