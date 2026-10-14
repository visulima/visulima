import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import runExecute from "../../../src/commands/run/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

const logger = { debug: () => undefined, error: () => undefined, info: () => undefined, warn: () => undefined };

// A persistent target runs through its own launch path (dev servers, watchers) rather than the
// executor. Forwarded arguments must reach it exactly as they reach a normal target.
describe("vis run forwards arguments to persistent targets", () => {
    let workspaceRoot: string;
    let argvFile: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-run-persistent-args-");
        argvFile = join(workspaceRoot, "argv.json");
        writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));

        const packageDir = join(workspaceRoot, "packages", "app");

        mkdirSync(packageDir, { recursive: true });
        writeFileSync(join(packageDir, "package.json"), JSON.stringify({ name: "@my/app" }));
        writeFileSync(join(packageDir, "record.cjs"), `require("node:fs").writeFileSync(${JSON.stringify(argvFile)}, JSON.stringify(process.argv.slice(2)));\n`);
        writeFileSync(
            join(packageDir, "project.json"),
            JSON.stringify({ targets: { serve: { command: "node record.cjs", options: { persistent: true }, outputs: [] } } }),
        );
    });

    afterEach(() => {
        rmSync(argvFile, { force: true });
        cleanupTemporaryDirectory(workspaceRoot);
    });

    const run = async (argument: string[]): Promise<string[]> => {
        await runExecute({
            argument,
            logger,
            options: { cache: false, parallel: 1, preflight: false, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        return JSON.parse(readFileSync(argvFile, "utf8")) as string[];
    };

    it("appends the forwarded arguments to the persistent command", async () => {
        expect.assertions(1);

        await expect(run(["serve", "--port", "4000"])).resolves.toStrictEqual(["--port", "4000"]);
    });

    it("passes nothing extra when no arguments are forwarded", async () => {
        expect.assertions(1);

        await expect(run(["serve"])).resolves.toStrictEqual([]);
    });
});
