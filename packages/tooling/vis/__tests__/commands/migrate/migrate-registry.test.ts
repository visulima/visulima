import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildProbeContext, getApplicableMigrations, MIGRATIONS } from "../../../src/commands/migrate/registry";

const createTemporaryDirectory = (): { cleanup: () => void; root: string } => {
    const root = mkdtempSync(join(tmpdir(), "vis-migrate-registry-test-"));

    return {
        cleanup: () => {
            rmSync(root, { force: true, recursive: true });
        },
        root,
    };
};

const findEntry = (id: string) => {
    const entry = MIGRATIONS.find((migration) => migration.id === id);

    if (!entry) {
        throw new Error(`Missing migration entry for id "${id}"`);
    }

    return entry;
};

describe("migrate registry", () => {
    let sandbox: { cleanup: () => void; root: string };

    beforeEach(() => {
        sandbox = createTemporaryDirectory();
    });

    afterEach(() => {
        sandbox.cleanup();
    });

    describe("registry shape", () => {
        it("exposes a stable set of migration ids matching the nested cerebro commands", () => {
            expect.assertions(1);

            const ids = MIGRATIONS.map((entry) => entry.id).sort();

            // Keep in sync with migrateCommands in commands/migrate/index.ts (minus "verify",
            // which is a read-only audit and not surfaced in the TUI).
            expect(ids).toStrictEqual(["deps", "gitleaks", "kingfisher", "lint-staged", "moon", "nano-staged", "nx", "secretlint", "turborepo"]);
        });

        it("gives every entry a non-empty title and description", () => {
            expect.assertions(18);

            for (const entry of MIGRATIONS) {
                expect(entry.title.length).toBeGreaterThan(0);
                expect(entry.description.length).toBeGreaterThan(0);
            }
        });
    });

    describe("detect", () => {
        it("detects no applicable migrations in an empty directory", () => {
            expect.assertions(1);

            writeFileSync(join(sandbox.root, "package.json"), JSON.stringify({ name: "tmp" }));

            const context = buildProbeContext(sandbox.root, {});
            const applicable = getApplicableMigrations(context);

            expect(applicable).toStrictEqual([]);
        });

        it("detects `deps` when package.json has husky in scripts", () => {
            expect.assertions(2);

            writeFileSync(
                join(sandbox.root, "package.json"),
                JSON.stringify({
                    devDependencies: { husky: "^9.0.0" },
                    name: "tmp",
                    scripts: { prepare: "husky install" },
                }),
            );

            const context = buildProbeContext(sandbox.root, {});
            const applicable = getApplicableMigrations(context);
            const ids = applicable.map((entry) => entry.id);

            expect(ids).toContain("deps");
            // `deps` detection must NOT light up unrelated migrations.
            expect(ids).not.toContain("turborepo");
        });

        it("detects `deps` purely via vis overrides even with no husky/lint-staged artifacts", () => {
            expect.assertions(1);

            writeFileSync(join(sandbox.root, "package.json"), JSON.stringify({ name: "tmp" }));

            const context = buildProbeContext(sandbox.root, { overrides: { "left-pad": "1.3.0" } });
            const ids = getApplicableMigrations(context).map((entry) => entry.id);

            expect(ids).toContain("deps");
        });

        it("detects `lint-staged` via a package.json `lint-staged` key", () => {
            expect.assertions(1);

            writeFileSync(
                join(sandbox.root, "package.json"),
                JSON.stringify({
                    "lint-staged": { "*.ts": ["eslint --fix"] },
                    name: "tmp",
                }),
            );

            const ids = getApplicableMigrations(buildProbeContext(sandbox.root, {})).map((entry) => entry.id);

            expect(ids).toContain("lint-staged");
        });

        it("detects `turborepo` via turbo.json", () => {
            expect.assertions(1);

            writeFileSync(join(sandbox.root, "package.json"), JSON.stringify({ name: "tmp" }));
            writeFileSync(join(sandbox.root, "turbo.json"), JSON.stringify({ pipeline: {} }));

            const ids = getApplicableMigrations(buildProbeContext(sandbox.root, {})).map((entry) => entry.id);

            expect(ids).toContain("turborepo");
        });

        it("detects `nx` via nx.json", () => {
            expect.assertions(1);

            writeFileSync(join(sandbox.root, "package.json"), JSON.stringify({ name: "tmp" }));
            writeFileSync(join(sandbox.root, "nx.json"), JSON.stringify({ targetDefaults: {} }));

            const ids = getApplicableMigrations(buildProbeContext(sandbox.root, {})).map((entry) => entry.id);

            expect(ids).toContain("nx");
        });

        it("detects `moon` via a .moon directory", () => {
            expect.assertions(1);

            writeFileSync(join(sandbox.root, "package.json"), JSON.stringify({ name: "tmp" }));
            mkdirSync(join(sandbox.root, ".moon"));

            const ids = getApplicableMigrations(buildProbeContext(sandbox.root, {})).map((entry) => entry.id);

            expect(ids).toContain("moon");
        });

        it("detects `secretlint` via .secretlintrc.json", () => {
            expect.assertions(1);

            writeFileSync(join(sandbox.root, "package.json"), JSON.stringify({ name: "tmp" }));
            writeFileSync(join(sandbox.root, ".secretlintrc.json"), JSON.stringify({ rules: [] }));

            const ids = getApplicableMigrations(buildProbeContext(sandbox.root, {})).map((entry) => entry.id);

            expect(ids).toContain("secretlint");
        });
    });

    describe("probe", () => {
        it("returns dry-run preview lines without mutating the filesystem", () => {
            expect.assertions(3);

            const packageJsonPath = join(sandbox.root, "package.json");
            const originalPackageJson = JSON.stringify({
                devDependencies: { "lint-staged": "^15.0.0" },
                name: "tmp",
                scripts: { precommit: "lint-staged" },
            });

            writeFileSync(packageJsonPath, originalPackageJson);

            const preview = findEntry("deps").probe(buildProbeContext(sandbox.root, {}));

            expect(preview.length).toBeGreaterThan(0);
            expect(preview.some((line) => line.startsWith("[dry-run]"))).toBe(true);
            // deps probe must not actually edit package.json in dry-run mode.
            expect(readFileSync(packageJsonPath, "utf8")).toBe(originalPackageJson);
        });

        it("produces a dry-run preview for lint-staged when a config is present", () => {
            expect.assertions(2);

            writeFileSync(
                join(sandbox.root, "package.json"),
                JSON.stringify({
                    "lint-staged": { "*.ts": ["eslint --fix"] },
                    name: "tmp",
                }),
            );

            const preview = findEntry("lint-staged").probe(buildProbeContext(sandbox.root, {}));

            expect(preview.length).toBeGreaterThan(0);
            expect(preview.some((line) => line.includes("staged config"))).toBe(true);
        });
    });
});
