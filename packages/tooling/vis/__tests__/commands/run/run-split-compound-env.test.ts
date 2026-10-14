import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { pickChildParentEnv } from "@visulima/task-runner";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import runExecute from "../../../src/commands/run/handler";
import { effectiveChildEnvPolicy, VIS_TASK_INJECTED_NAMES } from "../../../src/commands/run/task-env";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

const logger = { debug: () => undefined, error: () => undefined, info: () => undefined, warn: () => undefined };

const PARENT_VAR = "G3G2_PARENT_ONLY";
const ALLOWED_VAR = "G3G2_ALLOWED";

// The two segments write their whole environment to their own file, so each one's
// environment can be read on its own.
const seedWorkspace = (workspaceRoot: string): void => {
    writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
    writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));

    const packageDir = join(workspaceRoot, "packages", "app");

    mkdirSync(packageDir, { recursive: true });
    writeFileSync(join(packageDir, "package.json"), JSON.stringify({ name: "@my/app" }));

    for (const segment of ["a", "b"]) {
        writeFileSync(
            join(packageDir, `dump-${segment}.cjs`),
            `require("node:fs").writeFileSync(${JSON.stringify(join(workspaceRoot, `env-${segment}.json`))}, JSON.stringify(process.env));\n`,
        );
    }

    writeFileSync(
        join(packageDir, "project.json"),
        JSON.stringify({
            targets: {
                build: {
                    command: "node dump-a.cjs && node dump-b.cjs",
                    options: { env: { allow: [ALLOWED_VAR], mode: "clean" } },
                    outputs: [],
                    splitCompound: true,
                },
            },
        }),
    );
};

describe("vis run splitCompound under a clean environment", () => {
    let workspaceRoot: string;
    const saved = { ...process.env };

    const segmentEnv = (segment: "a" | "b"): Record<string, string> =>
        JSON.parse(readFileSync(join(workspaceRoot, `env-${segment}.json`), "utf8")) as Record<string, string>;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-run-split-env-");
        seedWorkspace(workspaceRoot);

        process.env[PARENT_VAR] = "parent";
        process.env[ALLOWED_VAR] = "allowed";
    });

    afterEach(() => {
        process.env = { ...saved };
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("gives each segment exactly the clean names, the injected names and the shell's own, and no parent name", async () => {
        expect.assertions(9);

        await runExecute({
            argument: ["build"],
            logger,
            options: { cache: false, parallel: 1, preflight: false, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        // Every name a segment may see: what the policy keeps from the parent, what vis
        // injects, and what the shell and the spawner add on top.
        const allowed = new Set([
            ...Object.keys(pickChildParentEnv(process.env, effectiveChildEnvPolicy(undefined, { allow: [ALLOWED_VAR], mode: "clean" }))),
            ...Object.keys(VIS_TASK_INJECTED_NAMES),
            "_",
            "FORCE_COLOR",
            "OLDPWD",
            "PWD",
            "SHLVL",
            // macOS: CoreFoundation sets this in every Node process whose parent lacks it.
            ...(process.platform === "darwin" ? ["__CF_USER_TEXT_ENCODING"] : []),
        ]);

        for (const segment of ["a", "b"] as const) {
            const env = segmentEnv(segment);

            expect(env[ALLOWED_VAR], `segment ${segment} allowed`).toBe("allowed");
            expect(env, `segment ${segment} parent`).not.toHaveProperty(PARENT_VAR);
            expect(Object.keys(env).filter((name) => !allowed.has(name)), `segment ${segment} leaked names`).toStrictEqual([]);
        }

        // The injected names reach the later segment too, not only the first.
        expect(segmentEnv("b")["VIS_TASK_SLOTS"]).toBe("1");
        expect(segmentEnv("b")["INIT_CWD"]).toBeDefined();
        expect(segmentEnv("b")[ALLOWED_VAR]).toBe("allowed");
    });
});
