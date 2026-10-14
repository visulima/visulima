import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import runExecute from "../../../src/commands/run/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

const logger = { debug: () => undefined, error: () => undefined, info: () => undefined, warn: () => undefined };
const KEYED = "DECLARED_ENVFILE_KEYED";

// A cached, declared target whose child gets KEYED from its env file only (the parent never has it).
// The cache key must follow the value the child actually sees.
describe("vis run keys declared targets on the child environment", () => {
    let workspaceRoot: string;
    let countFile: string;
    const saved = { ...process.env };

    const executions = (): number => {
        try {
            return readFileSync(countFile, "utf8").length;
        } catch {
            return 0;
        }
    };

    const setEnvFile = (value: string): void => {
        writeFileSync(join(workspaceRoot, "packages", "app", ".env.keyed"), `${KEYED}=${value}\n`);
    };

    const run = async (target: string): Promise<number> => {
        await runExecute({
            argument: [target],
            logger,
            options: { cache: true, cacheDir: join(workspaceRoot, ".cache"), parallel: 1, preflight: false, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        return executions();
    };

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-run-declared-envfile-");
        countFile = join(workspaceRoot, "count.txt");
        Reflect.deleteProperty(process.env, KEYED);
        writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));

        const packageDir = join(workspaceRoot, "packages", "app");

        mkdirSync(packageDir, { recursive: true });
        writeFileSync(join(packageDir, "package.json"), JSON.stringify({ name: "@my/app" }));
        writeFileSync(join(packageDir, "count.cjs"), `require("node:fs").appendFileSync(${JSON.stringify(countFile)}, "x");\n`);
        setEnvFile("one");
        writeFileSync(
            join(packageDir, "project.json"),
            JSON.stringify({
                targets: {
                    build: { cache: true, command: "node count.cjs", fingerprintEnv: [KEYED], options: { envFile: ".env.keyed" }, outputs: [] },
                    excluded: {
                        cache: true,
                        command: "node count.cjs",
                        fingerprintEnv: ["DECLARED_ENVFILE_*"],
                        options: { envFile: ".env.keyed" },
                        outputs: [],
                        untrackedEnv: [KEYED],
                    },
                    unkeyed: { cache: true, command: "node count.cjs", options: { envFile: ".env.keyed" }, outputs: [] },
                    wildcard: { cache: true, command: "node count.cjs", fingerprintEnv: ["DECLARED_ENVFILE_*"], options: { envFile: ".env.keyed" }, outputs: [] },
                },
            }),
        );
    });

    afterEach(() => {
        process.env = { ...saved };
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("re-runs when a fingerprintEnv value that only the env file defines changes", async () => {
        expect.assertions(3);

        await expect(run("build")).resolves.toBe(1);
        await expect(run("build")).resolves.toBe(1);

        setEnvFile("two");

        await expect(run("build")).resolves.toBe(2);
    });

    it("expands a fingerprintEnv wildcard against the names the env file defines", async () => {
        expect.assertions(2);

        await expect(run("wildcard")).resolves.toBe(1);

        setEnvFile("two");

        await expect(run("wildcard")).resolves.toBe(2);
    });

    it("keeps untrackedEnv names out of the key even when the env file defines them", async () => {
        expect.assertions(2);

        await expect(run("excluded")).resolves.toBe(1);

        setEnvFile("two");

        await expect(run("excluded")).resolves.toBe(1);
    });

    it("does not key a variable nobody listed, so existing keys are unchanged", async () => {
        expect.assertions(2);

        await expect(run("unkeyed")).resolves.toBe(1);

        setEnvFile("two");

        await expect(run("unkeyed")).resolves.toBe(1);
    });
});
