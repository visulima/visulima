import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import runExecute from "../../../src/commands/run/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

// Pin TTY mode so the lockfile preflight (which now runs before service
// auto-attach) doesn't take a different code path under CI hosts. The
// service diagnostic path is what we're exercising — leave preflight in
// its harmless warn-and-continue mode.
vi.mock(import('is-in-ci'), () => { return { default: false }; });

const makeLogger = (): {
    calls: { args: unknown[]; level: "debug" | "error" | "info" | "warn" }[];
    logger: {
        debug: (...args: unknown[]) => void;
        error: (...args: unknown[]) => void;
        info: (...args: unknown[]) => void;
        warn: (...args: unknown[]) => void;
    };
} => {
    const calls: { args: unknown[]; level: "debug" | "error" | "info" | "warn" }[] = [];

    return {
        calls,
        logger: {
            debug: (...args) => { calls.push({ args, level: "debug" }); },
            error: (...args) => { calls.push({ args, level: "error" }); },
            info: (...args) => { calls.push({ args, level: "info" }); },
            warn: (...args) => { calls.push({ args, level: "warn" }); },
        },
    };
};

describe("vis run service-dependency error wiring", () => {
    let workspaceRoot: string;
    let originalPath: string | undefined;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-run-svc-err-");
        originalPath = process.env["PATH"];

        const binDir = join(workspaceRoot, "bin");

        mkdirSync(binDir, { recursive: true });
        process.env["PATH"] = binDir;

        writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));

        // One package, one project — `test` depends on the `db` service
        // target. With no entry in the registry, the run handler must
        // surface a diagnostic and refuse to half-execute the chain.
        const pkgDir = join(workspaceRoot, "packages", "api");

        mkdirSync(pkgDir, { recursive: true });
        writeFileSync(
            join(pkgDir, "package.json"),
            JSON.stringify({ name: "@my/api", scripts: { test: "echo testing" } }),
        );
        writeFileSync(
            join(pkgDir, "project.json"),
            JSON.stringify({
                targets: {
                    db: {
                        command: "echo db",
                        options: {
                            service: { port: 65_535, readiness: { tcp: { port: 65_535, timeoutMs: 100 } } },
                        },
                        outputs: [],
                    },
                    test: {
                        command: "echo testing",
                        dependsOn: ["db"],
                        outputs: [],
                    },
                },
            }),
        );
    });

    afterEach(() => {
        if (originalPath === undefined) {
            delete process.env["PATH"];
        } else {
            process.env["PATH"] = originalPath;
        }

        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("aborts with an actionable diagnostic when a service dep is not running", async () => {
        expect.assertions(2);

        const { calls, logger } = makeLogger();

        await expect(
            runExecute({
                argument: ["test"],
                logger,
                options: { cache: true, parallel: 1, preflight: false, skipToolchain: true },
                runtime: {} as never,
                visConfig: undefined,
                workspaceRoot,
            } as never),
        ).rejects.toThrow(/service dependency error/);

        // The handler should have logged the per-target diagnostic
        // before throwing the aggregate error — the message tells the
        // operator how to recover.
        const errorCall = calls.find((c) => c.level === "error" && typeof c.args[0] === "string" && (c.args[0]).includes("vis service start"));

        expect(errorCall).toBeDefined();
    });
});
