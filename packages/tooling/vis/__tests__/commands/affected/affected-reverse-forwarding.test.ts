import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import affectedExecute, { forwardedArgv } from "../../../src/commands/affected/handler";
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
    writeFileSync(join(libDir, "project.json"), JSON.stringify({ targets: { destroy: { command: "echo destroy lib" } } }));

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

describe(forwardedArgv, () => {
    it("returns every token after the command name", () => {
        expect.assertions(1);

        // Forwarding the raw tokens is the whole point: the previous
        // enumerate-each-flag approach forwarded six of `vis run`'s ~40
        // options, so `vis affected build --fail-fast` silently did nothing.
        expect(forwardedArgv(["node", "vis", "affected", "destroy", "--reverse", "--fail-fast"])).toStrictEqual([
            "destroy",
            "--reverse",
            "--fail-fast",
        ]);
    });

    it("survives global options placed before the command", () => {
        expect.assertions(1);

        expect(forwardedArgv(["node", "vis", "--cwd=/repo", "affected", "build"])).toStrictEqual(["build"]);
    });

    it("returns nothing when the command token is absent", () => {
        expect.assertions(1);

        expect(forwardedArgv(["node", "vis"])).toStrictEqual([]);
    });
});

describe("vis affected → run delegation", () => {
    let workspaceRoot: string;
    let originalArgv: string[];

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-affected-reverse-");
        seedGitWorkspace(workspaceRoot);
        originalArgv = process.argv;
    });

    afterEach(() => {
        process.argv = originalArgv;
        cleanupTemporaryDirectory(workspaceRoot);
    });

    const runAffected = async (argv: string[], options: Record<string, unknown>): Promise<RunCommandCall[]> => {
        const calls: RunCommandCall[] = [];

        process.argv = ["node", "vis", "affected", ...argv];

        await affectedExecute({
            argument: [argv[0]],
            logger: makeLogger(),
            options,
            runtime: makeRuntime(calls) as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        return calls;
    };

    it("forwards the user's flags verbatim and adds --affected", async () => {
        expect.assertions(3);

        const calls = await runAffected(["destroy", "--reverse", "--runner-tags=gpu,slow"], {});
        const runCall = calls.find((c) => c.name === "run");

        expect(runCall, "expected affected handler to delegate to `run`").toBeDefined();
        expect(runCall!.argv).toStrictEqual(["destroy", "--reverse", "--runner-tags=gpu,slow", "--affected"]);
        expect(runCall!.argv).toContain("--affected");
    });

    it("forwards a flag the old enumerate-and-forward ladder dropped", async () => {
        expect.assertions(1);

        // `--fail-fast` was never in the forwarded set, so it parsed and
        // vanished. This is the regression guard for that whole class.
        const calls = await runAffected(["destroy", "--fail-fast"], {});

        expect(calls.find((c) => c.name === "run")!.argv).toContain("--fail-fast");
    });

    it("does not double-append --affected when the user already passed it", async () => {
        expect.assertions(1);

        const calls = await runAffected(["destroy", "--affected"], {});

        expect(calls.find((c) => c.name === "run")!.argv.filter((a) => a === "--affected")).toHaveLength(1);
    });

    it("omits flags the user did not type", async () => {
        expect.assertions(2);

        const calls = await runAffected(["destroy"], {});
        const runCall = calls.find((c) => c.name === "run");

        expect(runCall!.argv).not.toContain("--reverse");
        expect(runCall!.argv.some((a) => a.startsWith("--runner-tags"))).toBe(false);
    });

    it("--sparse-checkout prints affected project roots to stdout and skips `run`", async () => {
        expect.assertions(3);

        const calls: RunCommandCall[] = [];
        const written: string[] = [];
        const originalWrite = process.stdout.write.bind(process.stdout);

        process.stdout.write = (chunk: unknown): boolean => {
            written.push(String(chunk));

            return true;
        };

        try {
            await affectedExecute({
                argument: ["build"],
                logger: makeLogger(),
                options: { base: "HEAD~1", head: "HEAD", sparseCheckout: true },
                runtime: makeRuntime(calls) as never,
                visConfig: undefined,
                workspaceRoot,
            } as never);
        } finally {
            process.stdout.write = originalWrite;
        }

        expect(
            calls.find((c) => c.name === "run"),
            "must not delegate to `run` in sparse-checkout mode",
        ).toBeUndefined();
        expect(written.join("")).toContain("packages/lib");
        // Trailing newline so the stream pipes cleanly into
        // `git sparse-checkout set --stdin`.
        expect(written.join("").endsWith("\n")).toBe(true);
    });
});
