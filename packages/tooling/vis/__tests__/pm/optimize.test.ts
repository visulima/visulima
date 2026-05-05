import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PmInfo } from "../../src/pm/overrides";
import { applyOverrides, readOverrides } from "../../src/pm/overrides";
import type { OptimizeEntry } from "../../src/tui/components/optimize/OptimizeStore";
import { OptimizeStore } from "../../src/tui/components/optimize/OptimizeStore";

describe("optimize", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-optimize-"));
    });

    afterEach(() => {
        rmSync(tmpDir, { force: true, recursive: true });
    });

    // ── Helpers ─────────────────────────────────────────────────────────

    const makeEntry = (overrides: Partial<OptimizeEntry> = {}): OptimizeEntry => {
        return {
            category: "native",
            hasCodemod: false,
            packageName: "test-pkg",
            replacement: "native API",
            ...overrides,
        };
    };

    const writePkgJson = (dir: string, content: Record<string, unknown>): void => {
        writeFileSync(join(dir, "package.json"), `${JSON.stringify(content, null, 2)}\n`);
    };

    // ── OptimizeStore ───────────────────────────────────────────────────

    describe(OptimizeStore, () => {
        it("should initialize with entries", () => {
            expect.assertions(3);

            const entries = [makeEntry({ packageName: "a" }), makeEntry({ category: "socket", packageName: "b" })];
            const store = new OptimizeStore(entries);
            const state = store.getSnapshot();

            expect(state.entries).toHaveLength(2);
            expect(state.checkedEntries.size).toBe(0);
            expect(state.phase).toBe("browsing");
        });

        it("should toggle check", () => {
            expect.assertions(2);

            const store = new OptimizeStore([makeEntry({ packageName: "a" })]);

            store.toggleCheck("a");

            expect(store.getSnapshot().checkedEntries.has("a")).toBe(true);

            store.toggleCheck("a");

            expect(store.getSnapshot().checkedEntries.has("a")).toBe(false);
        });

        it("should toggle all", () => {
            expect.assertions(2);

            const store = new OptimizeStore([makeEntry({ packageName: "a" }), makeEntry({ packageName: "b" })]);

            store.toggleAll();

            expect(store.getSnapshot().checkedEntries.size).toBe(2);

            store.toggleAll();

            expect(store.getSnapshot().checkedEntries.size).toBe(0);
        });

        it("should filter by category", () => {
            expect.assertions(2);

            const store = new OptimizeStore([
                makeEntry({ category: "native", packageName: "a" }),
                makeEntry({ category: "socket", packageName: "b" }),
                makeEntry({ category: "preferred", packageName: "c" }),
            ]);

            store.setFilter("native");

            expect(store.getFilteredEntries()).toHaveLength(1);

            store.setFilter("all");

            expect(store.getFilteredEntries()).toHaveLength(3);
        });

        it("should filter by text", () => {
            expect.assertions(2);

            const store = new OptimizeStore([makeEntry({ packageName: "is-regex" }), makeEntry({ packageName: "lodash" })]);

            store.setFilterText("regex");

            expect(store.getFilteredEntries()).toHaveLength(1);

            store.setFilterText("");

            expect(store.getFilteredEntries()).toHaveLength(2);
        });

        it("should clamp selected index", () => {
            expect.assertions(2);

            const store = new OptimizeStore([makeEntry({ packageName: "a" }), makeEntry({ packageName: "b" })]);

            store.select(99);

            expect(store.getSnapshot().selectedIndex).toBe(1);

            store.select(-5);

            expect(store.getSnapshot().selectedIndex).toBe(0);
        });

        it("should get checked entries", () => {
            expect.assertions(1);

            const store = new OptimizeStore([makeEntry({ packageName: "a" }), makeEntry({ packageName: "b" })]);

            store.toggleCheck("b");

            expect(store.getCheckedEntries().map((e) => e.packageName)).toStrictEqual(["b"]);
        });

        it("should subscribe and notify", () => {
            expect.assertions(1);

            const store = new OptimizeStore([makeEntry()]);
            let notified = false;

            store.subscribe(() => {
                notified = true;
            });

            store.select(0);

            expect(notified).toBe(true);
        });

        it("should unsubscribe", () => {
            expect.assertions(1);

            const store = new OptimizeStore([makeEntry()]);
            let count = 0;

            const unsub = store.subscribe(() => {
                count++;
            });

            store.select(0);
            unsub();
            store.select(0);

            expect(count).toBe(1);
        });

        it("should set phase and error", () => {
            expect.assertions(2);

            const store = new OptimizeStore([makeEntry()]);

            store.setError("something failed");

            expect(store.getSnapshot().phase).toBe("error");
            expect(store.getSnapshot().error).toBe("something failed");
        });

        it("should set progress", () => {
            expect.assertions(1);

            const store = new OptimizeStore([makeEntry()]);

            store.setProgress(5, 10);

            expect(store.getSnapshot().applyProgress).toStrictEqual({ current: 5, total: 10 });
        });

        it("should toggle all respecting current filter", () => {
            expect.assertions(2);

            const store = new OptimizeStore([makeEntry({ category: "native", packageName: "a" }), makeEntry({ category: "socket", packageName: "b" })]);

            store.setFilter("native");
            store.toggleAll();

            expect(store.getSnapshot().checkedEntries.has("a")).toBe(true);
            expect(store.getSnapshot().checkedEntries.has("b")).toBe(false);
        });
    });

    // ── Integration: pnpm v10+ workspace yaml overrides ─────────────────

    describe("pnpm v10+ workspace overrides integration", () => {
        it("should round-trip read and write overrides in pnpm-workspace.yaml", () => {
            expect.assertions(3);

            writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n\noverrides:\n  lodash: ^4.17.21\n");
            writePkgJson(tmpDir, { name: "test" });

            const pm: PmInfo = { name: "pnpm", version: "10.32.1" };

            const initial = readOverrides(tmpDir, {}, pm);

            expect(initial.overrides).toStrictEqual({ lodash: "^4.17.21" });

            const result = applyOverrides(tmpDir, join(tmpDir, "package.json"), [{ original: "express", spec: "npm:@socketregistry/express@^4" }], pm);

            expect(result.added).toStrictEqual(["express"]);

            const after = readOverrides(tmpDir, {}, pm);

            expect(after.overrides).toStrictEqual({
                express: "npm:@socketregistry/express@^4",
                lodash: "^4.17.21",
            });
        });

        it("should add overrides section to yaml when not present", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
            writePkgJson(tmpDir, { name: "test" });

            applyOverrides(tmpDir, join(tmpDir, "package.json"), [{ original: "foo", spec: "bar" }], { name: "pnpm", version: "10.32.1" });

            const yaml = readFileSync(join(tmpDir, "pnpm-workspace.yaml"), "utf8");

            expect(yaml).toContain("overrides:\n  'foo': 'bar'");
        });
    });

    // ── Integration: multi-PM override writing ──────────────────────────

    describe("multi-PM override writing", () => {
        const entries = [
            { original: "is-regex", spec: "npm:@socketregistry/is-regex@^1" },
            { original: "has-symbols", spec: "npm:@socketregistry/has-symbols@^1" },
        ];

        it("should write overrides for npm", () => {
            expect.assertions(1);

            writePkgJson(tmpDir, { name: "test" });
            applyOverrides(tmpDir, join(tmpDir, "package.json"), entries, { name: "npm", version: "10.0.0" });

            const pkg = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as Record<string, unknown>;

            expect(Object.keys(pkg.overrides as Record<string, string>)).toHaveLength(2);
        });

        it("should write resolutions for yarn", () => {
            expect.assertions(1);

            writePkgJson(tmpDir, { name: "test" });
            applyOverrides(tmpDir, join(tmpDir, "package.json"), entries, { name: "yarn", version: "4.0.0" });

            const pkg = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as Record<string, unknown>;

            expect(Object.keys(pkg.resolutions as Record<string, string>)).toHaveLength(2);
        });

        it("should write resolutions for bun", () => {
            expect.assertions(1);

            writePkgJson(tmpDir, { name: "test" });
            applyOverrides(tmpDir, join(tmpDir, "package.json"), entries, { name: "bun", version: "1.2.0" });

            const pkg = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as Record<string, unknown>;

            expect(Object.keys(pkg.resolutions as Record<string, string>)).toHaveLength(2);
        });

        it("should write pnpm.overrides for pnpm v9", () => {
            expect.assertions(1);

            writePkgJson(tmpDir, { name: "test" });
            applyOverrides(tmpDir, join(tmpDir, "package.json"), entries, { name: "pnpm", version: "9.15.0" });

            const pkg = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as Record<string, unknown>;
            const pnpm = pkg.pnpm as Record<string, unknown>;

            expect(Object.keys(pnpm.overrides as Record<string, string>)).toHaveLength(2);
        });
    });
});
