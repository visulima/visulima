import { describe, expect, it } from "vitest";

import { emitAuditHtml } from "../../src/report/audit-html";
import type { SecurityVulnerability } from "../../src/security/advisories";

const vuln = (overrides: Partial<SecurityVulnerability> = {}): SecurityVulnerability => ({
    aliases: [],
    cvssScore: 7.5,
    fixedVersions: ["4.17.21"],
    id: "GHSA-xxxx-yyyy-zzzz",
    severity: "HIGH",
    summary: "Prototype pollution in lodash",
    ...overrides,
});

const baseOptions = {
    workspaceRoot: "/repo",
    tool: { name: "vis-audit", version: "alpha" },
    packagesScanned: 100,
    now: new Date("2026-05-11T12:00:00Z"),
};

describe(emitAuditHtml, () => {
    it("renders a clean-state page when there are no findings", () => {
        expect.assertions(2);

        const html = emitAuditHtml({ ...baseOptions, findings: [] });

        expect(html).toContain("No security issues found");
        expect(html).toContain("CLEAN");
    });

    it("renders one row per finding with severity badge and advisory link", () => {
        expect.assertions(3);

        const html = emitAuditHtml({
            ...baseOptions,
            findings: [{ packageName: "lodash", packageVersion: "4.17.20", vulnerability: vuln(), acknowledged: false }],
        });

        expect(html).toContain("GHSA-xxxx-yyyy-zzzz");
        expect(html).toContain("lodash");
        expect(html).toContain("https://github.com/advisories/GHSA-xxxx-yyyy-zzzz");
    });

    it("orders findings by severity (CRITICAL first)", () => {
        expect.assertions(1);

        const html = emitAuditHtml({
            ...baseOptions,
            findings: [
                { packageName: "low-pkg", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-low", severity: "LOW" }), acknowledged: false },
                { packageName: "crit-pkg", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-crit", severity: "CRITICAL" }), acknowledged: false },
            ],
        });

        const critIdx = html.indexOf("GHSA-crit");
        const lowIdx = html.indexOf("GHSA-low");

        expect(critIdx).toBeLessThan(lowIdx);
    });

    it("marks an acknowledged finding visibly", () => {
        expect.assertions(1);

        const html = emitAuditHtml({
            ...baseOptions,
            findings: [{ packageName: "a", packageVersion: "1.0.0", vulnerability: vuln(), acknowledged: true }],
        });

        expect(html).toContain("acknowledged");
    });

    it("classifies a same-major fix as minor-patch (safe upgrade)", () => {
        expect.assertions(1);

        const html = emitAuditHtml({
            ...baseOptions,
            findings: [
                { packageName: "lodash", packageVersion: "4.17.20", vulnerability: vuln({ fixedVersions: ["4.17.21"] }), acknowledged: false },
            ],
        });

        expect(html).toContain("marker-minor-patch");
    });

    it("classifies a cross-major fix as major (breaking change required)", () => {
        expect.assertions(1);

        const html = emitAuditHtml({
            ...baseOptions,
            findings: [
                { packageName: "old", packageVersion: "1.5.0", vulnerability: vuln({ fixedVersions: ["2.0.0"] }), acknowledged: false },
            ],
        });

        expect(html).toContain("marker-major");
    });

    it("renders a copyable remediation when provided", () => {
        expect.assertions(2);

        const html = emitAuditHtml({
            ...baseOptions,
            findings: [
                {
                    packageName: "lodash",
                    packageVersion: "4.17.20",
                    vulnerability: vuln(),
                    acknowledged: false,
                    remediation: "pnpm update lodash@4.17.21",
                },
            ],
        });

        expect(html).toContain("class=\"copyable\"");
        expect(html).toContain("pnpm update lodash@4.17.21");
    });

    it("escapes user-controlled strings (package name, summary)", () => {
        expect.assertions(2);

        const html = emitAuditHtml({
            ...baseOptions,
            findings: [
                {
                    packageName: "<script>alert(1)</script>",
                    packageVersion: "1.0.0",
                    vulnerability: vuln({ summary: "</td><script>alert(2)</script>" }),
                    acknowledged: false,
                },
            ],
        });

        expect(html).not.toContain("<script>alert(1)</script>");
        expect(html).not.toContain("<script>alert(2)</script>");
    });
});
