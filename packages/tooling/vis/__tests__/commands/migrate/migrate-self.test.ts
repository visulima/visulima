import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { migrateSelf, rewriteSource } from "../../../src/commands/migrate/self";
import { createMigrationReport } from "../../../src/commands/migrate/types";

const createMockLogger = () => {
    const messages: { level: string; text: string }[] = [];

    return {
        all: () => messages,
        info: (text: string) => messages.push({ level: "info", text }),
        warn: (text: string) => messages.push({ level: "warn", text }),
    };
};

describe("vis migrate self", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(realpathSync(tmpdir()), "vis-migrate-self-"));
    });

    afterEach(() => {
        rmSync(tmpDir, { force: true, recursive: true });
    });

    describe("rewriteSource", () => {
        it("rewrites targetDefaults → tasks at object-key positions", () => {
            expect.assertions(2);

            const source = "export default { targetDefaults: { build: { cache: true } } };";
            const { applied, output } = rewriteSource(source, [
                { description: "targetDefaults → tasks", next: "tasks", previous: "targetDefaults" },
            ]);

            expect(output).toContain("tasks: { build: { cache: true } }");
            expect(applied).toHaveLength(1);
        });

        it("rewrites quoted keys too", () => {
            expect.assertions(1);

            const source = `export default { "targetDefaults": { build: {} } };`;
            const { output } = rewriteSource(source, [
                { description: "targetDefaults → tasks", next: "tasks", previous: "targetDefaults" },
            ]);

            expect(output).toContain(`"tasks": { build: {} }`);
        });

        it("does not rewrite occurrences inside string values", () => {
            expect.assertions(1);

            const source = `export default { description: "see targetDefaults docs" };`;
            const { applied } = rewriteSource(source, [
                { description: "targetDefaults → tasks", next: "tasks", previous: "targetDefaults" },
            ]);

            expect(applied).toHaveLength(0);
        });
    });

    describe("migrateSelf", () => {
        it("rewrites a vis.config.ts in place and creates a .bak", () => {
            expect.assertions(4);

            const configPath = join(tmpDir, "vis.config.ts");

            writeFileSync(
                configPath,
                "export default {\n    targetDefaults: { build: { cache: true } },\n    taskRunnerOptions: { parallel: 4 },\n};\n",
            );

            const report = createMigrationReport();

            migrateSelf(tmpDir, {}, createMockLogger(), report);

            const updated = readFileSync(configPath, "utf8");

            expect(updated).toContain("tasks: { build:");
            expect(updated).toContain("taskRunner: { parallel:");
            expect(updated).not.toMatch(/\btargetDefaults\b/u);
            expect(existsSync(`${configPath}.bak`)).toBe(true);
        });

        it("dry-run does not write to disk", () => {
            expect.assertions(2);

            const configPath = join(tmpDir, "vis.config.ts");
            const original = "export default {\n    targetDefaults: { build: { cache: true } },\n};\n";

            writeFileSync(configPath, original);

            const report = createMigrationReport();

            migrateSelf(tmpDir, { dryRun: true }, createMockLogger(), report);

            expect(readFileSync(configPath, "utf8")).toBe(original);
            expect(existsSync(`${configPath}.bak`)).toBe(false);
        });

        it("warns when no vis.config.ts is present", () => {
            expect.assertions(1);

            const report = createMigrationReport();

            migrateSelf(tmpDir, {}, createMockLogger(), report);

            expect(report.warnings.some((w) => w.includes("No vis.config"))).toBe(true);
        });

        it("rewrites scopedTasks inner `scope` and `targets` keys", () => {
            expect.assertions(2);

            const configPath = join(tmpDir, "vis.config.ts");

            writeFileSync(
                configPath,
                `export default {\n    taskDefaults: [{ scope: { tags: ["app"] }, targets: { build: { cache: true } } }],\n};\n`,
            );

            migrateSelf(tmpDir, {}, createMockLogger(), createMigrationReport());

            const updated = readFileSync(configPath, "utf8");

            expect(updated).toContain("scopedTasks:");
            expect(updated).toContain("match:");
        });

        it("discovers and rewrites nested vis.task.ts overlays", () => {
            expect.assertions(4);

            writeFileSync(join(tmpDir, "vis.config.ts"), "export default {};\n");

            const projectDir = join(tmpDir, "packages", "api");

            mkdirSync(projectDir, { recursive: true });

            const taskPath = join(projectDir, "vis.task.ts");

            writeFileSync(taskPath, "export default {\n    targets: { build: { cache: true } },\n};\n");

            const report = createMigrationReport();

            migrateSelf(tmpDir, {}, createMockLogger(), report);

            const updatedTask = readFileSync(taskPath, "utf8");

            expect(updatedTask).toContain("tasks:");
            expect(updatedTask).not.toMatch(/\btargets\b/u);
            expect(existsSync(`${taskPath}.bak`)).toBe(true);
            expect(report.manualSteps.some((s) => s.includes("VisTaskConfig.targets → VisTaskConfig.tasks"))).toBe(true);
        });

        it("skips node_modules when walking for vis.task.ts overlays", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "vis.config.ts"), "export default {};\n");

            const nodeModuleProject = join(tmpDir, "node_modules", "fake-pkg");

            mkdirSync(nodeModuleProject, { recursive: true });

            const taskPath = join(nodeModuleProject, "vis.task.ts");
            const originalContent = "export default {\n    targets: { build: {} },\n};\n";

            writeFileSync(taskPath, originalContent);

            migrateSelf(tmpDir, {}, createMockLogger(), createMigrationReport());

            // node_modules content should be left untouched.
            expect(readFileSync(taskPath, "utf8")).toBe(originalContent);
        });
    });
});
