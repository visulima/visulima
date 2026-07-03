import { describe, expect, it } from "vitest";

import { emitJUnitAudit } from "../../src/report/junit-audit";
import type { SecurityVulnerability } from "../../src/security/advisories";
import type { PolicyDecision } from "../../src/security/policies";

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

const countMatches = (xml: string, pattern: RegExp): number => [...xml.matchAll(pattern)].length;

describe(emitJUnitAudit, () => {
    it("always emits a root <testsuites> element and the vulnerabilities suite", () => {
        expect.assertions(3);

        const xml = emitJUnitAudit({ findings: [] });

        expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
        expect(xml).toContain("<testsuites name=\"vis-audit\"");
        expect(xml).toContain("<testsuite name=\"vulnerabilities\"");
    });

    it("emits one <testcase> per finding with a <failure> child", () => {
        expect.assertions(3);

        const findings = [
            { acknowledged: false, packageName: "a", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-1" }) },
            { acknowledged: false, packageName: "b", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-2" }) },
        ];
        const xml = emitJUnitAudit({ findings });

        expect(countMatches(xml, /<testcase /g)).toBe(2);
        expect(countMatches(xml, /<failure /g)).toBe(2);
        expect(xml).toContain("name=\"GHSA-1\"");
    });

    it("marks acknowledged findings as <skipped/> instead of <failure>", () => {
        expect.assertions(2);

        const findings = [{ acknowledged: true, packageName: "a", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-1" }) }];
        const xml = emitJUnitAudit({ findings });

        expect(xml).toContain("<skipped/>");
        expect(xml).not.toContain("<failure ");
    });

    it("uppercases severity for the failure type", () => {
        expect.assertions(2);

        const findings = [
            { acknowledged: false, packageName: "a", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-1", severity: "CRITICAL" }) },
            { acknowledged: false, packageName: "b", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-2", severity: "MODERATE" }) },
        ];
        const xml = emitJUnitAudit({ findings });

        expect(xml).toContain("type=\"CRITICAL\"");
        expect(xml).toContain("type=\"MEDIUM\"");
    });

    it("cDATA-escapes embedded ]]> sequences in advisory summaries", () => {
        expect.assertions(2);

        const findings = [
            {
                acknowledged: false,
                packageName: "a",
                packageVersion: "1.0.0",
                vulnerability: vuln({ id: "GHSA-1", summary: "Contains a ]]> escape sequence in the middle" }),
            },
        ];
        const xml = emitJUnitAudit({ findings });

        // The CDATA closer should not appear as a raw token outside the
        // split — only the safe split form "]]]]><![CDATA[>" is allowed.
        expect(xml).toContain("]]]]><![CDATA[>");
        expect(xml.replaceAll("]]]]><![CDATA[>", "")).not.toContain("]]>contains");
    });

    it("xml-escapes reserved characters in advisory summaries used as attributes", () => {
        expect.assertions(1);

        const findings = [
            {
                acknowledged: false,
                packageName: "a",
                packageVersion: "1.0.0",
                vulnerability: vuln({ id: "GHSA-1", summary: "uses < & > \" ' chars" }),
            },
        ];
        const xml = emitJUnitAudit({ findings });

        // Attribute escapes for the message — element-text uses CDATA.
        expect(xml).toMatch(/message="[^"]*&lt;[^"]*&amp;[^"]*&gt;[^"]*&quot;[^"]*&apos;[^"]*"/);
    });

    it("adds a separate <testsuite name=\"policies\"> only when policy decisions exist", () => {
        expect.assertions(2);

        const decisions: PolicyDecision[] = [{ packageName: "evil-pkg", policy: "malware", reason: "Detected malware", severity: "block", version: "1.0.0" }];
        const xml = emitJUnitAudit({ findings: [], policyDecisions: decisions });
        const xmlNoPolicies = emitJUnitAudit({ findings: [] });

        expect(xml).toContain("<testsuite name=\"policies\"");
        expect(xmlNoPolicies).not.toContain("<testsuite name=\"policies\"");
    });

    it("skips policy decisions whose policy is `vulnerability` (covered in the vuln suite)", () => {
        expect.assertions(1);

        const decisions: PolicyDecision[] = [
            { packageName: "lodash", policy: "vulnerability", reason: "covered separately", severity: "warn", version: "4.17.20" },
        ];
        const xml = emitJUnitAudit({ findings: [], policyDecisions: decisions });

        expect(xml).not.toContain("<testsuite name=\"policies\"");
    });

    it("renders info-severity policy decisions as passing testcases with <system-out>", () => {
        expect.assertions(3);

        const decisions: PolicyDecision[] = [
            { packageName: "left-pad", policy: "license", reason: "MIT licence permitted", severity: "info", version: "1.0.0" },
        ];
        const xml = emitJUnitAudit({ findings: [], policyDecisions: decisions });

        expect(xml).toContain("<system-out>");
        expect(xml).toContain("MIT licence permitted");
        expect(xml).not.toContain("<failure ");
    });

    it("stamps aggregate totals on the root <testsuites> element", () => {
        expect.assertions(4);

        const findings = [
            { acknowledged: false, packageName: "a", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-1" }) },
            { acknowledged: true, packageName: "b", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-2" }) },
        ];
        const decisions: PolicyDecision[] = [{ packageName: "evil-pkg", policy: "malware", reason: "Detected malware", severity: "block", version: "1.0.0" }];
        const xml = emitJUnitAudit({ findings, policyDecisions: decisions });

        expect(xml).toMatch(/<testsuites[^>]*\stests="3"/);
        expect(xml).toMatch(/<testsuites[^>]*\sfailures="2"/);
        expect(xml).toMatch(/<testsuites[^>]*\sskipped="1"/);
        expect(xml).toMatch(/<testsuites[^>]*\serrors="0"/);
    });
});
