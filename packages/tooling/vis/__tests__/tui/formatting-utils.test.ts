import type { Task } from "@visulima/task-runner";
import { describe, expect, it } from "vitest";

import { formatFlags, formatTargetsAndProjects } from "../../src/tui/formatting-utils";

const createTask = (project: string, target: string): Task => {
    return {
        id: `${project}:${target}`,
        outputs: [],
        overrides: {},
        target: { project, target },
    };
};

describe("tui/formatting-utils", () => {
    describe(formatFlags, () => {
        it("should format a simple string flag", () => {
            expect.assertions(1);

            expect(formatFlags("  ", "verbose", "true")).toBe("  --verbose=true");
        });

        it("should format a numeric flag", () => {
            expect.assertions(1);

            expect(formatFlags("", "parallel", 5)).toBe("--parallel=5");
        });

        it("should format an array flag", () => {
            expect.assertions(1);

            expect(formatFlags("", "projects", ["a", "b"])).toBe("--projects=[a,b]");
        });

        it("should format an object flag as JSON", () => {
            expect.assertions(1);

            const result = formatFlags("", "config", { key: "val" });

            expect(result).toBe("--config={\"key\":\"val\"}");
        });

        it("should format positional arguments (underscore flag)", () => {
            expect.assertions(1);

            expect(formatFlags("  ", "_", ["build", "test"])).toBe("  build test");
        });

        it("should apply left padding", () => {
            expect.assertions(1);

            expect(formatFlags("    ", "flag", "val")).toBe("    --flag=val");
        });
    });

    describe(formatTargetsAndProjects, () => {
        it("should format single target and single project", () => {
            expect.assertions(1);

            const tasks = [createTask("my-app", "build")];
            const result = formatTargetsAndProjects(["my-app"], ["build"], tasks);

            expect(result).toBe("target build for project my-app");
        });

        it("should format single target with multiple projects", () => {
            expect.assertions(1);

            const tasks = [createTask("app-a", "build"), createTask("app-b", "build"), createTask("app-c", "build")];
            const result = formatTargetsAndProjects(["app-a", "app-b", "app-c"], ["build"], tasks);

            expect(result).toBe("target build for 3 projects");
        });

        it("should format multiple targets", () => {
            expect.assertions(1);

            const tasks = [createTask("app-a", "build"), createTask("app-a", "test")];
            const result = formatTargetsAndProjects(["app-a"], ["build", "test"], tasks);

            expect(result).toBe("targets build, test for project app-a");
        });

        it("should show dependent tasks count", () => {
            // 2 requested tasks + 1 dependency task
            expect.assertions(1);

            const tasks = [createTask("app-a", "build"), createTask("app-b", "build"), createTask("lib-c", "build")];
            const result = formatTargetsAndProjects(["app-a", "app-b"], ["build"], tasks);

            expect(result).toContain("and 1 task it depends on");
        });

        it("should pluralize dependent tasks", () => {
            expect.assertions(1);

            const tasks = [createTask("app-a", "build"), createTask("lib-b", "build"), createTask("lib-c", "build"), createTask("lib-d", "build")];
            const result = formatTargetsAndProjects(["app-a"], ["build"], tasks);

            expect(result).toContain("and 3 tasks they depend on");
        });

        it("should handle no dependent tasks", () => {
            expect.assertions(1);

            const tasks = [createTask("app-a", "build")];
            const result = formatTargetsAndProjects(["app-a"], ["build"], tasks);

            expect(result).not.toContain("depend");
        });
    });
});
