import { mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import runExecute from "../../../src/commands/run/handler";
import { AFFECTED_FILES_ENV } from "../../../src/commands/run/task-env";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

const logger = { debug: () => undefined, error: () => undefined, info: () => undefined, warn: () => undefined };

// Traced targets (`hashMode: "trace"`) run through the tracked executor. Each
// spawn appends one JSON line to a log that lives outside the workspace, so the
// tracker does not record it as an input. The line says which arguments and
// which `VIS_TEST_KEYED` value the real child received. A missing line means the
// child never ran.
const seedWorkspace = (workspaceRoot: string, logFile: string): void => {
    writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
    writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));

    const packageDir = join(workspaceRoot, "packages", "app");

    mkdirSync(packageDir, { recursive: true });
    writeFileSync(join(packageDir, "package.json"), JSON.stringify({ name: "@my/app" }));
    writeEnvFile(workspaceRoot, { VIS_TEST_KEYED: "a", VIS_TEST_OTHER: "x" });
    writeFileSync(
        join(packageDir, "record.cjs"),
        [
            "const fs = require(\"node:fs\");",
            "fs.readFileSync(__filename);",
            String.raw`fs.appendFileSync(${JSON.stringify(logFile)}, JSON.stringify({ argv: process.argv.slice(2), keyed: process.env.VIS_TEST_KEYED ?? null }) + "\n");`,
            "",
        ].join("\n"),
    );
    writeFileSync(
        join(packageDir, "project.json"),
        JSON.stringify({
            targets: {
                affected: { cache: true, command: "node record.cjs", hashMode: "trace", options: { affectedFiles: "args" }, outputs: [] },
                forward: { cache: true, command: "node record.cjs", hashMode: "trace", outputs: [] },
                // The key names VIS_TEST_KEYED, which only the envFile sets.
                keyed: {
                    cache: true,
                    command: "node record.cjs",
                    fingerprintEnv: ["VIS_TEST_KEYED"],
                    hashMode: "trace",
                    options: { envFile: ".env.test" },
                    outputs: [],
                },
                // A name the clean child cannot see: keyed as unset, so a parent change is still a hit.
                "keyed-hidden": {
                    cache: true,
                    command: "node record.cjs",
                    fingerprintEnv: ["VIS_TEST_HIDDEN"],
                    hashMode: "trace",
                    options: { env: { mode: "clean" } },
                    outputs: [],
                },
                // The key names VIS_TEST_KEYED, but untrackedEnv excludes it: an envFile change is still a hit.
                "keyed-untracked": {
                    cache: true,
                    command: "node record.cjs",
                    fingerprintEnv: ["VIS_TEST_KEYED"],
                    hashMode: "trace",
                    options: { envFile: ".env.test" },
                    outputs: [],
                    untrackedEnv: ["VIS_TEST_KEYED"],
                },
                // Strict on a variable that only the envFile sets: the check reads the child env, so it passes.
                "strict-envfile": {
                    cache: true,
                    command: "node record.cjs \"$VIS_TEST_KEYED\"",
                    hashMode: "trace",
                    options: { envFile: ".env.test", strictEnv: true },
                    outputs: [],
                },
                // Strict on a variable the clean child cannot see: the check fails it before spawn.
                "strict-missing": {
                    cache: true,
                    command: "node record.cjs \"$VIS_TEST_STRICT_MISSING\"",
                    hashMode: "trace",
                    options: { strictEnv: true },
                    outputs: [],
                },
            },
        }),
    );
};

const writeEnvFile = (workspaceRoot: string, values: Record<string, string>): void => {
    const body = Object.entries(values)
        .map(([name, value]) => `${name}=${value}`)
        .join("\n");

    writeFileSync(join(workspaceRoot, "packages", "app", ".env.test"), `${body}\n`);
};

describe("vis run traced targets", () => {
    let workspaceRoot: string;
    let logFile: string;
    const saved = { ...process.env };

    // Every real spawn of the traced child appends one line.
    const spawns = (): { argv: string[]; keyed: string | null }[] => {
        try {
            return readFileSync(logFile, "utf8")
                .split("\n")
                .filter(Boolean)
                .map((line) => JSON.parse(line) as { argv: string[]; keyed: string | null });
        } catch {
            return [];
        }
    };

    const run = async (argument: string[], visConfig?: unknown): Promise<void> => {
        await runExecute({
            argument,
            logger,
            options: { cache: true, cacheDir: join(workspaceRoot, ".cache"), parallel: 1, preflight: false, skipToolchain: true },
            runtime: {} as never,
            visConfig,
            workspaceRoot,
        } as never);
    };

    beforeEach(() => {
        // The tracker reports real paths, so the workspace must be too (macOS temp dirs are symlinks).
        workspaceRoot = realpathSync(createTemporaryDirectory("vis-run-traced-parity-"));
        logFile = join(createTemporaryDirectory("vis-run-traced-log-"), "spawns.log");
        seedWorkspace(workspaceRoot, logFile);
    });

    afterEach(() => {
        process.env = { ...saved };
        rmSync(logFile, { force: true });
        cleanupTemporaryDirectory(workspaceRoot);
    });

    describe("forwarded arguments", () => {
        it("appends the forwarded arguments to the traced child command", async () => {
            expect.assertions(1);

            await run(["forward", "--flag", "value"]);

            expect(spawns().at(-1)?.argv).toStrictEqual(["--flag", "value"]);
        });

        it("a different forwarded argument is a cache miss", async () => {
            expect.assertions(2);

            await run(["forward", "--a"]);
            await run(["forward", "--a"]);

            expect(spawns()).toHaveLength(1);

            await run(["forward", "--b"]);

            expect(spawns()).toHaveLength(2);
        });
    });

    describe("affectedFiles: args", () => {
        it("appends the affected files to the traced child command", async () => {
            expect.assertions(1);

            process.env[AFFECTED_FILES_ENV] = "packages/app/a.ts\npackages/app/b.ts";

            await run(["affected"]);

            expect(spawns().at(-1)?.argv).toStrictEqual(["packages/app/a.ts", "packages/app/b.ts"]);
        });

        it("a different affected file set is a cache miss", async () => {
            expect.assertions(2);

            process.env[AFFECTED_FILES_ENV] = "packages/app/a.ts";

            await run(["affected"]);
            await run(["affected"]);

            expect(spawns()).toHaveLength(1);

            process.env[AFFECTED_FILES_ENV] = "packages/app/b.ts";

            await run(["affected"]);

            expect(spawns()).toHaveLength(2);
        });
    });

    describe("env values in the key", () => {
        it("re-runs when an envFile value that the key names changes", async () => {
            expect.assertions(3);

            await run(["keyed"]);

            expect(spawns()).toStrictEqual([{ argv: [], keyed: "a" }]);

            await run(["keyed"]);

            expect(spawns()).toHaveLength(1);

            // The `.env.test` value changed. The child now sees "b", so the traced key must change.
            writeEnvFile(workspaceRoot, { VIS_TEST_KEYED: "b", VIS_TEST_OTHER: "x" });

            await run(["keyed"]);

            expect(spawns()).toStrictEqual([
                { argv: [], keyed: "a" },
                { argv: [], keyed: "b" },
            ]);
        });

        it("does not re-run when an envFile value the key does not name changes", async () => {
            expect.assertions(2);

            await run(["keyed"]);

            writeEnvFile(workspaceRoot, { VIS_TEST_KEYED: "a", VIS_TEST_OTHER: "changed" });

            await run(["keyed"]);

            expect(spawns()).toHaveLength(1);
            expect(spawns()[0]?.keyed).toBe("a");
        });

        it("does not re-run when an untrackedEnv name changes", async () => {
            expect.assertions(2);

            await run(["keyed-untracked"]);

            writeEnvFile(workspaceRoot, { VIS_TEST_KEYED: "b", VIS_TEST_OTHER: "x" });

            await run(["keyed-untracked"]);

            expect(spawns()).toHaveLength(1);
            expect(spawns()[0]?.keyed).toBe("a");
        });

        it("keys a name hidden by the clean policy as unset, so a parent change is a hit", async () => {
            expect.assertions(2);

            process.env["VIS_TEST_HIDDEN"] = "one";

            await run(["keyed-hidden"]);

            process.env["VIS_TEST_HIDDEN"] = "two";

            await run(["keyed-hidden"]);

            expect(spawns()).toHaveLength(1);
            expect(spawns()[0]?.keyed).toBeNull();
        });
    });

    describe("strictEnv", () => {
        it("passes when the variable is set only by the envFile, because the check reads the child env", async () => {
            expect.assertions(2);

            await run(["strict-envfile"]);

            expect(spawns()).toStrictEqual([{ argv: ["a"], keyed: "a" }]);
            expect(process.env["VIS_TEST_KEYED"]).toBeUndefined();
        });

        it("fails a traced target whose command references an unset variable, before the child runs", async () => {
            expect.assertions(2);

            delete process.env["VIS_TEST_STRICT_MISSING"];

            await run(["strict-missing"]).catch(() => undefined);

            expect(spawns()).toHaveLength(0);

            process.env["VIS_TEST_STRICT_MISSING"] = "set";

            await run(["strict-missing"]);

            expect(spawns()).toHaveLength(1);
        });

        it("fails a variable the clean child cannot see, even when the parent has it", async () => {
            expect.assertions(2);

            process.env["VIS_TEST_STRICT_MISSING"] = "set";

            await run(["strict-missing"], { taskRunner: { env: { mode: "clean" } } }).catch(() => undefined);

            expect(spawns()).toHaveLength(0);

            await run(["strict-missing"]);

            expect(spawns()).toHaveLength(1);
        });
    });
});
