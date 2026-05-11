import { describe, expect, it } from "vitest";

import { emitSarif } from "../../src/report/sarif";
import type { SecurityVulnerability } from "../../src/security/advisories";

const vuln = (overrides: Partial<SecurityVulnerability> = {}): SecurityVulnerability => ({
    aliases: ["CVE-2022-12345"],
    cvssScore: 7.5,
    fixedVersions: ["4.17.21"],
    id: "GHSA-xxxx-yyyy-zzzz",
    severity: "HIGH",
    summary: "Prototype pollution in lodash",
    ...overrides,
});

describe(emitSarif, () => {
    it("emits SARIF 2.1.0 with the canonical $schema URI", () => {
        expect.assertions(2);

        const log = emitSarif({
            workspaceRoot: "/repo",
            tool: { name: "vis-audit", version: "alpha", informationUri: "https://example.com" },
            findings: [],
        });

        expect(log.version).toBe("2.1.0");
        expect(log.$schema).toContain("sarif-2.1.0");
    });

    it("maps CRITICAL/HIGH → error, MODERATE → warning, LOW → note", () => {
        expect.assertions(3);

        const findings = [
            { packageName: "a", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-1", severity: "CRITICAL" }), acknowledged: false },
            { packageName: "b", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-2", severity: "MODERATE" }), acknowledged: false },
            { packageName: "c", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-3", severity: "LOW" }), acknowledged: false },
        ];

        const log = emitSarif({
            workspaceRoot: "/repo",
            tool: { name: "vis-audit", version: "alpha", informationUri: "https://example.com" },
            findings,
        });

        const levels = log.runs[0]!.results.map((r) => r.level);

        expect(levels[0]).toBe("error");
        expect(levels[1]).toBe("warning");
        expect(levels[2]).toBe("note");
    });

    it("uses CVSS base score when present, falls back to bucketed score otherwise", () => {
        expect.assertions(2);

        const log = emitSarif({
            workspaceRoot: "/repo",
            tool: { name: "vis-audit", version: "alpha", informationUri: "https://example.com" },
            findings: [
                { packageName: "a", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-1", cvssScore: 7.5 }), acknowledged: false },
                { packageName: "b", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-2", cvssScore: undefined, severity: "MODERATE" }), acknowledged: false },
            ],
        });

        const rules = log.runs[0]!.tool.driver.rules;

        expect(rules.find((r) => r.id === "GHSA-1")?.properties["security-severity"]).toBe("7.5");
        expect(rules.find((r) => r.id === "GHSA-2")?.properties["security-severity"]).toBe("5.5");
    });

    it("includes partialFingerprints for stable dedupe", () => {
        expect.assertions(3);

        const log = emitSarif({
            workspaceRoot: "/repo",
            tool: { name: "vis-audit", version: "alpha", informationUri: "https://example.com" },
            findings: [{ packageName: "lodash", packageVersion: "4.17.20", vulnerability: vuln(), acknowledged: false }],
        });

        const fingerprints = log.runs[0]!.results[0]!.partialFingerprints;

        expect(fingerprints.advisoryId).toBe("GHSA-xxxx-yyyy-zzzz");
        expect(fingerprints.package).toBe("lodash");
        expect(fingerprints.version).toBe("4.17.20");
    });

    it("dedupes advisory rules across findings", () => {
        expect.assertions(2);

        const same = vuln({ id: "GHSA-dup" });
        const log = emitSarif({
            workspaceRoot: "/repo",
            tool: { name: "vis-audit", version: "alpha", informationUri: "https://example.com" },
            findings: [
                { packageName: "a", packageVersion: "1.0.0", vulnerability: same, acknowledged: false },
                { packageName: "b", packageVersion: "2.0.0", vulnerability: same, acknowledged: false },
            ],
        });

        expect(log.runs[0]!.tool.driver.rules).toHaveLength(1);
        expect(log.runs[0]!.results).toHaveLength(2);
    });

    it("marks acknowledged findings via properties", () => {
        expect.assertions(2);

        const log = emitSarif({
            workspaceRoot: "/repo",
            tool: { name: "vis-audit", version: "alpha", informationUri: "https://example.com" },
            findings: [
                { packageName: "a", packageVersion: "1.0.0", vulnerability: vuln(), acknowledged: true },
                { packageName: "b", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-x" }), acknowledged: false },
            ],
        });

        expect(log.runs[0]!.results[0]!.properties?.acknowledged).toBe(true);
        expect(log.runs[0]!.results[1]!.properties?.acknowledged).toBeUndefined();
    });
});
