import { describe, expect, it } from "vitest";

import { emitSarif } from "../../src/report/sarif";
import type { SecurityVulnerability } from "../../src/security/advisories";
import type { PolicyDecision } from "../../src/security/policies";
import { formatErrors, sarifValidator } from "../fixtures/schemas/load";

const vuln = (overrides: Partial<SecurityVulnerability> = {}): SecurityVulnerability => {
    return {
        aliases: ["CVE-2022-12345"],
        cvssScore: 7.5,
        fixedVersions: ["4.17.21"],
        id: "GHSA-xxxx-yyyy-zzzz",
        severity: "HIGH",
        summary: "Prototype pollution in lodash",
        ...overrides,
    };
};

describe(emitSarif, () => {
    it("emits SARIF 2.1.0 with the canonical $schema URI", () => {
        expect.assertions(2);

        const log = emitSarif({
            findings: [],
            tool: { informationUri: "https://example.com", name: "vis-audit", version: "alpha" },
            workspaceRoot: "/repo",
        });

        expect(log.version).toBe("2.1.0");
        expect(log.$schema).toContain("sarif-2.1.0");
    });

    it("maps CRITICAL/HIGH → error, MODERATE → warning, LOW → note", () => {
        expect.assertions(3);

        const findings = [
            { acknowledged: false, packageName: "a", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-1", severity: "CRITICAL" }) },
            { acknowledged: false, packageName: "b", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-2", severity: "MODERATE" }) },
            { acknowledged: false, packageName: "c", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-3", severity: "LOW" }) },
        ];

        const log = emitSarif({
            findings,
            tool: { informationUri: "https://example.com", name: "vis-audit", version: "alpha" },
            workspaceRoot: "/repo",
        });

        const levels = log.runs[0]!.results.map((r) => r.level);

        expect(levels[0]).toBe("error");
        expect(levels[1]).toBe("warning");
        expect(levels[2]).toBe("note");
    });

    it("uses CVSS base score when present, falls back to bucketed score otherwise", () => {
        expect.assertions(2);

        const log = emitSarif({
            findings: [
                { acknowledged: false, packageName: "a", packageVersion: "1.0.0", vulnerability: vuln({ cvssScore: 7.5, id: "GHSA-1" }) },
                {
                    acknowledged: false,
                    packageName: "b",
                    packageVersion: "1.0.0",
                    vulnerability: vuln({ cvssScore: undefined, id: "GHSA-2", severity: "MODERATE" }),
                },
            ],
            tool: { informationUri: "https://example.com", name: "vis-audit", version: "alpha" },
            workspaceRoot: "/repo",
        });

        const { rules } = log.runs[0]!.tool.driver;

        expect(rules.find((r) => r.id === "GHSA-1")?.properties["security-severity"]).toBe("7.5");
        expect(rules.find((r) => r.id === "GHSA-2")?.properties["security-severity"]).toBe("5.5");
    });

    it("includes partialFingerprints for stable dedupe", () => {
        expect.assertions(3);

        const log = emitSarif({
            findings: [{ acknowledged: false, packageName: "lodash", packageVersion: "4.17.20", vulnerability: vuln() }],
            tool: { informationUri: "https://example.com", name: "vis-audit", version: "alpha" },
            workspaceRoot: "/repo",
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
            findings: [
                { acknowledged: false, packageName: "a", packageVersion: "1.0.0", vulnerability: same },
                { acknowledged: false, packageName: "b", packageVersion: "2.0.0", vulnerability: same },
            ],
            tool: { informationUri: "https://example.com", name: "vis-audit", version: "alpha" },
            workspaceRoot: "/repo",
        });

        expect(log.runs[0]!.tool.driver.rules).toHaveLength(1);
        expect(log.runs[0]!.results).toHaveLength(2);
    });

    it("marks acknowledged findings via properties", () => {
        expect.assertions(2);

        const log = emitSarif({
            findings: [
                { acknowledged: true, packageName: "a", packageVersion: "1.0.0", vulnerability: vuln() },
                { acknowledged: false, packageName: "b", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-x" }) },
            ],
            tool: { informationUri: "https://example.com", name: "vis-audit", version: "alpha" },
            workspaceRoot: "/repo",
        });

        expect(log.runs[0]!.results[0]!.properties?.acknowledged).toBe(true);
        expect(log.runs[0]!.results[1]!.properties?.acknowledged).toBeUndefined();
    });

    it("emits one rule per policy and includes helpUri + policy tags", () => {
        expect.assertions(5);

        const decisions: PolicyDecision[] = [
            {
                data: { deniedLicense: "GPL-3.0" },
                packageName: "gpl-pkg",
                policy: "license",
                reason: "gpl-pkg@1.0.0 license GPL-3.0 is denied",
                severity: "block",
                version: "1.0.0",
            },
            {
                data: { deniedLicense: "GPL-3.0" },
                packageName: "another-gpl-pkg",
                policy: "license",
                reason: "another-gpl-pkg@2.0.0 license GPL-3.0 is denied",
                severity: "block",
                version: "2.0.0",
            },
            {
                packageName: "build-pkg",
                policy: "installScripts",
                reason: "build-pkg@3.0.0 has unapproved postinstall script",
                severity: "warn",
                version: "3.0.0",
            },
        ];

        const log = emitSarif({
            findings: [],
            policyDecisions: decisions,
            tool: { informationUri: "https://example.com", name: "vis-audit", version: "alpha" },
            workspaceRoot: "/repo",
        });

        const { rules } = log.runs[0]!.tool.driver;
        const licenseRule = rules.find((r) => r.id === "vis.policy.license");
        const scriptsRule = rules.find((r) => r.id === "vis.policy.installScripts");

        expect(rules).toHaveLength(2);
        expect(licenseRule?.helpUri).toBe("https://visulima.com/packages/vis/commands/audit#policy-license");
        expect(scriptsRule?.helpUri).toBe("https://visulima.com/packages/vis/commands/audit#policy-installScripts");
        expect(licenseRule?.properties.tags).toContain("policy:license");
        expect(log.runs[0]!.results).toHaveLength(3);
    });

    it("skips the vulnerability policy in policyDecisions (already covered by OSV pass)", () => {
        expect.assertions(2);

        const decisions: PolicyDecision[] = [
            {
                data: { advisoryId: "GHSA-dup" },
                packageName: "lodash",
                policy: "vulnerability",
                reason: "duplicate of OSV finding",
                severity: "block",
                version: "4.17.20",
            },
        ];

        const log = emitSarif({
            findings: [{ acknowledged: false, packageName: "lodash", packageVersion: "4.17.20", vulnerability: vuln() }],
            policyDecisions: decisions,
            tool: { informationUri: "https://example.com", name: "vis-audit", version: "alpha" },
            workspaceRoot: "/repo",
        });

        const policyRules = log.runs[0]!.tool.driver.rules.filter((r) => r.id.startsWith("vis.policy."));
        const policyResults = log.runs[0]!.results.filter((r) => r.ruleId.startsWith("vis.policy."));

        expect(policyRules).toHaveLength(0);
        expect(policyResults).toHaveLength(0);
    });

    it("validates against the SARIF 2.1.0 JSON schema (empty, single, multi-finding)", () => {
        expect.assertions(3);

        const validate = sarifValidator();
        const baseTool = { informationUri: "https://github.com/visulima/visulima", name: "vis-audit", version: "alpha" };

        const empty = emitSarif({ findings: [], tool: baseTool, workspaceRoot: "/repo" });
        const single = emitSarif({
            findings: [{ acknowledged: false, packageName: "lodash", packageVersion: "4.17.20", vulnerability: vuln() }],
            tool: baseTool,
            workspaceRoot: "/repo",
        });
        const multi = emitSarif({
            findings: [
                { acknowledged: false, packageName: "lodash", packageVersion: "4.17.20", vulnerability: vuln({ id: "GHSA-1", severity: "CRITICAL" }) },
                { acknowledged: true, packageName: "lodash", packageVersion: "4.17.20", vulnerability: vuln({ id: "GHSA-2", severity: "MODERATE" }) },
                { acknowledged: false, packageName: "axios", packageVersion: "0.21.0", vulnerability: vuln({ id: "CVE-2021-3749", severity: "HIGH" }) },
            ],
            tool: baseTool,
            workspaceRoot: "/repo",
        });

        expect(validate(empty), formatErrors(validate)).toBe(true);
        expect(validate(single), formatErrors(validate)).toBe(true);
        expect(validate(multi), formatErrors(validate)).toBe(true);
    });
});
