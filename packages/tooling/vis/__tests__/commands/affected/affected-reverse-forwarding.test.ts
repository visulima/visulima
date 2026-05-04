import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import affectedExecute from "../../../src/commands/affected/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

interface RunCommandCall {
    argv: string[];
    name: string;
}

const makeLogger = () => {
    return {
        debug: () => undefined,
        error: () => undefined,
        info: () => undefined,
        warn: () => undefined,
    };
};

const makeRuntime = (calls: RunCommandCall[]) => {
    return {
        runCommand: async (name: string, opts: { argv: string[] }): Promise<void> => {
            calls.push({ argv: opts.argv, name });
        },
    };
};

const git = (cwd: string, args: string[]): void => {
    execFileSync("git", args, { cwd, stdio: "ignore" });
};

const seedGitWorkspace = (workspaceRoot: string): void => {
    writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
    writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));

    const libDir = join(workspaceRoot, "packages", "lib");

    mkdirSync(libDir, { recursive: true });
    writeFileSync(join(libDir, "package.json"), JSON.stringify({ name: "@my/lib" }));
    writeFileSync(
        join(libDir, "project.json"),
        JSON.stringify({ targets: { destroy: { command: "echo destroy lib" } } }),
    );

    git(workspaceRoot, ["init", "-q"]);
    git(workspaceRoot, ["config", "user.email", "test@example.com"]);
    git(workspaceRoot, ["config", "user.name", "Test"]);
    git(workspaceRoot, ["config", "commit.gpgsign", "false"]);
    git(workspaceRoot, ["add", "-A"]);
    git(workspaceRoot, ["commit", "-q", "-m", "initial"]);

    // Second commit so HEAD~1..HEAD diffs produce an affected project.
    writeFileSync(join(libDir, "src.ts"), "export const x = 1;");
    git(workspaceRoot, ["add", "-A"]);
    git(workspaceRoot, ["commit", "-q", "-m", "feat"]);
};

describe("vis affected --reverse → run forwarding", () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-affected-reverse-");
        seedGitWorkspace(workspaceRoot);
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("forwards --reverse to the underlying `vis run` invocation", async () => {
        expect.assertions(2);

        const calls: RunCommandCall[] = [];

        await affectedExecute({
            argument: ["destroy"],
            logger: makeLogger(),
            options: { base: "HEAD~1", head: "HEAD", reverse: true },
            runtime: makeRuntime(calls) as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const runCall = calls.find((c) => c.name === "run");

        expect(runCall, "expected affected handler to delegate to `run`").toBeDefined();
        expect(runCall!.argv).toContain("--reverse");
    });

    it("omits --reverse when the flag is not set", async () => {
        expect.assertions(2);

        const calls: RunCommandCall[] = [];

        await affectedExecute({
            argument: ["destroy"],
            logger: makeLogger(),
            options: { base: "HEAD~1", head: "HEAD" },
            runtime: makeRuntime(calls) as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const runCall = calls.find((c) => c.name === "run");

        expect(runCall, "expected affected handler to delegate to `run`").toBeDefined();
        expect(runCall!.argv).not.toContain("--reverse");
    });
});
