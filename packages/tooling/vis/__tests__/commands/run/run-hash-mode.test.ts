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

// Two-package workspace. `@my/declared` leaves hashMode unset (defaults to
// declared); `@my/traced` configures `hashMode: "trace"` on its build target
// so we can prove config carries through and that the flag overrides it.
const seedWorkspace = (workspaceRoot: string): void => {
    writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
    writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));

    const declaredDir = join(workspaceRoot, "packages", "declared");
    const tracedDir = join(workspaceRoot, "packages", "traced");

    mkdirSync(declaredDir, { recursive: true });
    mkdirSync(tracedDir, { recursive: true });

    writeFileSync(join(declaredDir, "package.json"), JSON.stringify({ name: "@my/declared" }));
    writeFileSync(join(declaredDir, "project.json"), JSON.stringify({ targets: { build: { command: "echo declared", outputs: [] } } }));

    writeFileSync(join(tracedDir, "package.json"), JSON.stringify({ name: "@my/traced" }));
    writeFileSync(
        join(tracedDir, "project.json"),
        JSON.stringify({ targets: { build: { command: "echo traced", hashMode: "trace", outputs: [] } } }),
    );
};

const collectInfoText = (calls: LoggerCall[]): string =>
    calls
        .filter((c) => c[0] === "info")
        .map((c) => c.slice(1).join(" "))
        .join("\n");

describe("vis run --hash-mode", () => {
    let workspaceRoot: string;
    let originalPath: string | undefined;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-run-hash-mode-");
        originalPath = process.env["PATH"];

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

    it("rejects an invalid --hash-mode value", async () => {
        expect.assertions(1);

        const { logger } = makeLogger();

        await expect(
            runExecute({
                argument: ["build"],
                logger,
                options: { cache: false, dryRun: true, hashMode: "bogus", parallel: 1, skipToolchain: true },
                runtime: {} as never,
                visConfig: undefined,
                workspaceRoot,
            } as never),
        ).rejects.toThrow("--hash-mode must be one of: declared, trace");
    });

    it("carries a target's configured hashMode onto the directly-run task", async () => {
        expect.assertions(2);

        const { calls, logger } = makeLogger();

        await runExecute({
            argument: ["build"],
            logger,
            options: { cache: false, dryRun: true, parallel: 1, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = collectInfoText(calls);

        // The configured target is traced; the unconfigured one is not.
        expect(text).toContain("@my/traced:build (trace)");
        expect(text).not.toContain("@my/declared:build (trace)");
    });

    it("forces trace mode on every requested task when --hash-mode=trace", async () => {
        expect.assertions(2);

        const { calls, logger } = makeLogger();

        await runExecute({
            argument: ["build"],
            logger,
            options: { cache: false, dryRun: true, hashMode: "trace", parallel: 1, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = collectInfoText(calls);

        expect(text).toContain("@my/declared:build (trace)");
        expect(text).toContain("@my/traced:build (trace)");
    });

    it("overrides a configured trace target back to declared when --hash-mode=declared", async () => {
        expect.assertions(1);

        const { calls, logger } = makeLogger();

        await runExecute({
            argument: ["build"],
            logger,
            options: { cache: false, dryRun: true, hashMode: "declared", parallel: 1, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = collectInfoText(calls);

        // The flag wins over the target's `hashMode: "trace"` config.
        expect(text).not.toContain("(trace)");
    });
});
