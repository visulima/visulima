import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildChildEnvVisible, computeGlobalEnvNamespace } from "../../src/default-task-runner";
import { InProcessTaskHasher } from "../../src/task-hasher";
import type { Task } from "../../src/types";

const NAMES = ["G2_HASH_ENVVAR", "G2_HASH_AUTO", "G2_HASH_GLOBAL"];

const task = (id: string, command?: string): Task => {
    return {
        id,
        outputs: [],
        overrides: command === undefined ? {} : { command },
        target: { project: "lib-a", target: id.split(":")[1]! },
    };
};

// Hides every name in `hidden` from the child, and keeps the rest.
const hiding = (hidden: ReadonlyArray<string>) => (name: string) => !hidden.includes(name);

// The key entry for an env name in a task's hash details.
const envEntry = async (hasher: InProcessTaskHasher, forTask: Task, name: string): Promise<string | undefined> => {
    const details = await hasher.hashTask(forTask);

    return details.runtime?.[`env:${name}`];
};

// The workspace global hash, which carries the globalEnv entries.
const globalEntry = async (hasher: InProcessTaskHasher, forTask: Task): Promise<string | undefined> => {
    const details = await hasher.hashTask(forTask);

    return details.implicitDeps?.["__global__"];
};

describe("child env visibility in the cache key", () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        // eslint-disable-next-line sonarjs/pseudo-random
        workspaceRoot = join(tmpdir(), `child-env-hash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

        await mkdir(join(workspaceRoot, "packages/lib-a"), { recursive: true });
        await writeFile(join(workspaceRoot, "packages/lib-a/package.json"), '{"name":"lib-a"}');

        for (const name of NAMES) {
            Reflect.deleteProperty(process.env, name);
        }
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });

        for (const name of NAMES) {
            Reflect.deleteProperty(process.env, name);
        }
    });

    const hasherFor = (options: { autoEnvVars?: boolean; childEnvVisible?: (name: string, task?: Task) => boolean; envVars?: string[]; globalEnv?: string[] }) =>
        new InProcessTaskHasher({
            projects: { "lib-a": { root: "packages/lib-a" } },
            workspaceRoot,
            ...options,
        });

    it("hashes an explicit envVars name by its value when the child can see it", async () => {
        expect.assertions(2);

        const hasher = hasherFor({ envVars: ["G2_HASH_ENVVAR"] });

        process.env["G2_HASH_ENVVAR"] = "one";
        const first = await envEntry(hasher, task("lib-a:build"), "G2_HASH_ENVVAR");

        process.env["G2_HASH_ENVVAR"] = "two";
        const second = await envEntry(hasher, task("lib-a:build"), "G2_HASH_ENVVAR");

        expect(first).toBeDefined();
        expect(second).not.toBe(first);
    });

    it("hashes a name the clean child cannot see as unset, so its value does not bust the key", async () => {
        expect.assertions(3);

        const hasher = hasherFor({ childEnvVisible: hiding(["G2_HASH_ENVVAR"]), envVars: ["G2_HASH_ENVVAR"] });

        process.env["G2_HASH_ENVVAR"] = "one";
        const first = await envEntry(hasher, task("lib-a:build"), "G2_HASH_ENVVAR");

        process.env["G2_HASH_ENVVAR"] = "two";
        const second = await envEntry(hasher, task("lib-a:build"), "G2_HASH_ENVVAR");

        Reflect.deleteProperty(process.env, "G2_HASH_ENVVAR");
        const unset = await envEntry(hasher, task("lib-a:build"), "G2_HASH_ENVVAR");

        expect(first).toBe(second);
        // An unset name and a hidden name both reach the child as "not set",
        // so they share one key entry.
        expect(first).toBe(unset);
        expect(first).toBeDefined();
    });

    it("drops a command-referenced name the child cannot see from autoEnvVars", async () => {
        expect.assertions(2);

        const hasher = hasherFor({ autoEnvVars: true, childEnvVisible: hiding(["G2_HASH_AUTO"]) });
        const build = task("lib-a:build", "echo $G2_HASH_AUTO");

        process.env["G2_HASH_AUTO"] = "one";
        const first = await envEntry(hasher, build, "G2_HASH_AUTO");

        process.env["G2_HASH_AUTO"] = "two";
        const second = await envEntry(hasher, build, "G2_HASH_AUTO");

        expect(first).toBeDefined();
        expect(second).toBe(first);
    });

    it("applies the visibility per task, so a target that can see the name still keys on it", async () => {
        expect.assertions(3);

        // Only `lib-a:deploy` is hidden from its child; `lib-a:build` sees the name.
        const hasher = hasherFor({
            childEnvVisible: (name, forTask) => !(forTask?.id === "lib-a:deploy" && name === "G2_HASH_ENVVAR"),
            envVars: ["G2_HASH_ENVVAR"],
        });

        process.env["G2_HASH_ENVVAR"] = "one";
        const buildOne = await envEntry(hasher, task("lib-a:build"), "G2_HASH_ENVVAR");
        const deployOne = await envEntry(hasher, task("lib-a:deploy"), "G2_HASH_ENVVAR");

        process.env["G2_HASH_ENVVAR"] = "two";
        const buildTwo = await envEntry(hasher, task("lib-a:build"), "G2_HASH_ENVVAR");
        const deployTwo = await envEntry(hasher, task("lib-a:deploy"), "G2_HASH_ENVVAR");

        expect(buildTwo).not.toBe(buildOne);
        expect(deployTwo).toBe(deployOne);
        expect(deployOne).not.toBe(buildOne);
    });

    it("hides a globalEnv name from the workspace global hash the same way", async () => {
        expect.assertions(3);

        const visible = hasherFor({ globalEnv: ["G2_HASH_GLOBAL"] });
        const hiddenHasher = hasherFor({ childEnvVisible: hiding(["G2_HASH_GLOBAL"]), globalEnv: ["G2_HASH_GLOBAL"] });

        process.env["G2_HASH_GLOBAL"] = "one";
        const hiddenOne = await globalEntry(hiddenHasher, task("lib-a:build"));
        const visibleOne = await globalEntry(visible, task("lib-a:build"));

        process.env["G2_HASH_GLOBAL"] = "two";
        const hiddenTwo = await globalEntry(hiddenHasher, task("lib-a:build"));

        expect(hiddenTwo).toBe(hiddenOne);
        expect(visibleOne).not.toBe(hiddenOne);
        expect(visibleOne).toBeDefined();
    });

    it("keeps the cache key unchanged when no visibility predicate is given", async () => {
        expect.assertions(1);

        const hasher = hasherFor({ envVars: ["G2_HASH_ENVVAR"] });

        process.env["G2_HASH_ENVVAR"] = "one";
        const first = await hasher.hashTask(task("lib-a:build"));
        const second = await hasher.hashTask(task("lib-a:build"));

        expect(second).toStrictEqual(first);
    });

    it("moves the globalEnv namespace with a visible value and not with a hidden one", () => {
        expect.assertions(3);

        process.env["G2_HASH_GLOBAL"] = "one";
        const visibleOne = computeGlobalEnvNamespace(["G2_HASH_GLOBAL"]);
        const hiddenOne = computeGlobalEnvNamespace(["G2_HASH_GLOBAL"], hiding(["G2_HASH_GLOBAL"]));

        process.env["G2_HASH_GLOBAL"] = "two";
        const visibleTwo = computeGlobalEnvNamespace(["G2_HASH_GLOBAL"]);
        const hiddenTwo = computeGlobalEnvNamespace(["G2_HASH_GLOBAL"], hiding(["G2_HASH_GLOBAL"]));

        expect(visibleTwo).not.toBe(visibleOne);
        expect(hiddenTwo).toBe(hiddenOne);
        expect(hiddenOne).not.toBe(visibleOne);
    });

    it("builds no predicate without the executor hook, so a clean workspace alone keys every name", () => {
        expect.assertions(1);

        expect(buildChildEnvVisible({ allow: [], mode: "clean" }, undefined)).toBeUndefined();
    });

    it("hides a name per task from the hook, and keeps the workspace policy for globalEnv", () => {
        expect.assertions(3);

        const visible = buildChildEnvVisible({ allow: ["G2_HASH_ENVVAR"], mode: "clean" }, (forTask) =>
            forTask.id === "lib-a:deploy" ? { allow: [], mode: "clean" } : { allow: [], mode: "inherit" });

        expect(visible?.("G2_HASH_ENVVAR", task("lib-a:deploy"))).toBe(false);
        expect(visible?.("G2_HASH_ENVVAR", task("lib-a:build"))).toBe(true);
        // No task (globalEnv): the workspace policy applies, which allow-lists the name.
        expect(visible?.("G2_HASH_ENVVAR")).toBe(true);
    });

    it("hides a global name only when no task in the run can see it", () => {
        expect.assertions(2);

        const tasks = [task("lib-a:build"), task("lib-a:open")];
        const mixed = buildChildEnvVisible(
            { allow: [], mode: "clean" },
            (forTask) => (forTask.id === "lib-a:open" ? { allow: [], mode: "inherit" } : { allow: [], mode: "clean" }),
            tasks,
        );
        const allClean = buildChildEnvVisible({ allow: [], mode: "clean" }, () => { return { allow: [], mode: "clean" }; }, tasks);

        // `lib-a:open` inherits, so it reads the name and the shared key must include it.
        expect(mixed?.("G2_HASH_GLOBAL")).toBe(true);
        expect(allClean?.("G2_HASH_GLOBAL")).toBe(false);
    });

    it("keys the shared globalEnv hash when one task in a clean run inherits the name", async () => {
        expect.assertions(2);

        const tasks = [task("lib-a:build"), task("lib-a:open")];
        const visible = buildChildEnvVisible(
            { allow: [], mode: "clean" },
            (forTask) => (forTask.id === "lib-a:open" ? { allow: [], mode: "inherit" } : { allow: [], mode: "clean" }),
            tasks,
        );

        // A fresh hasher per read: the global hash is cached per instance.
        process.env["G2_HASH_GLOBAL"] = "one";
        const first = await globalEntry(hasherFor({ childEnvVisible: visible, globalEnv: ["G2_HASH_GLOBAL"] }), task("lib-a:build"));

        process.env["G2_HASH_GLOBAL"] = "two";
        const second = await globalEntry(hasherFor({ childEnvVisible: visible, globalEnv: ["G2_HASH_GLOBAL"] }), task("lib-a:build"));

        expect(first).toBeDefined();
        expect(second).not.toBe(first);
    });
});
