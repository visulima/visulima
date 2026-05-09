import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import runExecute from "../../../src/commands/run/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

/**
 * `${affected.files}` and `${changed_files | flag '--file'}` are documented
 * in `docs/guides/conditional-and-finally-tasks.mdx` and the underlying
 * expander has its own unit tests in `@visulima/task-runner`. These tests
 * pin the wiring inside `vis run` — i.e. the handler invokes
 * `expandTokensInString` with the right context (affectedFiles +
 * projectRoot) and at the right pipeline position (before forwarded args
 * and before the `affectedFiles: "args"` trailing-append).
 *
 * The pattern: each project's command is a small Node one-liner that
 * writes its own `process.argv` to a capture file. After the run, we
 * read the capture file and assert the expanded paths landed exactly
 * where the user put the token.
 */

const makeLogger = (): {
    logger: {
        debug: (...args: unknown[]) => void;
        error: (...args: unknown[]) => void;
        info: (...args: unknown[]) => void;
        warn: (...args: unknown[]) => void;
    };
} => {
    return {
        logger: {
            debug: () => undefined,
            error: () => undefined,
            info: () => undefined,
            warn: () => undefined,
        },
    };
};

const writeCaptureProject = (
    workspaceRoot: string,
    projectName: string,
    command: string,
    options?: { affectedFiles?: "args" | "both" | "env" | false },
): string => {
    const pkgDir = join(workspaceRoot, "packages", projectName);

    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: `@my/${projectName}` }));

    const targetOptions = options?.affectedFiles === undefined ? {} : { options: { affectedFiles: options.affectedFiles } };

    writeFileSync(
        join(pkgDir, "project.json"),
        JSON.stringify({
            targets: {
                lint: {
                    command,
                    outputs: [],
                    ...targetOptions,
                },
            },
        }),
    );

    return pkgDir;
};

/** Reads a capture file written by the spawned task and returns the argv list. */
const readCapture = (capturePath: string): string[] => {
    if (!existsSync(capturePath)) {
        return [];
    }

    const lines = readFileSync(capturePath, "utf8").trim().split("\n").filter(Boolean);
    const last = lines.at(-1);

    if (!last) {
        return [];
    }

    const parsed = JSON.parse(last) as string[];

    // For `node -e SCRIPT -- arg1 arg2 ...`, argv is `[nodeBinary, arg1,
    // arg2, ...]` — there is NO `[eval]` slot. Skip only the binary path.
    return parsed.slice(1);
};

describe("vis run — `${affected.files}` token expansion", () => {
    let workspaceRoot: string;
    let originalPath: string | undefined;
    let originalAffected: string | undefined;
    let capturePath: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-run-tokens-");
        originalPath = process.env["PATH"];
        originalAffected = process.env["VIS_AFFECTED_FILES"];

        // Toolchain pre-flight is opted out via skipToolchain, but keep PATH
        // narrowed defensively — matching the run-cache-hit pattern.
        const binDir = join(workspaceRoot, "bin");

        mkdirSync(binDir, { recursive: true });
        process.env["PATH"] = `${binDir}:${process.env["PATH"] ?? ""}`;

        writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));

        capturePath = join(workspaceRoot, "captured-argv.jsonl");
    });

    afterEach(() => {
        if (originalPath === undefined) {
            delete process.env["PATH"];
        } else {
            process.env["PATH"] = originalPath;
        }

        if (originalAffected === undefined) {
            delete process.env["VIS_AFFECTED_FILES"];
        } else {
            process.env["VIS_AFFECTED_FILES"] = originalAffected;
        }

        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("expands `${affected.files}` with shell-quoted paths in user-specified position", async () => {
        expect.assertions(1);

        const captureScript = "require('fs').appendFileSync(process.env.CAPTURE, JSON.stringify(process.argv) + String.fromCharCode(10))";

        writeCaptureProject(workspaceRoot, "lib", `node -e "${captureScript}" -- --quiet \${affected.files}`);

        // Affected files arrive via VIS_AFFECTED_FILES — the same env the
        // handler reads from in non-test invocations.
        process.env["VIS_AFFECTED_FILES"] = ["packages/lib/src/a.ts", "packages/lib/src/b.ts"].join("\n");
        process.env["CAPTURE"] = capturePath;

        await runExecute({
            argument: ["lint"],
            logger: makeLogger().logger,
            options: { cache: false, parallel: 1, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const argv = readCapture(capturePath);

        // After the user's `--quiet` flag we expect the two expanded paths.
        // Project-root scoping rewrites `packages/lib/src/a.ts` to `src/a.ts`.
        expect(argv).toStrictEqual(["--quiet", "src/a.ts", "src/b.ts"]);
    });

    it("expands the `flag` form `${changed_files | flag '--file'}` to one flag per file", async () => {
        expect.assertions(1);

        const captureScript = "require('fs').appendFileSync(process.env.CAPTURE, JSON.stringify(process.argv) + String.fromCharCode(10))";

        writeCaptureProject(workspaceRoot, "lib", `node -e "${captureScript}" -- \${changed_files | flag '--file'}`);

        process.env["VIS_AFFECTED_FILES"] = ["packages/lib/src/a.ts", "packages/lib/src/b.ts"].join("\n");
        process.env["CAPTURE"] = capturePath;

        await runExecute({
            argument: ["lint"],
            logger: makeLogger().logger,
            options: { cache: false, parallel: 1, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        expect(readCapture(capturePath)).toStrictEqual(["--file", "src/a.ts", "--file", "src/b.ts"]);
    });

    it("filters affected files outside the project root before expansion", async () => {
        expect.assertions(1);

        const captureScript = "require('fs').appendFileSync(process.env.CAPTURE, JSON.stringify(process.argv) + String.fromCharCode(10))";

        writeCaptureProject(workspaceRoot, "lib", `node -e "${captureScript}" -- \${affected.files}`);

        // Mix of in-project, out-of-project, and root-level files. Only the
        // in-project ones (rewritten relative to projectRoot) survive.
        process.env["VIS_AFFECTED_FILES"] = ["packages/lib/src/x.ts", "packages/other/y.ts", "README.md"].join("\n");
        process.env["CAPTURE"] = capturePath;

        await runExecute({
            argument: ["lint"],
            logger: makeLogger().logger,
            options: { cache: false, parallel: 1, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        expect(readCapture(capturePath)).toStrictEqual(["src/x.ts"]);
    });

    it("expands the token to nothing when no files match the project root", async () => {
        expect.assertions(1);

        const captureScript = "require('fs').appendFileSync(process.env.CAPTURE, JSON.stringify(process.argv) + String.fromCharCode(10))";

        writeCaptureProject(workspaceRoot, "lib", `node -e "${captureScript}" -- --done \${affected.files}`);

        // Affected files are entirely outside the project — the token
        // collapses to empty so only `--done` remains.
        process.env["VIS_AFFECTED_FILES"] = ["packages/other/y.ts"].join("\n");
        process.env["CAPTURE"] = capturePath;

        await runExecute({
            argument: ["lint"],
            logger: makeLogger().logger,
            options: { cache: false, parallel: 1, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        expect(readCapture(capturePath)).toStrictEqual(["--done"]);
    });

    it("preserves a backslash-escaped `\\${affected.files}` as a literal token", async () => {
        expect.assertions(1);

        const captureScript = "require('fs').appendFileSync(process.env.CAPTURE, JSON.stringify(process.argv) + String.fromCharCode(10))";

        // The leading backslash tells the expander to emit the literal token.
        // We wrap in single quotes so bash doesn't then try to interpret
        // `${affected.files}` as a shell variable (the dot makes it an
        // invalid identifier and bash errors with "bad substitution").
        writeCaptureProject(workspaceRoot, "lib", `node -e "${captureScript}" -- '\\\${affected.files}'`);

        process.env["VIS_AFFECTED_FILES"] = ["packages/lib/src/a.ts"].join("\n");
        process.env["CAPTURE"] = capturePath;

        await runExecute({
            argument: ["lint"],
            logger: makeLogger().logger,
            options: { cache: false, parallel: 1, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        // The expander emits the literal token; single quotes around it in
        // the command keep bash from substituting, so node's argv sees
        // `${affected.files}` verbatim.
        expect(readCapture(capturePath)).toStrictEqual(["${affected.files}"]);
    });

    it("coexists with `affectedFiles: \"args\"` — token wins explicit position, mode appends to the end", async () => {
        expect.assertions(1);

        const captureScript = "require('fs').appendFileSync(process.env.CAPTURE, JSON.stringify(process.argv) + String.fromCharCode(10))";

        // Token in the middle of the command + affectedFiles="args" forwards
        // the same paths as a trailing append. The user gets both — useful
        // when a tool needs the file list both as a positional arg AND as a
        // separate flag-driven block. Testing it here to lock the docs claim.
        writeCaptureProject(workspaceRoot, "lib", `node -e "${captureScript}" -- --check \${affected.files} --done`, { affectedFiles: "args" });

        process.env["VIS_AFFECTED_FILES"] = ["packages/lib/src/a.ts"].join("\n");
        process.env["CAPTURE"] = capturePath;

        await runExecute({
            argument: ["lint"],
            logger: makeLogger().logger,
            options: { cache: false, parallel: 1, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        // Token expands at its position; `affectedFiles: "args"` then
        // appends the workspace-relative paths after `--done`.
        expect(readCapture(capturePath)).toStrictEqual(["--check", "src/a.ts", "--done", "packages/lib/src/a.ts"]);
    });

    it("coexists with `affectedFiles: \"env\"` — token expands at position, env var still set", async () => {
        expect.assertions(2);

        // env mode injects VIS_AFFECTED_FILES without appending args, so
        // the token is the only place file paths reach the spawned argv.
        // The capture script also dumps the env var so we can assert it
        // was forwarded — the two channels are independent.
        const captureScript
            = "require('fs').appendFileSync(process.env.CAPTURE, JSON.stringify({ argv: process.argv, env: process.env.VIS_AFFECTED_FILES || '' }) + String.fromCharCode(10))";

        writeCaptureProject(workspaceRoot, "lib", `node -e "${captureScript}" -- \${affected.files}`, { affectedFiles: "env" });

        process.env["VIS_AFFECTED_FILES"] = ["packages/lib/src/a.ts", "packages/lib/src/b.ts"].join("\n");
        process.env["CAPTURE"] = capturePath;

        await runExecute({
            argument: ["lint"],
            logger: makeLogger().logger,
            options: { cache: false, parallel: 1, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const lines = readFileSync(capturePath, "utf8").trim().split("\n").filter(Boolean);
        const last = JSON.parse(lines.at(-1)!) as { argv: string[]; env: string };

        expect(last.argv.slice(1)).toStrictEqual(["src/a.ts", "src/b.ts"]);
        expect(last.env).toBe("packages/lib/src/a.ts\npackages/lib/src/b.ts");
    });

    it("forwarded args land after the expanded token, not in front of it", async () => {
        expect.assertions(1);

        const captureScript = "require('fs').appendFileSync(process.env.CAPTURE, JSON.stringify(process.argv) + String.fromCharCode(10))";

        // Pipeline order in the executor: tokens → forwarded args →
        // affectedFiles trailing append. Forwarded args (`vis run lint
        // -- --bail`) must come AFTER the token's expanded paths so the
        // user-visible `command + ${token} + -- forwarded` shape is
        // preserved.
        writeCaptureProject(workspaceRoot, "lib", `node -e "${captureScript}" -- --check \${affected.files}`);

        process.env["VIS_AFFECTED_FILES"] = ["packages/lib/src/a.ts"].join("\n");
        process.env["CAPTURE"] = capturePath;

        await runExecute({
            argument: ["lint", "--bail", "--max-warnings=0"],
            logger: makeLogger().logger,
            options: { cache: false, parallel: 1, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        expect(readCapture(capturePath)).toStrictEqual(["--check", "src/a.ts", "--bail", "--max-warnings=0"]);
    });

    it("expands multiple tokens in the same command independently", async () => {
        expect.assertions(1);

        const captureScript = "require('fs').appendFileSync(process.env.CAPTURE, JSON.stringify(process.argv) + String.fromCharCode(10))";

        // `${affected.files}` and `${changed_files}` are aliases for the
        // same source list, but the renderer treats each occurrence
        // independently. A bare token + a flag-form token together
        // exercise both substitution shapes in one pass.
        writeCaptureProject(workspaceRoot, "lib", `node -e "${captureScript}" -- \${affected.files} --separator \${changed_files | flag '--also'}`);

        process.env["VIS_AFFECTED_FILES"] = ["packages/lib/src/a.ts", "packages/lib/src/b.ts"].join("\n");
        process.env["CAPTURE"] = capturePath;

        await runExecute({
            argument: ["lint"],
            logger: makeLogger().logger,
            options: { cache: false, parallel: 1, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        expect(readCapture(capturePath)).toStrictEqual(["src/a.ts", "src/b.ts", "--separator", "--also", "src/a.ts", "--also", "src/b.ts"]);
    });

    it("varies the cache key when `${affected.files}` resolves to a different set — regression for the raw-command hash bug", async () => {
        expect.assertions(4);

        // The previous wiring put `expandTokensInString` in the executor,
        // AFTER task-runner had already hashed `task.overrides.command`.
        // Two runs with identical workspace file hashes but different
        // VIS_AFFECTED_FILES would collide on the cache key — the second
        // run replayed a stale "linted only a.ts" result. This test
        // pins the fix: expansion happens at the build site so
        // overrides.command varies per affected set.
        //
        // We use `outputs: []` + a deterministic `echo` command + a real
        // workspace so task-runner caches the result. Two cache=true
        // runs against the SAME workspace tree but DIFFERENT affected
        // sets must both come back as MISS.
        const pkgDir = join(workspaceRoot, "packages", "lib");

        mkdirSync(join(pkgDir, "src"), { recursive: true });
        writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: "@my/lib" }));
        writeFileSync(join(pkgDir, "src", "a.ts"), "export const a = 1;\n");
        writeFileSync(join(pkgDir, "src", "b.ts"), "export const b = 2;\n");

        // Token-driven command; cacheable build target so a second
        // identical run would HIT if the hash didn't include the
        // expanded form.
        writeFileSync(
            join(pkgDir, "project.json"),
            JSON.stringify({
                targets: { lint: { command: "echo affected ${affected.files}", outputs: [] } },
            }),
        );

        process.env["VIS_AFFECTED_FILES"] = "packages/lib/src/a.ts";

        await runExecute({
            argument: ["lint"],
            logger: makeLogger().logger,
            options: { cache: true, parallel: 1, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const first = JSON.parse(readFileSync(join(workspaceRoot, ".vis", "last-summary.json"), "utf8")) as {
            tasks: { cacheStatus: string; taskId: string }[];
        };

        expect(first.tasks).toHaveLength(1);
        expect(first.tasks[0]!.cacheStatus).toBe("MISS");

        // Different affected set, same workspace files. If the cache
        // hash used the raw command (unfixed), this run would HIT.
        process.env["VIS_AFFECTED_FILES"] = "packages/lib/src/b.ts";

        await runExecute({
            argument: ["lint"],
            logger: makeLogger().logger,
            options: { cache: true, parallel: 1, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const second = JSON.parse(readFileSync(join(workspaceRoot, ".vis", "last-summary.json"), "utf8")) as {
            tasks: { cacheStatus: string; taskId: string }[];
        };

        expect(second.tasks).toHaveLength(1);
        expect(second.tasks[0]!.cacheStatus).toBe("MISS");
    });
});
