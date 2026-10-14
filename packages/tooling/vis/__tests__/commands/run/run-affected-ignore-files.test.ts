import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import runExecute from "../../../src/commands/run/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

// A pre-commit hook exports GIT_DIR / GIT_INDEX_FILE, which would point the
// fixture's `git` calls at the hook-running repo. Strip them.
for (const key of Object.keys(process.env)) {
    if (key.startsWith("GIT_")) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- key is iterated over process.env so it must be dynamic
        delete process.env[key];
    }
}

const git = (cwd: string, ...args: string[]): string =>
    execFileSync("git", ["-c", "user.email=test@example.com", "-c", "user.name=test", "-c", "commit.gpgsign=false", ...args], { cwd, encoding: "utf8" }).trim();

const silentLogger = { debug: () => undefined, error: () => undefined, info: () => undefined, warn: () => undefined };

describe("vis run --affected — paths skipped by affectedIgnore", () => {
    let workspaceRoot: string;
    let originalAffected: string | undefined;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-run-affected-ignore-");
        originalAffected = process.env["VIS_AFFECTED_FILES"];
        delete process.env["VIS_AFFECTED_FILES"];
    });

    afterEach(() => {
        if (originalAffected === undefined) {
            delete process.env["VIS_AFFECTED_FILES"];
        } else {
            process.env["VIS_AFFECTED_FILES"] = originalAffected;
        }

        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("does not forward ignored unowned paths to the task", async () => {
        expect.assertions(1);

        const capturePath = join(workspaceRoot, "captured-env.txt");
        const captureScript = join(workspaceRoot, "capture-env.js");
        const libDirectory = join(workspaceRoot, "packages", "lib");

        writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));
        writeFileSync(captureScript, "require('fs').writeFileSync(process.env.CAPTURE, process.env.VIS_AFFECTED_FILES || '');\n");
        mkdirSync(join(libDirectory, "src"), { recursive: true });
        mkdirSync(join(workspaceRoot, "plans"), { recursive: true });
        writeFileSync(join(libDirectory, "package.json"), JSON.stringify({ name: "@my/lib" }));
        writeFileSync(
            join(libDirectory, "project.json"),
            JSON.stringify({ targets: { lint: { command: `node ${JSON.stringify(captureScript)}`, options: { affectedFiles: "env" }, outputs: [] } } }),
        );
        writeFileSync(join(libDirectory, "src", "a.ts"), "export const a = 1;\n");
        writeFileSync(join(workspaceRoot, "plans", "roadmap.md"), "# v1\n");

        git(workspaceRoot, "init", "-q", "-b", "main");
        git(workspaceRoot, "add", "-A");
        git(workspaceRoot, "commit", "-q", "-m", "base");

        const base = git(workspaceRoot, "rev-parse", "HEAD");

        writeFileSync(join(libDirectory, "src", "a.ts"), "export const a = 2;\n");
        writeFileSync(join(workspaceRoot, "plans", "roadmap.md"), "# v2\n");
        git(workspaceRoot, "commit", "-q", "-am", "change");

        process.env["CAPTURE"] = capturePath;

        await runExecute({
            argument: ["lint"],
            logger: silentLogger,
            options: { affected: true, base, cache: false, head: "HEAD", parallel: 1, skipToolchain: true, uncommitted: false },
            runtime: {} as never,
            visConfig: { affectedIgnore: ["plans/**"] },
            workspaceRoot,
        } as never);

        // Without the filter `plans/roadmap.md` would reach the task as well.
        expect(existsSync(capturePath) ? readFileSync(capturePath, "utf8").split("\n") : []).toStrictEqual(["packages/lib/src/a.ts"]);
    });
});
