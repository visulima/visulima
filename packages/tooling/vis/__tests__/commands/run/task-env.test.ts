import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
    cleanChildNameFilter,
    composeTaskEnv,
    effectiveChildEnvPolicy,
    taskSpawnOptions,
    VIS_PARENT_ENV_EXEMPT,
    VIS_PARENT_ENV_NAMES,
    VIS_TASK_INJECTED_NAMES,
} from "../../../src/commands/run/task-env";

// Source roots scanned for `process.env` writes. A write in any of these is a
// variable every child inherits under `inherit`, so under `clean` it must be
// allowed (or explicitly exempt, with a reason).
const SCAN_ROOTS: Record<string, string> = {
    cerebro: fileURLToPath(new URL("../../../../../terminal/cerebro/src", import.meta.url)),
    "task-runner": fileURLToPath(new URL("../../../../task-runner/src", import.meta.url)),
    vis: fileURLToPath(new URL("../../../src", import.meta.url)),
};

// `process.env.X = …`, `process.env["X"] = …`, or `process.env[expr] = …`.
// `==` and `===` do not match.
const ASSIGNMENT = /process\.env(?:\.([A-Za-z_]\w*)|\[\s*"([A-Za-z_]\w*)"\s*\]|\[([^\]]+)\])\s*=(?!=)/gu;

const walk = (directory: string): string[] => {
    const files: string[] = [];

    for (const entry of readdirSync(directory)) {
        if (entry === "__tests__" || entry === "node_modules" || entry === "dist") {
            continue;
        }

        const path = `${directory}/${entry}`;

        if (statSync(path).isDirectory()) {
            files.push(...walk(path));
        } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
            files.push(path);
        }
    }

    return files;
};

interface Assignment {
    dynamic: boolean;
    file: string;
    name: string;
}

const findAssignments = (): Assignment[] => {
    const found: Assignment[] = [];

    for (const [label, root] of Object.entries(SCAN_ROOTS)) {
        for (const file of walk(root)) {
            const source = readFileSync(file, "utf8");
            const relative = `${label}:${file.slice(root.length + 1)}`;

            for (const match of source.matchAll(ASSIGNMENT)) {
                const staticName = match[1] ?? match[2];

                found.push({
                    dynamic: staticName === undefined,
                    file: relative,
                    name: staticName ?? match[3] ?? "",
                });
            }
        }
    }

    return found;
};

describe("vis run injected and parent environment", () => {
    it("every process.env write in the source is allowed under clean mode or exempt", () => {
        expect.assertions(2);

        const assignments = findAssignments();

        // The scan has to find real writes, or it would pass for the wrong reason.
        expect(assignments.some((assignment) => assignment.name === "VIS_VERSION")).toBe(true);

        const allowed = cleanChildNameFilter([]);
        const unlisted = assignments
            .filter((assignment) => {
                if (assignment.dynamic) {
                    // Names known only at runtime: the file must carry a reason.
                    return !(assignment.file.slice(assignment.file.indexOf(":") + 1) in VIS_PARENT_ENV_EXEMPT);
                }

                const fileKey = assignment.file.slice(assignment.file.indexOf(":") + 1);

                return !allowed(assignment.name) && !(assignment.name in VIS_PARENT_ENV_EXEMPT) && !(fileKey in VIS_PARENT_ENV_EXEMPT);
            })
            .map((assignment) => `${assignment.file}: process.env[${assignment.dynamic ? "<dynamic>" : assignment.name}]`);

        // A new write fails here: add its name to VIS_PARENT_ENV_NAMES (so clean
        // mode keeps it) or to VIS_PARENT_ENV_EXEMPT with the reason it is safe.
        expect(unlisted).toStrictEqual([]);
    });

    it("never replaces or merges the whole process.env, which would bypass the name list", () => {
        expect.assertions(1);

        const wholeEnvWrite = /Object\.assign\(process\.env\b|process\.env\s*=(?!=)/u;
        const offending = Object.values(SCAN_ROOTS)
            .flatMap((root) => walk(root))
            .filter((file) => wholeEnvWrite.test(readFileSync(file, "utf8")));

        expect(offending).toStrictEqual([]);
    });

    it("keeps every name vis lists as a parent variable under clean mode", () => {
        expect.assertions(1);

        const keep = cleanChildNameFilter([]);

        expect(VIS_PARENT_ENV_NAMES.map((pattern) => keep(pattern.replaceAll("*", "SUFFIX")))).toStrictEqual(VIS_PARENT_ENV_NAMES.map(() => true));
    });

    it("keeps every injected name, and a clean env is a superset of the injected set", () => {
        expect.assertions(3);

        const injected = composeTaskEnv({
            affectedFilesEnv: { VIS_AFFECTED_FILES: "src/a.ts" },
            envFileVars: { G2_FROM_ENVFILE: "file" },
            execEnv: { G2_EXEC: "exec" },
            initCwd: "/workspace",
            serviceEnv: { G2_SERVICE_URL: "http://localhost:4000" },
            taskArgEnv: { VIS_ARG_MODE: "prod" },
            taskSlots: 3,
        });

        process.env["G2_UNRELATED"] = "parent";

        const clean = taskSpawnOptions(effectiveChildEnvPolicy(undefined, { mode: "clean" }), injected, "linux").env;

        Reflect.deleteProperty(process.env, "G2_UNRELATED");

        expect(Object.keys(injected).map((name) => clean[name])).toStrictEqual(Object.values(injected));
        // Every name the table documents is really set by the composer.
        expect(Object.keys(VIS_TASK_INJECTED_NAMES).filter((name) => !(name in injected))).toStrictEqual([]);
        expect(clean).not.toHaveProperty("G2_UNRELATED");
    });

    it("adds the vis parent names to a clean policy only, so hashing and spawning see the same names", () => {
        expect.assertions(3);

        expect(effectiveChildEnvPolicy(undefined, { mode: "inherit" })).toStrictEqual({ allow: [], mode: "inherit" });
        expect(effectiveChildEnvPolicy({ allow: ["NODE_ENV"], mode: "clean" })).toStrictEqual({
            allow: ["NODE_ENV", ...VIS_PARENT_ENV_NAMES],
            mode: "clean",
        });
        expect(effectiveChildEnvPolicy(undefined, { mode: "clean" }).allow).toStrictEqual([...VIS_PARENT_ENV_NAMES]);
    });

    it("builds a Windows clean spawn from the Windows names, folding Path against PATH", () => {
        expect.assertions(6);

        // Set the names as Windows holds them in process.env, and restore them after.
        const names = ["Path", "SystemRoot", "TMPDIR"];
        const saved = new Map(names.map((name) => [name, process.env[name]]));

        process.env["Path"] = String.raw`C:\bin`;
        process.env["SystemRoot"] = String.raw`C:\Windows`;
        process.env["TMPDIR"] = "/tmp";

        try {
            const spawn = taskSpawnOptions(effectiveChildEnvPolicy(undefined, { mode: "clean" }), { PATH: String.raw`C:\injected` }, "win32");

            expect(spawn.inheritEnv).toBe(false);
            expect(spawn.env).toHaveProperty("SystemRoot", String.raw`C:\Windows`);
            // The injected PATH replaces the parent's Path: one variable, not two.
            expect(spawn.env).toHaveProperty("PATH", String.raw`C:\injected`);
            expect(spawn.env).not.toHaveProperty("Path");
            // TMPDIR is a POSIX essential, so the Windows policy drops it.
            expect(spawn.env).not.toHaveProperty("TMPDIR");
            expect(cleanChildNameFilter([], "win32")("Path")).toBe(true);
        } finally {
            for (const name of names) {
                const value = saved.get(name);

                if (value === undefined) {
                    Reflect.deleteProperty(process.env, name);
                } else {
                    process.env[name] = value;
                }
            }
        }
    });
});
