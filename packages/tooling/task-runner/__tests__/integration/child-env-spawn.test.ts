import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildChildEnv, resolveChildEnvPolicy } from "../../src/child-env";
import { runConcurrently } from "../../src/concurrent";
import type { ConcurrentCommandConfig } from "../../src/types";

// These tests spawn real child processes. The child is this Node binary
// running a script that writes its own `process.env` to a file, so the
// assertions read what the child actually received.
type SpawnKind = "default" | "js" | "pty" | "direct";

const scratchBase = realpathSync(tmpdir());

// Direct exec splits the command on whitespace, so it only works when no path
// in the command contains a space. On Windows the user profile often does.
const directExecSafe = ![process.execPath, scratchBase].some((path) => /\s/.test(path));

const kinds: { kind: SpawnKind; label: string }[] = [
    { kind: "default", label: "default spawner" },
    { kind: "js", label: "JS spawner (onEvent)" },
    { kind: "pty", label: "PTY (stdin: pty)" },
    ...(directExecSafe ? [{ kind: "direct" as const, label: "direct exec (shell: false)" }] : []),
];

// Quote for the platform shell. Plain `"…"` on purpose: JSON escaping would
// double Windows backslashes. Direct exec gets no quotes at all, since it
// splits on whitespace without a shell.
const quoteFor = (kind: SpawnKind, value: string): string => (kind === "direct" ? value : `"${value}"`);

// Environment names are case-insensitive on Windows (`Path` vs `PATH`), so
// read the child's map through a case-insensitive lookup.
const envValue = (env: Record<string, string>, name: string): string | undefined =>
    Object.entries(env).find(([key]) => key.toUpperCase() === name.toUpperCase())?.[1];

const parentNames = ["G2PROBE_UNRELATED", "G2PROBE_ALLOWED", "G2PROBE_WILD_ONE", "G2PROBE_WILD_TWO", "G2PROBE_OTHER"];

// Every case runs on each spawner: the native addon (default), the JS
// spawner (forced by `onEvent`, which is what `vis run` uses), the PTY path,
// and direct exec. Clean mode turns parent inheritance off on every one of
// them, so each spawn site is pinned.
describe.each(kinds)("child environment policy with a real spawned child: $label", ({ kind }) => {
    let scratch: string;
    let script: string;
    const savedParent: Record<string, string | undefined> = {};

    // Runs one command through the real spawner. `env` and `inheritEnv` are
    // what an executor passes; the child reports its environment.
    const childEnv = async (env: Record<string, string> | undefined, inheritEnv: boolean | undefined): Promise<Record<string, string>> => {
        const id = randomUUID();
        const out = join(scratch, `env-${id}.json`);
        const config: ConcurrentCommandConfig = {
            command: `${quoteFor(kind, process.execPath)} ${quoteFor(kind, script)} ${quoteFor(kind, out)}`,
            cwd: scratch,
            env,
            inheritEnv,
            name: `child-${id}`,
            ...(kind === "pty" ? { stdin: "pty" as const } : {}),
            ...(kind === "direct" ? { shell: false } : {}),
        };
        const result = await runConcurrently([config], kind === "js" ? { onEvent: () => undefined } : {});

        if (!result.success) {
            throw new Error(`child ${id} failed: ${JSON.stringify(result.closeEvents)}`);
        }

        return JSON.parse(readFileSync(out, "utf8")) as Record<string, string>;
    };

    beforeEach(() => {
        scratch = mkdtempSync(join(scratchBase, "tr-child-env-"));
        script = join(scratch, "dump-env.cjs");
        writeFileSync(script, 'require("node:fs").writeFileSync(process.argv[2], JSON.stringify(process.env));\n');

        for (const name of parentNames) {
            savedParent[name] = process.env[name];
        }

        process.env["G2PROBE_UNRELATED"] = "unrelated";
        process.env["G2PROBE_ALLOWED"] = "allowed";
        process.env["G2PROBE_WILD_ONE"] = "one";
        process.env["G2PROBE_WILD_TWO"] = "two";
        process.env["G2PROBE_OTHER"] = "other";
    });

    afterEach(() => {
        for (const name of parentNames) {
            if (savedParent[name] === undefined) {
                Reflect.deleteProperty(process.env, name);
            } else {
                process.env[name] = savedParent[name];
            }
        }

        rmSync(scratch, { force: true, recursive: true });
    });

    // Mirrors what an executor does with a resolved policy: clean mode builds
    // the env exactly and turns parent inheritance off; inherit mode leaves
    // the spawner's default untouched.
    const spawnUnder = (policy: ReturnType<typeof resolveChildEnvPolicy>, injected: Record<string, string> = {}) => {
        if (policy.mode === "inherit") {
            return childEnv({ ...injected }, undefined);
        }

        return childEnv(buildChildEnv({ injected, parentEnv: process.env, policy }), false);
    };

    it("inherit (the default) passes the whole parent environment", async () => {
        expect.assertions(3);

        const env = await spawnUnder(resolveChildEnvPolicy());

        expect(env["G2PROBE_UNRELATED"]).toBe("unrelated");
        expect(env["G2PROBE_OTHER"]).toBe("other");
        expect(envValue(env, "PATH")?.endsWith(envValue(process.env as Record<string, string>, "PATH") ?? "")).toBe(true);
    });

    it("clean mode strips an unrelated parent variable and keeps PATH", async () => {
        expect.assertions(2);

        const env = await spawnUnder(resolveChildEnvPolicy({ mode: "clean" }));

        expect(env).not.toHaveProperty("G2PROBE_UNRELATED");
        // The spawner prepends the workspace `node_modules/.bin` chain to PATH,
        // so the parent value is the suffix rather than the whole value.
        expect(envValue(env, "PATH")?.endsWith(envValue(process.env as Record<string, string>, "PATH") ?? "")).toBe(true);
    });

    it("clean mode keeps a named allow-list variable and nothing else from that group", async () => {
        expect.assertions(3);

        const env = await spawnUnder(resolveChildEnvPolicy({ allow: ["G2PROBE_ALLOWED"], mode: "clean" }));

        expect(env["G2PROBE_ALLOWED"]).toBe("allowed");
        expect(env).not.toHaveProperty("G2PROBE_UNRELATED");
        expect(env).not.toHaveProperty("G2PROBE_WILD_ONE");
    });

    it("clean mode expands wildcard allow-list patterns", async () => {
        expect.assertions(3);

        const env = await spawnUnder(resolveChildEnvPolicy({ allow: ["G2PROBE_WILD_*"], mode: "clean" }));

        expect(env["G2PROBE_WILD_ONE"]).toBe("one");
        expect(env["G2PROBE_WILD_TWO"]).toBe("two");
        expect(env).not.toHaveProperty("G2PROBE_OTHER");
    });

    it("keeps injected VIS_* / VIS_ARG_* / service variables under clean mode", async () => {
        expect.assertions(4);

        const injected = {
            G2_SERVICE_URL: "http://localhost:4000",
            INIT_CWD: scratch,
            VIS_ARG_MODE: "fast",
            VIS_TASK_SLOTS: "3",
        };
        const env = await spawnUnder(resolveChildEnvPolicy({ mode: "clean" }), injected);

        expect(env["VIS_TASK_SLOTS"]).toBe("3");
        expect(env["VIS_ARG_MODE"]).toBe("fast");
        expect(env["G2_SERVICE_URL"]).toBe("http://localhost:4000");
        expect(env).not.toHaveProperty("G2PROBE_UNRELATED");
    });

    it("a target can opt out of a clean workspace", async () => {
        expect.assertions(2);

        const workspace = { allow: [], mode: "clean" } as const;

        const cleanEnv = await spawnUnder(resolveChildEnvPolicy(workspace));
        const optedOutEnv = await spawnUnder(resolveChildEnvPolicy(workspace, { mode: "inherit" }));

        expect(cleanEnv).not.toHaveProperty("G2PROBE_UNRELATED");
        expect(optedOutEnv["G2PROBE_UNRELATED"]).toBe("unrelated");
    });

    it("a target can add allowed names to an inherit workspace", async () => {
        expect.assertions(2);

        const env = await spawnUnder(resolveChildEnvPolicy({ mode: "inherit" }, { allow: ["G2PROBE_ALLOWED"], mode: "clean" }));

        expect(env["G2PROBE_ALLOWED"]).toBe("allowed");
        expect(env).not.toHaveProperty("G2PROBE_UNRELATED");
    });

    it("a target's allow-list adds to the workspace allow-list", async () => {
        expect.assertions(2);

        const env = await spawnUnder(resolveChildEnvPolicy({ allow: ["G2PROBE_ALLOWED"], mode: "clean" }, { allow: ["G2PROBE_OTHER"], mode: "clean" }));

        expect(env["G2PROBE_ALLOWED"]).toBe("allowed");
        expect(env["G2PROBE_OTHER"]).toBe("other");
    });
});
