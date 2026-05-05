/**
 * Tests for the templates branch of `vis migrate moon`.
 *
 * Two flows:
 *   1. default — detection only; emits a manual-step line telling the
 *      user the templates already work via `vis generate`.
 *   2. `--copy-templates` — physically copies `.moon/templates/&lt;name>/`
 *      into `.vis/templates/&lt;name>/`.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { migrateMoon } from "../../../src/commands/migrate/moon";
import { createMigrationReport } from "../../../src/commands/migrate/types";

describe("moon-templates", () => {
    let workspace: string;

    const noopLogger = { error: () => {}, info: () => {}, warn: () => {} };

    beforeEach(() => {
        workspace = mkdtempSync(join(tmpdir(), "vis-migrate-moon-"));

        // Minimal `.moon/tasks.yml` so `migrateMoon` can reach the templates branch.
        mkdirSync(join(workspace, ".moon"), { recursive: true });
        writeFileSync(join(workspace, ".moon", "tasks.yml"), "tasks:\n  build:\n    command: echo build\n");
    });

    afterEach(() => {
        rmSync(workspace, { force: true, recursive: true });
    });

    const seedTemplates = (names: string[]): void => {
        for (const name of names) {
            const directory = join(workspace, ".moon", "templates", name);

            mkdirSync(directory, { recursive: true });
            writeFileSync(join(directory, "template.yml"), `title: ${name}\ndescription: x\n`);
            writeFileSync(join(directory, "payload.ts"), `// ${name} payload\n`);
        }
    };

    describe("migrateMoon — templates", () => {
        it("emits a manual-step line listing discovered templates without copying", () => {
            expect.assertions(3);

            seedTemplates(["component", "package"]);

            const report = createMigrationReport();

            migrateMoon(workspace, { dryRun: true }, noopLogger, report);

            expect(report.manualSteps.some((step) => step.includes("component") && step.includes("package"))).toBe(true);
            expect(existsSync(join(workspace, ".vis", "templates", "component"))).toBe(false);
            expect(existsSync(join(workspace, ".vis", "templates", "package"))).toBe(false);
        });

        it("does not mention templates when none exist", () => {
            expect.assertions(1);

            const report = createMigrationReport();

            migrateMoon(workspace, { dryRun: true }, noopLogger, report);

            expect(report.manualSteps.some((step) => step.includes("template"))).toBe(false);
        });

        it("copies templates when --copy-templates is set and dryRun is false", () => {
            expect.assertions(3);

            seedTemplates(["component"]);

            const report = createMigrationReport();

            migrateMoon(workspace, { copyTemplates: true, dryRun: false }, noopLogger, report);

            expect(existsSync(join(workspace, ".vis", "templates", "component", "template.yml"))).toBe(true);
            expect(readFileSync(join(workspace, ".vis", "templates", "component", "payload.ts"), "utf8")).toBe("// component payload\n");
            expect(report.manualSteps.some((step) => step.includes("Copied 1 template"))).toBe(true);
        });

        it("skips templates whose target already exists and warns", () => {
            expect.assertions(3);

            seedTemplates(["shared"]);

            const target = join(workspace, ".vis", "templates", "shared");

            mkdirSync(target, { recursive: true });
            writeFileSync(join(target, "existing.ts"), "// kept\n");

            const report = createMigrationReport();

            migrateMoon(workspace, { copyTemplates: true, dryRun: false }, noopLogger, report);

            expect(report.warnings.some((w) => w.includes('Template "shared" already exists'))).toBe(true);
            expect(readFileSync(join(target, "existing.ts"), "utf8")).toBe("// kept\n");
            expect(existsSync(join(target, "template.yml"))).toBe(false);
        });
    });
});
