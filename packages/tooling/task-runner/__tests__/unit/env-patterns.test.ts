import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createEnvMatcher, FingerprintManager, resolveEnvPatterns } from "../../src/fingerprint";
import { InProcessTaskHasher } from "../../src/task-hasher";
import type { Task } from "../../src/types";

describe(createEnvMatcher, () => {
    it("matches exact names only when there is no wildcard", () => {
        expect.assertions(2);

        const matches = createEnvMatcher(["CI_BUILD_ID"]);

        expect(matches("CI_BUILD_ID")).toBe(true);
        expect(matches("CI_BUILD_ID_X")).toBe(false);
    });

    it("matches a trailing, leading, and infix wildcard", () => {
        expect.assertions(5);

        const matches = createEnvMatcher(["CI_*", "*_TOKEN", "AWS_*_KEY"]);

        expect(matches("CI_JOB_URL")).toBe(true);
        expect(matches("GH_TOKEN")).toBe(true);
        expect(matches("TOKEN_X")).toBe(false);
        expect(matches("AWS_ACCESS_KEY")).toBe(true);
        expect(matches("AWS_KEY")).toBe(false);
    });

    it("treats regex metacharacters in a name literally", () => {
        expect.assertions(2);

        const matches = createEnvMatcher(["A.B"]);

        expect(matches("A.B")).toBe(true);
        expect(matches("AxB")).toBe(false);
    });

    it("matches nothing for an empty pattern list", () => {
        expect.assertions(1);

        expect(createEnvMatcher([])("PATH")).toBe(false);
    });
});

describe(resolveEnvPatterns, () => {
    it("expands wildcards against the env and keeps unset exact names", () => {
        expect.assertions(1);

        const resolved = resolveEnvPatterns(["VITE_*", "*_SECRET", "NODE_ENV"], {
            DB_SECRET: "z",
            NODE_ENV: "test",
            OTHER: "no",
            VITE_MODE: "y",
            VITE_URL: "x",
        });

        expect(resolved).toStrictEqual({ DB_SECRET: "z", NODE_ENV: "test", VITE_MODE: "y", VITE_URL: "x" });
    });
});

describe(FingerprintManager, () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        // eslint-disable-next-line sonarjs/pseudo-random
        workspaceRoot = join(tmpdir(), `env-patterns-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        await mkdir(workspaceRoot, { recursive: true });
        await writeFile(join(workspaceRoot, "a.txt"), "a");
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    it("drops wildcard-matched untracked vars from the env fingerprint", async () => {
        expect.assertions(3);

        const manager = new FingerprintManager(workspaceRoot);
        const env = { CI_BUILD_ID: "1", CI_JOB_URL: "u", NODE_ENV: "production" };

        const fingerprint = await manager.createFingerprint([], "cmd", {}, env, ["CI_*", "NODE_ENV"], ["CI_*"]);

        expect(Object.keys(fingerprint.envHashes)).toStrictEqual(["NODE_ENV"]);
        expect(fingerprint.envHashes["CI_BUILD_ID"]).toBeUndefined();

        // A changed untracked value must not change the fingerprint.
        const changed = await manager.createFingerprint([], "cmd", {}, { ...env, CI_BUILD_ID: "2" }, ["CI_*", "NODE_ENV"], ["CI_*"]);

        expect(changed.envHashes).toStrictEqual(fingerprint.envHashes);
    });
});

describe("inProcessTaskHasher per-task env options", () => {
    let workspaceRoot: string;

    const task = (overrides: Partial<Task> = {}): Task => {
        return {
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
            ...overrides,
        };
    };

    beforeEach(async () => {
        // eslint-disable-next-line sonarjs/pseudo-random
        workspaceRoot = join(tmpdir(), `env-hasher-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        await mkdir(join(workspaceRoot, "packages/lib-a"), { recursive: true });
        await writeFile(join(workspaceRoot, "packages/lib-a/package.json"), '{"name":"lib-a"}');
        process.env["ENV_OPT_A"] = "1";
        process.env["ENV_OPT_TOKEN"] = "t";
        process.env["ENV_OPT_CI_RUN"] = "r";
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
        delete process.env["ENV_OPT_A"];
        delete process.env["ENV_OPT_TOKEN"];
        delete process.env["ENV_OPT_CI_RUN"];
    });

    const hasher = (options: Partial<ConstructorParameters<typeof InProcessTaskHasher>[0]> = {}): InProcessTaskHasher =>
        new InProcessTaskHasher({
            projects: { "lib-a": { root: "packages/lib-a", targets: { build: { command: "echo hi" } } } },
            workspaceRoot,
            ...options,
        });

    it("adds per-task fingerprintEnv names and wildcard patterns to the runtime key", async () => {
        expect.assertions(2);

        const details = await hasher().hashTask(task({ fingerprintEnv: ["ENV_OPT_A", "ENV_OPT_T*"] }));

        expect(details.runtime?.["env:ENV_OPT_A"]).toBeDefined();
        expect(details.runtime?.["env:ENV_OPT_TOKEN"]).toBeDefined();
    });

    it("keeps untracked auto-discovered env vars out of the key", async () => {
        expect.assertions(2);

        const details = await hasher({ autoEnvVars: true }).hashTask(
            task({
                overrides: { command: "echo $ENV_OPT_CI_RUN $ENV_OPT_A" },
                untrackedEnv: ["ENV_OPT_CI_*"],
            }),
        );

        expect(details.runtime?.["env:ENV_OPT_CI_RUN"]).toBeUndefined();
        expect(details.runtime?.["env:ENV_OPT_A"]).toBeDefined();
    });

    it("lets workspace untrackedEnvVars strip auto-discovered vars but not explicit envVars", async () => {
        expect.assertions(2);

        const details = await hasher({
            autoEnvVars: true,
            envVars: ["ENV_OPT_CI_RUN"],
            untrackedEnvVars: ["ENV_OPT_CI_*"],
        }).hashTask(task({ overrides: { command: "echo $ENV_OPT_CI_RUN" } }));

        // Explicit `envVars` entries are always hashed; the auto-discovered
        // reference is the same name, so the explicit entry must survive.
        expect(details.runtime?.["env:ENV_OPT_CI_RUN"]).toBeDefined();

        const stripped = await hasher({ autoEnvVars: true, untrackedEnvVars: ["ENV_OPT_CI_*"] }).hashTask(
            task({ overrides: { command: "echo $ENV_OPT_CI_RUN" } }),
        );

        expect(stripped.runtime?.["env:ENV_OPT_CI_RUN"]).toBeUndefined();
    });

    it("gives per-task untrackedEnv precedence over per-task fingerprintEnv", async () => {
        expect.assertions(1);

        const details = await hasher().hashTask(task({ fingerprintEnv: ["ENV_OPT_*"], untrackedEnv: ["ENV_OPT_TOKEN"] }));

        expect(details.runtime?.["env:ENV_OPT_TOKEN"]).toBeUndefined();
    });
});
