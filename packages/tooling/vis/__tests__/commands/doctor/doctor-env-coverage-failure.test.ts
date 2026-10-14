import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import doctorExecute from "../../../src/commands/doctor/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

vi.mock(import("../../../src/commands/doctor/env-coverage"), async (importOriginal) => {
    return {
        ...(await importOriginal()),
        // Workspace discovery can throw (a project name used twice, an overlay that does not load).
        buildEnvCoveragePosture: vi.fn(async () => {
            throw new Error("discovery blew up");
        }),
    };
});

const logger = { debug: () => undefined, error: () => undefined, info: () => undefined, warn: () => undefined };

describe("vis doctor when the env coverage check fails", () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-doctor-envfail-");
        writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));
        mkdirSync(join(workspaceRoot, "packages", "app"), { recursive: true });
        writeFileSync(join(workspaceRoot, "packages", "app", "package.json"), JSON.stringify({ name: "@my/app" }));
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("still reports the other results instead of aborting", async () => {
        expect.assertions(1);

        const run = doctorExecute({
            argument: [],
            logger,
            options: { json: true, only: "runtime" },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        await expect(run).resolves.not.toThrow();
    });
});
