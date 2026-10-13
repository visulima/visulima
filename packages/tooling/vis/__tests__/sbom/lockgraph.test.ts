import { describe, expect, it } from "vitest";

import type { LockEntry } from "../../src/sbom/lockgraph";
import { buildLockGraph } from "../../src/sbom/lockgraph";

const purl = (name: string, version: string): string => `pkg:test/${name}@${version}`;
const normalize = (name: string): string => name;

describe("sbom: buildLockGraph", () => {
    it("qualifies two same-version packages from different sources so their bom-refs differ", () => {
        expect.hasAssertions();

        const entries: LockEntry[] = [
            { deps: [], member: false, name: "lib", source: "registry:a", version: "1.0.0" },
            { deps: [], member: false, name: "lib", source: "registry:b", version: "1.0.0" },
            { deps: [{ kind: "main", name: "lib", source: "registry:b", version: "1.0.0" }], member: true, name: "app", version: "0.1.0" },
        ];

        const { components, dependencies } = buildLockGraph(entries, { normalize, purl });
        const refs = components.map((component) => component["bom-ref"]);

        expect(new Set(refs).size).toBe(refs.length);
        expect(refs).toContain(`${purl("lib", "1.0.0")}?source=registry%3Ab`);
        expect(dependencies.find((dep) => dep.ref === "pkg:test/app@0.1.0")?.dependsOn).toStrictEqual([`${purl("lib", "1.0.0")}?source=registry%3Ab`]);
    });

    it("resolves an edge to the exact version it names when two versions are locked", () => {
        expect.hasAssertions();

        const entries: LockEntry[] = [
            { deps: [{ kind: "main", name: "log", version: "0.4.20" }], member: true, name: "app", version: "0.1.0" },
            { deps: [], member: false, name: "log", version: "0.4.20" },
            { deps: [], member: false, name: "log", version: "0.3.9" },
        ];

        const { components } = buildLockGraph(entries, { normalize, purl });

        expect(components.map((component) => component.version).sort()).toStrictEqual(["0.1.0", "0.4.20"]);
    });

    it("leaves dev edges out unless includeDev is set", () => {
        expect.hasAssertions();

        const entries: LockEntry[] = [
            { deps: [{ kind: "dev", name: "tool" }], member: true, name: "app", version: "0.1.0" },
            { deps: [], member: false, name: "tool", version: "1.0.0" },
        ];

        expect(buildLockGraph(entries, { normalize, purl }).components).toHaveLength(1);
        expect(buildLockGraph(entries, { includeDev: true, normalize, purl }).components).toHaveLength(2);
    });
});
