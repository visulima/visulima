import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Task } from "@visulima/task-runner";
import { runConcurrently } from "@visulima/task-runner";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { TaskSpawnContext } from "../../../src/commands/run/task-env";
import { createTaskSpawnContext, resolveRetrySpawn, resolveTaskSpawn } from "../../../src/commands/run/task-env";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

const ALLOWED_VAR = "VIS_RETRY_TEST_ALLOWED";
const HIDDEN_VAR = "VIS_RETRY_TEST_HIDDEN";

let workspaceRoot: string;
let projectRoot: string;
let dumpScript: string;

const createTask = (visOptions: Record<string, unknown> = {}): Task => {
    return {
        id: "app:build",
        outputs: [],
        overrides: {
            command: "node dump.cjs",
            visOptions: { envFile: ".env.test", ...visOptions },
            visTaskArgEnv: { VIS_ARG_MODE: "dev" },
        },
        projectRoot: "packages/app",
        target: { project: "app", target: "build" },
    };
};

const createContext = (childEnvPolicy: TaskSpawnContext["childEnvPolicy"]): TaskSpawnContext =>
    createTaskSpawnContext({
        childEnvPolicy,
        initCwd: workspaceRoot,
        serviceEnvByTaskId: new Map([["app:build", { RETRY_SERVICE_URL: "https://svc" }]]),
        taskSlots: 4,
        workspaceRoot,
    });

// Runs the command as a real child with the given spawn and returns the environment it saw.
const runChild = async (spawn: { cwd: string; env: Record<string, string>; inheritEnv: boolean }): Promise<Record<string, string>> => {
    const out = join(workspaceRoot, `env-${randomUUID()}.json`);

    await runConcurrently(
        [
            {
                command: `"${process.execPath}" "${dumpScript}" "${out}"`,
                cwd: spawn.cwd,
                env: spawn.env,
                inheritEnv: spawn.inheritEnv,
                name: "app:build",
            },
        ],
        { onEvent: () => undefined },
    );

    return JSON.parse(readFileSync(out, "utf8")) as Record<string, string>;
};

describe(resolveRetrySpawn, () => {
    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory();
        projectRoot = join(workspaceRoot, "packages", "app");
        mkdirSync(projectRoot, { recursive: true });
        writeFileSync(join(projectRoot, ".env.test"), "RETRY_FROM_ENVFILE=file-value\n");

        dumpScript = join(projectRoot, "dump.cjs");
        writeFileSync(dumpScript, `require("node:fs").writeFileSync(process.argv[2], JSON.stringify(process.env));\n`);
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("gives a retried child the injected variables, env file and service env of the first attempt", async () => {
        expect.assertions(1);

        const task = createTask();
        const context = createContext(() => { return { allow: [], mode: "inherit" }; });

        const seen = await runChild(resolveRetrySpawn(context, task));

        expect(seen).toMatchObject({
            INIT_CWD: workspaceRoot,
            RETRY_FROM_ENVFILE: "file-value",
            RETRY_SERVICE_URL: "https://svc",
            VIS_ARG_MODE: "dev",
            VIS_TASK_SLOTS: "4",
        });
    });

    it("returns the same spawn environment as the first attempt", () => {
        expect.assertions(3);

        const task = createTask();
        const context = createContext(() => { return { allow: [ALLOWED_VAR], mode: "clean" }; });
        const firstAttempt = resolveTaskSpawn(context, task, { cwd: projectRoot });
        const retry = resolveRetrySpawn(context, task);

        expect(retry.env).toStrictEqual(firstAttempt.env);
        expect(retry.inheritEnv).toBe(firstAttempt.inheritEnv);
        expect(retry.cwd).toBe(projectRoot);
    });

    it("keeps the clean-env policy on a retry: only allowed and injected names reach the child", async () => {
        expect.assertions(4);

        process.env[ALLOWED_VAR] = "allowed-value";
        process.env[HIDDEN_VAR] = "hidden-value";

        try {
            const task = createTask();
            const context = createContext(() => { return { allow: [ALLOWED_VAR, "PATH"], mode: "clean" }; });

            const seen = await runChild(resolveRetrySpawn(context, task));

            expect(seen[HIDDEN_VAR]).toBeUndefined();
            expect(seen[ALLOWED_VAR]).toBe("allowed-value");
            expect(seen["VIS_TASK_SLOTS"]).toBe("4");
            expect(seen["VIS_ARG_MODE"]).toBe("dev");
        } finally {
            Reflect.deleteProperty(process.env, ALLOWED_VAR);
            Reflect.deleteProperty(process.env, HIDDEN_VAR);
        }
    });

    it("runs from the workspace root only for a runFromWorkspaceRoot target, as the first attempt does", () => {
        expect.assertions(2);

        const context = createContext(() => { return { allow: [], mode: "inherit" }; });

        expect(resolveRetrySpawn(context, createTask()).cwd).toBe(projectRoot);
        expect(resolveRetrySpawn(context, createTask({ runFromWorkspaceRoot: true })).cwd).toBe(workspaceRoot);
    });

    it("builds the retry spawn with resolveRetrySpawn in the handler's retry branch", () => {
        expect.assertions(4);

        const handlerSource = readFileSync(fileURLToPath(new URL("../../../src/commands/run/handler.ts", import.meta.url)), "utf8");
        const start = handlerSource.indexOf("loopAction === \"retry\" && retryTaskId");
        const end = handlerSource.indexOf("retryTaskId = null;", start);

        expect(start).toBeGreaterThan(-1);
        expect(end).toBeGreaterThan(start);

        const retryBranch = handlerSource.slice(start, end);

        expect(retryBranch).toContain("resolveRetrySpawn(spawnContext, task)");
        expect(retryBranch).not.toContain("taskSpawnOptions(");
    });
});
