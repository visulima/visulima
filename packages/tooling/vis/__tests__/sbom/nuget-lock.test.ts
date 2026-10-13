import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildNuGetSbomParts, parseNuGetLockEntries, toNuGetPurl } from "../../src/sbom/nuget";

/**
 * A packages.lock.json with two frameworks. Serilog is locked at 3.1.1 under net8.0 and 3.0.0 under net48.
 * Contoso.App.Core is a ProjectReference: its dependencies are roots even though they are not Direct.
 * Orphan is reached from nothing, so it must not appear.
 */
const LOCK = JSON.stringify({
    dependencies: {
        "net8.0": {
            "Contoso.App.Core": { dependencies: { "Newtonsoft.Json": "[13.0.1, )", Serilog: "[3.1.1, )" }, type: "Project" },
            "Microsoft.Extensions.Logging": { resolved: "8.0.0", type: "Transitive" },
            "Newtonsoft.Json": { resolved: "13.0.1", type: "Direct" },
            Orphan: { resolved: "1.0.0", type: "Transitive" },
            Serilog: { dependencies: { "Microsoft.Extensions.Logging": "[8.0.0, )", Missing: "[1.0.0, )" }, resolved: "3.1.1", type: "Transitive" },
        },
        net48: {
            "Newtonsoft.Json": { resolved: "13.0.1", type: "Direct" },
            Serilog: { resolved: "3.0.0", type: "Transitive" },
        },
    },
    version: 2,
});

describe("sbom: buildNuGetSbomParts", () => {
    let root: string;

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), "vis-nuget-lock-")));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("emits one pkg:nuget component per id and version, with the reachable closure only", () => {
        expect.hasAssertions();

        writeFileSync(join(root, "packages.lock.json"), LOCK);

        const { components } = buildNuGetSbomParts(root);
        const refs = components.map((component) => component["bom-ref"]);

        expect(refs).toStrictEqual([
            toNuGetPurl("Microsoft.Extensions.Logging", "8.0.0"),
            toNuGetPurl("Newtonsoft.Json", "13.0.1"),
            toNuGetPurl("Serilog", "3.0.0"),
            toNuGetPurl("Serilog", "3.1.1"),
        ]);
        expect(new Set(refs).size).toBe(refs.length);
        expect(refs.join(" ")).toContain("pkg:nuget/");
        expect(refs.join(" ")).not.toContain("Orphan");
        expect(refs.join(" ")).not.toContain("Contoso.App.Core");
    });

    it("links each package to the dependency its own framework locked, and drops unresolved names", () => {
        expect.hasAssertions();

        writeFileSync(join(root, "packages.lock.json"), LOCK);

        const { dependencies } = buildNuGetSbomParts(root);
        const serilog = dependencies.find((dep) => dep.ref === toNuGetPurl("Serilog", "3.1.1"));

        expect(serilog).toStrictEqual({ dependsOn: [toNuGetPurl("Microsoft.Extensions.Logging", "8.0.0")], ref: toNuGetPurl("Serilog", "3.1.1") });
        expect(dependencies.find((dep) => dep.ref === toNuGetPurl("Serilog", "3.0.0"))).toStrictEqual({ ref: toNuGetPurl("Serilog", "3.0.0") });
    });

    it("treats every package as a root when the lock has no Direct or Project marks", () => {
        expect.hasAssertions();

        const entries = parseNuGetLockEntries(JSON.stringify({ dependencies: { "net8.0": { Lonely: { resolved: "2.0.0", type: "Transitive" } } } }));

        expect(entries).toStrictEqual([{ deps: [], member: true, name: "Lonely", version: "2.0.0" }]);
    });

    it("returns empty parts without a lock file, or for unreadable JSON", () => {
        expect.hasAssertions();

        expect(buildNuGetSbomParts(root)).toStrictEqual({ components: [], dependencies: [] });

        writeFileSync(join(root, "packages.lock.json"), "{ not json");

        expect(buildNuGetSbomParts(root)).toStrictEqual({ components: [], dependencies: [] });
    });
});
