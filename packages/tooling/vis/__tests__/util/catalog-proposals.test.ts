import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyCatalogProposals, proposeCatalogAdditions, renderCatalogProposalsDiff } from "../../src/util/catalog-proposals";
import { iterateWorkspaceDeps } from "../../src/util/workspace-deps";

let workspaceRoot: string;

const writeJson = (path: string, data: unknown): void => {
    mkdirSync(join(workspaceRoot, path, ".."), { recursive: true });
    writeFileSync(join(workspaceRoot, path), `${JSON.stringify(data, null, 2)}\n`);
};

const writeFile = (path: string, content: string): void => {
    mkdirSync(join(workspaceRoot, path, ".."), { recursive: true });
    writeFileSync(join(workspaceRoot, path), content);
};

describe("catalog-proposals", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-catalog-proposals-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    describe(proposeCatalogAdditions, () => {
        it("proposes deps when ≥min packages agree on the same specifier", () => {
            expect.assertions(2);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/a/package.json", { dependencies: { react: "^18.2.0" }, name: "a" });
            writeJson("packages/b/package.json", { dependencies: { react: "^18.2.0" }, name: "b" });
            writeJson("packages/c/package.json", { dependencies: { react: "^18.2.0" }, name: "c" });

            const proposals = proposeCatalogAdditions(iterateWorkspaceDeps(workspaceRoot), { min: 3 });

            expect(proposals).toHaveLength(1);
            expect(proposals[0]).toMatchObject({ catalogName: "default", depName: "react", instanceCount: 3, specifier: "^18.2.0" });
        });

        it("ignores deps already pinned in any catalog", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/a/package.json", { dependencies: { react: "^18.2.0" }, name: "a" });
            writeJson("packages/b/package.json", { dependencies: { react: "^18.2.0" }, name: "b" });
            writeJson("packages/c/package.json", { dependencies: { react: "^18.2.0" }, name: "c" });

            const catalogs = new Map([["default", new Map([["react", "^18.2.0"]])]]);
            const proposals = proposeCatalogAdditions(iterateWorkspaceDeps(workspaceRoot), { catalogs, min: 3 });

            expect(proposals).toStrictEqual([]);
        });

        it("ignores deps where any package uses a catalog: reference (mid-migration)", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/a/package.json", { dependencies: { react: "^18.2.0" }, name: "a" });
            writeJson("packages/b/package.json", { dependencies: { react: "^18.2.0" }, name: "b" });
            writeJson("packages/c/package.json", { dependencies: { react: "catalog:" }, name: "c" });

            const proposals = proposeCatalogAdditions(iterateWorkspaceDeps(workspaceRoot), { min: 2 });

            expect(proposals).toStrictEqual([]);
        });

        it("picks the most-common specifier when there's drift but consensus", () => {
            expect.assertions(2);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/a/package.json", { dependencies: { react: "^18.2.0" }, name: "a" });
            writeJson("packages/b/package.json", { dependencies: { react: "^18.2.0" }, name: "b" });
            writeJson("packages/c/package.json", { dependencies: { react: "^18.2.0" }, name: "c" });
            writeJson("packages/d/package.json", { dependencies: { react: "^17.0.0" }, name: "d" });

            const proposals = proposeCatalogAdditions(iterateWorkspaceDeps(workspaceRoot), { min: 3 });

            expect(proposals).toHaveLength(1);
            expect(proposals[0]?.specifier).toBe("^18.2.0");
        });

        it("ignores deps that don't reach min consensus", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/a/package.json", { dependencies: { react: "^18.0.0" }, name: "a" });
            writeJson("packages/b/package.json", { dependencies: { react: "^17.0.0" }, name: "b" });

            const proposals = proposeCatalogAdditions(iterateWorkspaceDeps(workspaceRoot), { min: 2 });

            expect(proposals).toStrictEqual([]);
        });

        it("respects ignoreDeps", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/a/package.json", { dependencies: { lodash: "4.17.21", react: "^18.2.0" }, name: "a" });
            writeJson("packages/b/package.json", { dependencies: { lodash: "4.17.21", react: "^18.2.0" }, name: "b" });
            writeJson("packages/c/package.json", { dependencies: { lodash: "4.17.21", react: "^18.2.0" }, name: "c" });

            const proposals = proposeCatalogAdditions(iterateWorkspaceDeps(workspaceRoot), { ignoreDeps: ["lodash"], min: 3 });

            expect(proposals.map((p) => p.depName)).toStrictEqual(["react"]);
        });

        it("returns proposals sorted by depName for deterministic output", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/a/package.json", { dependencies: { react: "^18.0.0", vue: "^3.0.0", zustand: "^4.0.0" }, name: "a" });
            writeJson("packages/b/package.json", { dependencies: { react: "^18.0.0", vue: "^3.0.0", zustand: "^4.0.0" }, name: "b" });
            writeJson("packages/c/package.json", { dependencies: { react: "^18.0.0", vue: "^3.0.0", zustand: "^4.0.0" }, name: "c" });

            const proposals = proposeCatalogAdditions(iterateWorkspaceDeps(workspaceRoot), { min: 3 });

            expect(proposals.map((p) => p.depName)).toStrictEqual(["react", "vue", "zustand"]);
        });

        it("counts distinct packages — a dep in both deps and peerDeps of one package counts once", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            // Single package declares react in both `dependencies` and `peerDependencies`.
            // Without de-dup, this would count as 2 instances and falsely cross min=2.
            writeJson("packages/a/package.json", {
                dependencies: { react: "^18.2.0" },
                name: "a",
                peerDependencies: { react: "^18.2.0" },
            });
            writeJson("packages/b/package.json", { dependencies: { react: "^17.0.0" }, name: "b" });

            const proposals = proposeCatalogAdditions(iterateWorkspaceDeps(workspaceRoot), { min: 2 });

            expect(proposals).toStrictEqual([]);
        });
    });

    describe(applyCatalogProposals, () => {
        it("appends entries to an existing catalog block", () => {
            expect.assertions(2);

            writeFile("pnpm-workspace.yaml", "packages:\n  - 'packages/*'\n\ncatalog:\n  lodash: \"4.17.21\"\n");

            const written = applyCatalogProposals(workspaceRoot, [{ catalogName: "default", depName: "react", instanceCount: 3, specifier: "^18.2.0" }]);

            expect(written).toBeDefined();

            const after = readFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "utf8");

            expect(after).toContain('react: "^18.2.0"');
        });

        it("creates a fresh catalog block when none exists", () => {
            expect.assertions(2);

            writeFile("pnpm-workspace.yaml", "packages:\n  - 'packages/*'\n");

            const written = applyCatalogProposals(workspaceRoot, [{ catalogName: "default", depName: "react", instanceCount: 3, specifier: "^18.2.0" }]);

            expect(written).toBeDefined();

            const after = readFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "utf8");

            expect(after).toContain('catalog:\n  react: "^18.2.0"');
        });

        it("doesn't duplicate entries that already exist in the catalog", () => {
            expect.assertions(2);

            writeFile("pnpm-workspace.yaml", 'catalog:\n  react: "^18.0.0"\n');

            const written = applyCatalogProposals(workspaceRoot, [{ catalogName: "default", depName: "react", instanceCount: 3, specifier: "^18.2.0" }]);

            // Nothing to write — react is already present.
            expect(written).toBeUndefined();

            const after = readFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "utf8");

            // Existing entry preserved verbatim.
            expect(after).toContain('react: "^18.0.0"');
        });

        it("preserves an existing pin even when the proposal differs (no overwrite)", () => {
            expect.assertions(2);

            // Existing catalog pins react at ^17. A drift-driven proposal asks
            // for ^18 — we should leave the pin alone and not silently change it.
            writeFile("pnpm-workspace.yaml", 'catalog:\n  react: "^17.0.0"\n');

            const written = applyCatalogProposals(workspaceRoot, [{ catalogName: "default", depName: "react", instanceCount: 3, specifier: "^18.2.0" }]);

            expect(written).toBeUndefined();

            const after = readFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "utf8");

            expect(after).toContain('react: "^17.0.0"');
        });

        it("preserves CRLF line endings when appending to an existing block", () => {
            expect.assertions(2);

            writeFile("pnpm-workspace.yaml", 'catalog:\r\n  lodash: "4.17.21"\r\n');

            applyCatalogProposals(workspaceRoot, [{ catalogName: "default", depName: "react", instanceCount: 3, specifier: "^18.2.0" }]);

            const after = readFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "utf8");

            expect(after).toContain('react: "^18.2.0"');
            // Newly written lines must use the existing CRLF style.
            expect(after).toContain('react: "^18.2.0"\r\n');
        });

        it("appends to a tab-indented catalog block (entries still use 2-space indent)", () => {
            expect.assertions(1);

            // Some users author YAML with tabs. We don't try to match the
            // existing indent style — additions always use 2 spaces, which
            // YAML accepts as a valid block layout.
            writeFile("pnpm-workspace.yaml", 'catalog:\n\tlodash: "4.17.21"\n');

            applyCatalogProposals(workspaceRoot, [{ catalogName: "default", depName: "react", instanceCount: 3, specifier: "^18.2.0" }]);

            const after = readFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "utf8");

            expect(after).toContain('  react: "^18.2.0"');
        });
    });

    describe(renderCatalogProposalsDiff, () => {
        it("renders a diff for new entries when no catalog block exists", () => {
            expect.assertions(2);

            writeFile("pnpm-workspace.yaml", "packages:\n  - 'packages/*'\n");

            const diff = renderCatalogProposalsDiff(workspaceRoot, [{ catalogName: "default", depName: "react", instanceCount: 3, specifier: "^18.2.0" }]);

            expect(diff).toContain("+catalog:");
            expect(diff).toContain('+  react: "^18.2.0"');
        });

        it("renders a diff for additions to an existing catalog block", () => {
            expect.assertions(1);

            writeFile("pnpm-workspace.yaml", 'catalog:\n  lodash: "4.17.21"\n');

            const diff = renderCatalogProposalsDiff(workspaceRoot, [{ catalogName: "default", depName: "react", instanceCount: 3, specifier: "^18.2.0" }]);

            expect(diff).toContain('+  react: "^18.2.0"');
        });

        it("returns empty string for empty proposals", () => {
            expect.assertions(1);

            expect(renderCatalogProposalsDiff(workspaceRoot, [])).toBe("");
        });
    });
});
