import { describe, expect, it } from "vitest";

import { buildCycloneDxVulnerabilities, emitCycloneDxVex } from "../../src/report/cyclonedx-vex";
import type { SecurityVulnerability } from "../../src/security/advisories";
import type { CycloneDxBom } from "../../src/sbom/types";

const vuln = (overrides: Partial<SecurityVulnerability> = {}): SecurityVulnerability => ({
    aliases: ["CVE-2022-12345"],
    cvssScore: 7.5,
    fixedVersions: ["4.17.21"],
    id: "GHSA-xxxx-yyyy-zzzz",
    severity: "HIGH",
    summary: "Prototype pollution in lodash",
    ...overrides,
});

const emptyBom = (): CycloneDxBom => ({
    bomFormat: "CycloneDX",
    specVersion: "1.7",
    version: 1,
    components: [],
});

const now = new Date("2026-05-11T12:00:00Z");

describe(buildCycloneDxVulnerabilities, () => {
    it("returns one vulnerability per advisory id, aggregating versions under affects[]", () => {
        expect.assertions(3);

        const list = buildCycloneDxVulnerabilities(
            [
                { packageName: "lodash", packageVersion: "4.17.20", vulnerability: vuln(), acknowledged: false },
                { packageName: "lodash", packageVersion: "4.17.19", vulnerability: vuln(), acknowledged: false },
            ],
            now,
        );

        expect(list).toHaveLength(1);
        expect(list[0]!.affects).toHaveLength(1);
        expect(list[0]!.affects![0]!.versions).toHaveLength(2);
    });

    it("maps severities to CycloneDX labels and emits a rating", () => {
        expect.assertions(2);

        const list = buildCycloneDxVulnerabilities(
            [{ packageName: "x", packageVersion: "1.0.0", vulnerability: vuln({ severity: "MODERATE" }), acknowledged: false }],
            now,
        );

        expect(list[0]!.ratings![0]!.severity).toBe("medium");
        expect(list[0]!.ratings![0]!.score).toBe(7.5);
    });

    it("attaches a not_affected analysis when every finding is acknowledged", () => {
        expect.assertions(2);

        const list = buildCycloneDxVulnerabilities(
            [
                { packageName: "a", packageVersion: "1.0.0", vulnerability: vuln(), acknowledged: true },
                { packageName: "b", packageVersion: "2.0.0", vulnerability: vuln(), acknowledged: true },
            ],
            now,
        );

        expect(list[0]!.analysis!.state).toBe("not_affected");
        expect(list[0]!.analysis!.response).toContain("will_not_fix");
    });

    it("attaches in_triage analysis when only some findings are acknowledged", () => {
        expect.assertions(1);

        const list = buildCycloneDxVulnerabilities(
            [
                { packageName: "a", packageVersion: "1.0.0", vulnerability: vuln(), acknowledged: true },
                { packageName: "b", packageVersion: "2.0.0", vulnerability: vuln(), acknowledged: false },
            ],
            now,
        );

        expect(list[0]!.analysis!.state).toBe("in_triage");
    });

    it("turns aliases into references[]", () => {
        expect.assertions(2);

        const list = buildCycloneDxVulnerabilities(
            [
                {
                    packageName: "a",
                    packageVersion: "1.0.0",
                    vulnerability: vuln({ id: "GHSA-xxxx-yyyy-zzzz", aliases: ["CVE-2022-12345"] }),
                    acknowledged: false,
                },
            ],
            now,
        );

        expect(list[0]!.references).toHaveLength(1);
        expect(list[0]!.references![0]!.id).toBe("CVE-2022-12345");
    });
});

describe(emitCycloneDxVex, () => {
    it("returns a new BOM with vulnerabilities[] attached", () => {
        expect.assertions(2);

        const bom = emitCycloneDxVex({
            bom: emptyBom(),
            findings: [{ packageName: "a", packageVersion: "1.0.0", vulnerability: vuln(), acknowledged: false }],
            now,
        });

        expect(bom.specVersion).toBe("1.7");
        expect(bom.vulnerabilities).toHaveLength(1);
    });

    it("preserves the original BOM's components and metadata", () => {
        expect.assertions(2);

        const base: CycloneDxBom = {
            ...emptyBom(),
            components: [{ name: "x", type: "library", version: "1.0.0" }],
            metadata: { timestamp: "2026-05-01T00:00:00Z" },
        };

        const bom = emitCycloneDxVex({ bom: base, findings: [], now });

        expect(bom.components).toHaveLength(1);
        expect(bom.metadata?.timestamp).toBe("2026-05-01T00:00:00Z");
    });
});
