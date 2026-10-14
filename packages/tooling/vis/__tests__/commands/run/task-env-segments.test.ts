import type { Task } from "@visulima/task-runner";
import { describe, expect, it } from "vitest";

import { createTaskSpawnContext, resolveTaskSpawn } from "../../../src/commands/run/task-env";

const target = (id: string, segment?: { count: number; index: number }): Task => {
    return {
        id,
        outputs: [],
        overrides: { command: "node dump.cjs" },
        projectRoot: "packages/app",
        target: { project: "app", target: "build" },
        ...(segment === undefined ? {} : { segment }),
    };
};

const context = createTaskSpawnContext({
    childEnvPolicy: () => {
        return { allow: ["PATH"], mode: "clean" };
    },
    initCwd: "/workspace",
    serviceEnvByTaskId: new Map([["app:build", { BUILD_SERVICE_URL: "https://svc" }]]),
    taskSlots: 2,
    workspaceRoot: "/workspace",
});

describe("resolveTaskSpawn service env for a splitCompound segment", () => {
    it("gives each segment the service env of the target it runs in place of", () => {
        expect.assertions(3);

        expect(resolveTaskSpawn(context, target("app:build#1", { count: 2, index: 1 })).env["BUILD_SERVICE_URL"]).toBe("https://svc");
        expect(resolveTaskSpawn(context, target("app:build#2", { count: 2, index: 2 })).env["BUILD_SERVICE_URL"]).toBe("https://svc");
        expect(resolveTaskSpawn(context, target("app:test#1", { count: 2, index: 1 })).env["BUILD_SERVICE_URL"]).toBeUndefined();
    });
});
