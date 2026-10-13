import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Task } from "@visulima/task-runner";
import { describe, expect, it } from "vitest";

import {
    buildCleanTaskEnv,
    cleanChildNameFilter,
    composeTaskEnv,
    findTrackedCleanTasks,
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

const task = (id: string, extra: Partial<Task> = {}): Task => {
    return {
        id,
        outputs: [],
        overrides: {},
        target: { project: "app", target: id.split(":").pop() ?? id },
        ...extra,
    };
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

        expect(VIS_PARENT_ENV_NAMES.map((pattern) => keep(pattern.replace("*", "SUFFIX")))).toStrictEqual(VIS_PARENT_ENV_NAMES.map(() => true));
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

        const clean = buildCleanTaskEnv({ allow: [], injected, parentEnv: { G2_UNRELATED: "parent", PATH: "/bin" } });

        expect(Object.keys(injected).map((name) => clean[name])).toStrictEqual(Object.values(injected));
        // Every name the table documents is really set by the composer.
        expect(Object.keys(VIS_TASK_INJECTED_NAMES).filter((name) => !(name in injected))).toStrictEqual([]);
        expect(clean).not.toHaveProperty("G2_UNRELATED");
    });

    it("selects a task for the tracked-path refusal only when it is clean and would be tracked", () => {
        expect.assertions(2);

        const tasks = [
            task("app:declared"),
            task("app:traced", { hashMode: "trace" }),
            task("app:always", { always: true }),
            task("app:inherit-trace", { hashMode: "trace" }),
        ];
        const policyFor = (candidate: Task) =>
            (candidate.id === "app:inherit-trace" ? { allow: [], mode: "inherit" as const } : { allow: [], mode: "clean" as const });

        // Without autoFingerprint only the trace-mode clean task is tracked.
        expect(findTrackedCleanTasks(tasks, { autoFingerprint: false, policyFor })).toStrictEqual(["app:traced"]);
        // autoFingerprint tracks every task, except always-tasks, which use the executor.
        expect(findTrackedCleanTasks(tasks, { autoFingerprint: true, policyFor })).toStrictEqual(["app:declared", "app:traced"]);
    });
});
