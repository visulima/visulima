/**
 * Tests for the pnpm-workspace catalog change-detector (changesets #1707).
 *
 * Three exports under test:
 *
 *   1. `parseCatalogs` — wraps the existing `parseCatalogs` from
 *      `catalog.ts` and remaps to a diff-friendly Map shape.
 *
 *   2. `findCatalogConsumers` — reverse-index "for each catalog dep,
 *      which packages use it?" — the input the release-plan needs to
 *      decide which consumers to cascade.
 *
 *   3. `detectCatalogChanges` — diff two snapshots; included for the
 *      orchestrator's HEAD~1 vs HEAD compare during plan assembly.
 *
 * Pure functions — no fs, no git, no parser stubbing needed.
 */

import { describe, expect, it } from "vitest";

import {
    detectCatalogChanges,
    extractCatalogRefs,
    findCatalogConsumers,
    parseCatalogs,
} from "../../../src/release/core/catalog-detector";
import type { WorkspacePackage } from "../../../src/release/types";

const mkPkg = (name: string, deps: Partial<Record<"dependencies" | "devDependencies" | "peerDependencies" | "optionalDependencies", Record<string, string>>>): WorkspacePackage => {
    return {
        dir: `/repo/${name}`,
        manifest: { name, version: "1.0.0", ...deps },
        manifestPath: `/repo/${name}/package.json`,
        name,
        private: false,
        version: "1.0.0",
    };
};

describe("catalog-detector: parseCatalogs", () => {
    it("parses an empty / undefined YAML into an empty Map", () => {
        expect(parseCatalogs(undefined).size).toBe(0);
        expect(parseCatalogs("").size).toBe(0);
    });

    it("parses the default `catalog:` block into the empty-string key", () => {
        const yaml = `
catalog:
  react: ^18.2.0
  typescript: ^5.5.0
`;

        const result = parseCatalogs(yaml);

        expect(result.get("")).toEqual({ react: "^18.2.0", typescript: "^5.5.0" });
    });

    it("parses named `catalogs.<name>` blocks into their own keys", () => {
        const yaml = `
catalogs:
  dev:
    vitest: ^2.0.0
  prod:
    react: ^18.3.0
`;

        const result = parseCatalogs(yaml);

        expect(result.get("dev")).toEqual({ vitest: "^2.0.0" });
        expect(result.get("prod")).toEqual({ react: "^18.3.0" });
    });

    it("co-exists with non-catalog top-level keys without polluting the output", () => {
        // pnpm-workspace.yaml typically carries `packages:` and other
        // unrelated blocks. parseCatalogs must ignore them.
        const yaml = `
packages:
  - "packages/*"
catalog:
  react: ^18.2.0
`;

        const result = parseCatalogs(yaml);

        expect([...result.keys()]).toEqual([""]);
        expect(result.get("")).toEqual({ react: "^18.2.0" });
    });
});

describe("catalog-detector: extractCatalogRefs", () => {
    it("extracts a single `catalog:` ref from dependencies", () => {
        const pkg = mkPkg("@scope/a", {
            dependencies: { "non-catalog": "^1.0.0", react: "catalog:" },
        });

        const refs = extractCatalogRefs(pkg);

        expect(refs).toEqual([
            { catalog: "", dep: "react", kind: "dependencies", packageName: "@scope/a" },
        ]);
    });

    it("extracts `catalog:<name>` refs and includes the catalog name", () => {
        const pkg = mkPkg("@scope/b", {
            devDependencies: { vitest: "catalog:dev" },
        });

        expect(extractCatalogRefs(pkg)).toEqual([
            { catalog: "dev", dep: "vitest", kind: "devDependencies", packageName: "@scope/b" },
        ]);
    });

    it("returns one entry per (dep, kind) pair when the same dep appears in multiple blocks", () => {
        const pkg = mkPkg("@scope/c", {
            dependencies: { react: "catalog:" },
            peerDependencies: { react: "catalog:" },
        });

        const refs = extractCatalogRefs(pkg);

        expect(refs).toHaveLength(2);
        expect(refs.map((r) => r.kind).sort()).toEqual(["dependencies", "peerDependencies"]);
    });

    it("ignores ranges that don't start with `catalog:`", () => {
        const pkg = mkPkg("@scope/d", {
            dependencies: { bar: "workspace:*", baz: "github:user/repo", foo: "^1.0.0" },
        });

        expect(extractCatalogRefs(pkg)).toEqual([]);
    });
});

describe("catalog-detector: findCatalogConsumers", () => {
    it("builds a reverse index of catalog → dep → consumers", () => {
        const catalogs = parseCatalogs(`
catalog:
  react: ^18.2.0
catalogs:
  dev:
    vitest: ^2.0.0
`);

        const packages = [
            mkPkg("@scope/a", { dependencies: { react: "catalog:" } }),
            mkPkg("@scope/b", { dependencies: { react: "catalog:" } }),
            mkPkg("@scope/c", { devDependencies: { vitest: "catalog:dev" } }),
        ];

        const index = findCatalogConsumers(packages, catalogs);

        const defaultBlock = index.get("");

        expect(defaultBlock?.get("react")?.map((c) => c.packageName).sort()).toEqual(["@scope/a", "@scope/b"]);

        const devBlock = index.get("dev");

        expect(devBlock?.get("vitest")?.map((c) => c.packageName)).toEqual(["@scope/c"]);
    });

    it("seeds an empty inner map for every catalog block present even when no consumer references it", () => {
        // Catalog block exists in YAML but no package depends on it.
        // The outer key should still be present so callers don't
        // special-case "first dep into a previously-untouched catalog".
        const catalogs = parseCatalogs(`
catalogs:
  experimental:
    new-lib: ^0.1.0
`);

        const index = findCatalogConsumers([], catalogs);

        expect(index.has("experimental")).toBe(true);
        expect(index.get("experimental")?.size).toBe(0);
    });

    it("silently skips refs that point at unknown catalog blocks", () => {
        // `catalog:typo` is a misconfiguration — the dependent package
        // is genuinely broken, but the detector shouldn't invent the
        // typo'd catalog name in the output.
        const catalogs = parseCatalogs(`
catalog:
  react: ^18.2.0
`);

        const packages = [
            mkPkg("@scope/a", { dependencies: { foo: "catalog:typo" } }),
        ];

        const index = findCatalogConsumers(packages, catalogs);

        expect(index.has("typo")).toBe(false);
    });
});

describe("catalog-detector: detectCatalogChanges", () => {
    it("returns an empty array when both snapshots are identical", () => {
        const prev = parseCatalogs(`
catalog:
  react: ^18.2.0
`);

        const next = parseCatalogs(`
catalog:
  react: ^18.2.0
`);

        expect(detectCatalogChanges(prev, next)).toEqual([]);
    });

    it("detects a version bump (both sides present, version differs)", () => {
        const prev = parseCatalogs(`
catalog:
  react: ^18.2.0
`);

        const next = parseCatalogs(`
catalog:
  react: ^18.3.0
`);

        const changes = detectCatalogChanges(prev, next);

        expect(changes).toEqual([
            { catalog: "", dep: "react", newVersion: "^18.3.0", oldVersion: "^18.2.0" },
        ]);
    });

    it("detects additions (entry in next only, oldVersion undefined)", () => {
        const prev = parseCatalogs(`
catalog:
  react: ^18.2.0
`);

        const next = parseCatalogs(`
catalog:
  react: ^18.2.0
  zod: ^3.23.0
`);

        const changes = detectCatalogChanges(prev, next);

        expect(changes).toEqual([
            { catalog: "", dep: "zod", newVersion: "^3.23.0", oldVersion: undefined },
        ]);
    });

    it("detects removals (entry in prev only, newVersion undefined)", () => {
        const prev = parseCatalogs(`
catalog:
  react: ^18.2.0
  legacy: ^1.0.0
`);

        const next = parseCatalogs(`
catalog:
  react: ^18.2.0
`);

        const changes = detectCatalogChanges(prev, next);

        expect(changes).toEqual([
            { catalog: "", dep: "legacy", newVersion: undefined, oldVersion: "^1.0.0" },
        ]);
    });

    it("detects changes inside named catalogs (catalog name preserved)", () => {
        const prev = parseCatalogs(`
catalogs:
  dev:
    vitest: ^2.0.0
`);

        const next = parseCatalogs(`
catalogs:
  dev:
    vitest: ^2.1.0
`);

        const changes = detectCatalogChanges(prev, next);

        expect(changes).toEqual([
            { catalog: "dev", dep: "vitest", newVersion: "^2.1.0", oldVersion: "^2.0.0" },
        ]);
    });

    it("detects changes across multiple catalogs in deterministic order", () => {
        // Catalog name iteration follows `next.keys()` order; within a
        // catalog deps are sorted alphabetically. Verified explicitly
        // so a future change in YAML parser iteration doesn't silently
        // shift the public output ordering.
        const prev = parseCatalogs(`
catalog:
  react: ^18.2.0
catalogs:
  dev:
    vitest: ^2.0.0
`);

        const next = parseCatalogs(`
catalog:
  react: ^18.3.0
  zod: ^3.23.0
catalogs:
  dev:
    vitest: ^2.1.0
`);

        const changes = detectCatalogChanges(prev, next);

        expect(changes.map((c) => `${c.catalog}/${c.dep}`)).toEqual(["/react", "/zod", "dev/vitest"]);
    });

    // F25: when neither snapshot carries any catalog block (the most
    // common case — most repos never use pnpm catalogs), the diff
    // walker should bail at the door rather than enumerating empty
    // maps every `buildContext` invocation.
    it("bails early with an empty result when BOTH snapshots are empty", () => {
        // Both snapshots empty — should short-circuit. The check is
        // primarily a perf bail (the regular code path would also
        // produce []), so we assert the contract: empty input → empty
        // output, no exceptions, no false-positives.
        const prev = parseCatalogs(undefined);
        const next = parseCatalogs("");

        expect(prev.size).toBe(0);
        expect(next.size).toBe(0);
        expect(detectCatalogChanges(prev, next)).toEqual([]);
    });

    it("does NOT bail when only `prev` is empty (additions still surface)", () => {
        // Adding a catalog block in `next` while `prev` was empty
        // (greenfield repo getting its first catalog) must still
        // produce the additions, not a silent no-op.
        const prev = parseCatalogs(undefined);
        const next = parseCatalogs(`
catalog:
  react: ^18.2.0
`);

        const changes = detectCatalogChanges(prev, next);

        expect(changes).toEqual([
            { catalog: "", dep: "react", newVersion: "^18.2.0", oldVersion: undefined },
        ]);
    });

    it("does NOT bail when only `next` is empty (removals still surface)", () => {
        // Deleting the catalog block entirely — every dep must
        // surface as a removal.
        const prev = parseCatalogs(`
catalog:
  react: ^18.2.0
`);
        const next = parseCatalogs(undefined);

        const changes = detectCatalogChanges(prev, next);

        expect(changes).toEqual([
            { catalog: "", dep: "react", newVersion: undefined, oldVersion: "^18.2.0" },
        ]);
    });

    it("treats an entirely-removed catalog as N removals", () => {
        const prev = parseCatalogs(`
catalog:
  react: ^18.2.0
catalogs:
  legacy:
    foo: ^1.0.0
    bar: ^2.0.0
`);

        const next = parseCatalogs(`
catalog:
  react: ^18.2.0
`);

        const changes = detectCatalogChanges(prev, next);

        expect(changes).toEqual([
            { catalog: "legacy", dep: "bar", newVersion: undefined, oldVersion: "^2.0.0" },
            { catalog: "legacy", dep: "foo", newVersion: undefined, oldVersion: "^1.0.0" },
        ]);
    });
});
