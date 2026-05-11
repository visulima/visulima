import { describe, expect, it } from "vitest";

import { emitCsaf } from "../../src/report/csaf";
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

const baseOptions = {
    workspaceRoot: "/repo",
    tool: { name: "vis-audit", version: "alpha", informationUri: "https://github.com/visulima/visulima" },
    now: new Date("2026-05-11T12:00:00Z"),
};

describe(emitCsaf, () => {
    it("emits a csaf_vex profile with the mandatory document envelope", () => {
        expect.assertions(5);

        const doc = emitCsaf({ ...baseOptions, findings: [] });

        expect(doc.document.category).toBe("csaf_vex");
        expect(doc.document.csaf_version).toBe("2.0");
        expect(doc.document.distribution.tlp.label).toBe("WHITE");
        expect(doc.document.tracking.status).toBe("final");
        expect(doc.document.tracking.id).toBe("vis-audit-2026-05-11");
    });

    it("groups versions of the same package under one product_name branch", () => {
        expect.assertions(3);

        const doc = emitCsaf({
            ...baseOptions,
            findings: [
                { packageName: "lodash", packageVersion: "4.17.20", vulnerability: vuln(), acknowledged: false },
                { packageName: "lodash", packageVersion: "4.17.19", vulnerability: vuln(), acknowledged: false },
            ],
        });

        expect(doc.product_tree.branches).toHaveLength(1);
        expect(doc.product_tree.branches[0]!.name).toBe("lodash");
        expect(doc.product_tree.branches[0]!.branches).toHaveLength(2);
    });

    it("aggregates findings per advisory ID with all affected products listed", () => {
        expect.assertions(2);

        const shared = vuln({ id: "GHSA-dup" });
        const doc = emitCsaf({
            ...baseOptions,
            findings: [
                { packageName: "a", packageVersion: "1.0.0", vulnerability: shared, acknowledged: false },
                { packageName: "b", packageVersion: "2.0.0", vulnerability: shared, acknowledged: false },
            ],
        });

        expect(doc.vulnerabilities).toHaveLength(1);
        expect(doc.vulnerabilities[0]!.product_status.known_affected).toEqual([
            "pkg:npm/a@1.0.0",
            "pkg:npm/b@2.0.0",
        ]);
    });

    it("routes CVE IDs into `cve` and GHSA/OSV IDs into `ids[]`", () => {
        expect.assertions(3);

        const doc = emitCsaf({
            ...baseOptions,
            findings: [
                {
                    packageName: "lodash",
                    packageVersion: "4.17.20",
                    vulnerability: vuln({ id: "GHSA-xxxx-yyyy-zzzz", aliases: ["CVE-2022-12345"] }),
                    acknowledged: false,
                },
            ],
        });

        const v = doc.vulnerabilities[0]!;

        expect(v.cve).toBe("CVE-2022-12345");
        expect(v.ids).toHaveLength(1);
        expect(v.ids![0]!.text).toBe("GHSA-xxxx-yyyy-zzzz");
    });

    it("uses CVSS base score when present, falls back to severity bucket otherwise", () => {
        expect.assertions(2);

        const doc = emitCsaf({
            ...baseOptions,
            findings: [
                { packageName: "a", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-1", cvssScore: 7.5 }), acknowledged: false },
                {
                    packageName: "b",
                    packageVersion: "1.0.0",
                    vulnerability: vuln({ id: "GHSA-2", cvssScore: undefined, severity: "MODERATE" }),
                    acknowledged: false,
                },
            ],
        });

        expect(doc.vulnerabilities[0]!.scores![0]!.cvss_v3!.baseScore).toBe(7.5);
        expect(doc.vulnerabilities[1]!.scores![0]!.cvss_v3!.baseScore).toBe(5.5);
    });

    it("marks acknowledged findings with a vex_acknowledged flag scoped to those products", () => {
        expect.assertions(2);

        const doc = emitCsaf({
            ...baseOptions,
            findings: [
                { packageName: "a", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-A" }), acknowledged: true },
                { packageName: "b", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-A" }), acknowledged: false },
            ],
        });

        expect(doc.vulnerabilities[0]!.flags).toBeDefined();
        expect(doc.vulnerabilities[0]!.flags![0]!.product_ids).toEqual(["pkg:npm/a@1.0.0"]);
    });
});
