import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";

import { emitAuditHtml } from "../../src/report/audit-html";
import type { SecurityVulnerability } from "../../src/security/advisories";

const vuln = (overrides: Partial<SecurityVulnerability> = {}): SecurityVulnerability => {
    return {
        aliases: [],
        cvssScore: 7.5,
        fixedVersions: ["4.17.21"],
        id: "GHSA-xxxx-yyyy-zzzz",
        severity: "HIGH",
        summary: "Prototype pollution in lodash",
        ...overrides,
    };
};

const baseOptions = {
    now: new Date("2026-05-11T12:00:00Z"),
    packagesScanned: 100,
    tool: { name: "vis-audit", version: "alpha" },
    workspaceRoot: "/repo",
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
            findings: [{ acknowledged: false, packageName: "lodash", packageVersion: "4.17.20", vulnerability: vuln() }],
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
                { acknowledged: false, packageName: "low-pkg", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-low", severity: "LOW" }) },
                { acknowledged: false, packageName: "crit-pkg", packageVersion: "1.0.0", vulnerability: vuln({ id: "GHSA-crit", severity: "CRITICAL" }) },
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
            findings: [{ acknowledged: true, packageName: "a", packageVersion: "1.0.0", vulnerability: vuln() }],
        });

        expect(html).toContain("acknowledged");
    });

    it("classifies a same-major fix as minor-patch (safe upgrade)", () => {
        expect.assertions(1);

        const html = emitAuditHtml({
            ...baseOptions,
            findings: [{ acknowledged: false, packageName: "lodash", packageVersion: "4.17.20", vulnerability: vuln({ fixedVersions: ["4.17.21"] }) }],
        });

        expect(html).toContain("marker-minor-patch");
    });

    it("classifies a cross-major fix as major (breaking change required)", () => {
        expect.assertions(1);

        const html = emitAuditHtml({
            ...baseOptions,
            findings: [{ acknowledged: false, packageName: "old", packageVersion: "1.5.0", vulnerability: vuln({ fixedVersions: ["2.0.0"] }) }],
        });

        expect(html).toContain("marker-major");
    });

    it("renders a copyable remediation when provided", () => {
        expect.assertions(2);

        const html = emitAuditHtml({
            ...baseOptions,
            findings: [
                {
                    acknowledged: false,
                    packageName: "lodash",
                    packageVersion: "4.17.20",
                    remediation: "pnpm update lodash@4.17.21",
                    vulnerability: vuln(),
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
                    acknowledged: false,
                    packageName: "<script>alert(1)</script>",
                    packageVersion: "1.0.0",
                    vulnerability: vuln({ summary: "</td><script>alert(2)</script>" }),
                },
            ],
        });

        expect(html).not.toContain("<script>alert(1)</script>");
        expect(html).not.toContain("<script>alert(2)</script>");
    });

    // The string-level assertions above prove individual emit decisions; the
    // headless render below proves the emitted bytes parse into a well-formed
    // DOM tree — no unbalanced tags, no XSS payload smuggled into the document,
    // and all rows surface through `<tbody> > <tr>` so consumers' table-walking
    // selectors still work.
    it("parses into a well-formed DOM with one row per finding and severity in the badge", async () => {
        expect.assertions(7);

        const html = emitAuditHtml({
            ...baseOptions,
            findings: [
                {
                    acknowledged: false,
                    packageName: "lodash",
                    packageVersion: "4.17.20",
                    remediation: "pnpm update lodash@4.17.21",
                    vulnerability: vuln({ id: "GHSA-crit", severity: "CRITICAL" }),
                },
                {
                    acknowledged: true,
                    packageName: "axios",
                    packageVersion: "0.21.0",
                    vulnerability: vuln({ id: "GHSA-mod", severity: "MODERATE" }),
                },
            ],
        });

        const window = new Window();
        const parser = new window.DOMParser();
        const document = parser.parseFromString(html, "text/html");

        const rows = document.querySelectorAll("table#findings tbody tr");

        expect(rows).toHaveLength(2);

        // Row order = severity order; CRITICAL first.
        const firstBadge = rows[0]!.querySelector(".badge");

        expect(firstBadge?.classList.contains("badge-critical")).toBe(true);
        expect(firstBadge?.textContent?.trim()).toBe("CRITICAL");

        // Advisory link opens externally with rel hardening.
        const link = rows[0]!.querySelector("a[href]") as HTMLAnchorElement | null;

        expect(link?.getAttribute("target")).toBe("_blank");
        expect(link?.getAttribute("rel")).toBe("noreferrer noopener");

        // Second row is the acknowledged moderate finding.
        const ackMarker = rows[1]!.querySelector(".ack");

        expect(ackMarker?.textContent).toContain("acknowledged");

        // Remediation rendered as a copyable code block on row 1.
        const copyable = rows[0]!.querySelector("code.copyable");

        expect(copyable?.dataset.cmd).toBe("pnpm update lodash@4.17.21");

        await window.happyDOM.close();
    });

    it("renders no <script> for XSS payloads and keeps them as inert text nodes", async () => {
        expect.assertions(3);

        const html = emitAuditHtml({
            ...baseOptions,
            findings: [
                {
                    acknowledged: false,
                    packageName: "<script>alert(1)</script>",
                    packageVersion: "1.0.0",
                    vulnerability: vuln({ summary: "</td><script>alert(2)</script>" }),
                },
            ],
        });

        const window = new Window();
        const parser = new window.DOMParser();
        const document = parser.parseFromString(html, "text/html");

        // The emitter's own inline controller is the only legitimate <script>;
        // any escaped payload must round-trip into a text node, not a tag.
        const scripts = [...document.querySelectorAll("script")];

        expect(scripts).toHaveLength(1);
        expect(scripts[0]?.textContent ?? "").not.toContain("alert(1)");
        expect(scripts[0]?.textContent ?? "").not.toContain("alert(2)");

        await window.happyDOM.close();
    });
});
