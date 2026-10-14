import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import doctorExecute from "../../../src/commands/doctor/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

const logger = { debug: () => undefined, error: () => undefined, info: () => undefined, warn: () => undefined };

// A freshly created workspace has a workspace file but no lockfile and no packageManager field yet.
// `vis doctor` is the command people run to find out what is missing, so it must report, not crash.
describe("vis doctor in a workspace without a lockfile", () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-doctor-bare-");
        writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));
        mkdirSync(join(workspaceRoot, "packages", "app"), { recursive: true });
        writeFileSync(join(workspaceRoot, "packages", "app", "package.json"), JSON.stringify({ name: "@my/app" }));
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("does not throw 'Could not find a package manager'", async () => {
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
