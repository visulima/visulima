import { describe, expect, it } from "vitest";

import type { EcosystemCheckResult } from "../../../../src/commands/update/ecosystems/index";
import { formatEcosystemReport, isBreakingUpdate } from "../../../../src/commands/update/ecosystems/report";
import type { EcosystemUpdate } from "../../../../src/commands/update/ecosystems/types";

// eslint-disable-next-line no-control-regex
const ANSI = /\u001B\[[\d;]*m/g;
const stripAnsi = (input: string): string => input.replaceAll(ANSI, "");

const makeUpdate = (overrides: Partial<EcosystemUpdate> & Pick<EcosystemUpdate, "name" | "updateType">): EcosystemUpdate => {
    return {
        currentRef: "v1.0.0",
        currentVersion: "v1.0.0",
        ecosystem: "actions",
        file: "/repo/.github/workflows/ci.yml",
        line: 10,
        newRef: "v2.0.0",
        newVersion: "v2.0.0",
        original: "uses: foo@v1.0.0",
        replacement: "uses: foo@v2.0.0",
        ...overrides,
    };
};

const buildResult = (updates: EcosystemUpdate[]): EcosystemCheckResult => {
    return {
        failed: [],
        ignored: [],
        perEcosystem: {
            actions: { failed: [], ignored: [], updates: updates.filter((update) => update.ecosystem === "actions") },
            docker: { failed: [], ignored: [], updates: updates.filter((update) => update.ecosystem === "docker") },
            gitlab: { failed: [], ignored: [], updates: updates.filter((update) => update.ecosystem === "gitlab") },
        },
        scanned: 1,
        updates,
    };
};

describe(isBreakingUpdate, () => {
    it("treats major as breaking", () => {
        expect.assertions(1);
        expect(isBreakingUpdate(makeUpdate({ name: "x", updateType: "major" }))).toBe(true);
    });

    it.each(["minor", "patch", "digest", "pin", "unknown"] as const)("treats %s as non-breaking", (updateType) => {
        expect.assertions(1);
        expect(isBreakingUpdate(makeUpdate({ name: "x", updateType }))).toBe(false);
    });
});

describe(formatEcosystemReport, () => {
    it("returns empty string when nothing was scanned", () => {
        expect.assertions(1);

        const result: EcosystemCheckResult = { ...buildResult([]), scanned: 0 };

        expect(formatEcosystemReport(result, { showIgnored: false })).toBe("");
    });

    it("renders the up-to-date confirmation when scanned but no updates", () => {
        expect.assertions(1);
        expect(stripAnsi(formatEcosystemReport(buildResult([]), { showIgnored: false }))).toContain("All ecosystem references up to date.");
    });

    it("surfaces a breaking-changes callout above the per-ecosystem section when major bumps exist", () => {
        expect.assertions(3);

        const updates = [
            makeUpdate({ ecosystem: "actions", name: "actions/checkout", updateType: "major" }),
            makeUpdate({ ecosystem: "actions", name: "actions/setup-node", updateType: "minor" }),
            makeUpdate({ ecosystem: "docker", name: "node", updateType: "major" }),
        ];

        const report = stripAnsi(formatEcosystemReport(buildResult(updates), { showIgnored: false }));

        expect(report).toContain("⚠ Breaking changes (2)");
        expect(report.indexOf("⚠ Breaking changes")).toBeLessThan(report.indexOf("GitHub Actions"));
        // Major entries still appear inside their per-ecosystem section.
        expect(report.match(/actions\/checkout/g)?.length).toBe(2);
    });

    it("omits the breaking-changes callout when no major bumps exist", () => {
        expect.assertions(1);

        const updates = [
            makeUpdate({ ecosystem: "actions", name: "actions/setup-node", updateType: "minor" }),
            makeUpdate({ ecosystem: "actions", name: "actions/cache", updateType: "patch" }),
        ];

        expect(stripAnsi(formatEcosystemReport(buildResult(updates), { showIgnored: false }))).not.toContain("Breaking changes");
    });

    it("renders an advisory badge + per-advisory line when an update carries OSV hits", () => {
        expect.assertions(4);

        const updates = [
            makeUpdate({
                advisories: [
                    {
                        fixedVersions: ["v4.0.0"],
                        id: "GHSA-xxxx-yyyy-zzzz",
                        severity: "HIGH",
                        summary: "Arbitrary code execution via crafted ref",
                    },
                ],
                ecosystem: "actions",
                name: "actions/checkout",
                updateType: "minor",
            }),
        ];

        const report = stripAnsi(formatEcosystemReport(buildResult(updates), { showIgnored: false }));

        expect(report).toContain("⚠ 1 advisory");
        expect(report).toContain("GHSA-xxxx-yyyy-zzzz");
        expect(report).toContain("HIGH");
        expect(report).toContain("Arbitrary code execution via crafted ref");
    });

    it("appends the changelog/release URL when the update carries one", () => {
        expect.assertions(2);

        const updates = [
            makeUpdate({
                ecosystem: "actions",
                name: "actions/checkout",
                updateType: "minor",
                url: "https://github.com/actions/checkout/releases/tag/v3.5.3",
            }),
            makeUpdate({ ecosystem: "actions", name: "actions/cache", updateType: "patch" }),
        ];

        const report = stripAnsi(formatEcosystemReport(buildResult(updates), { showIgnored: false }));

        expect(report).toContain("https://github.com/actions/checkout/releases/tag/v3.5.3");
        // The url-less entry shouldn't render a trailing whitespace-only suffix.
        expect(report).toMatch(/patch\s+actions\/cache\s+v1\.0\.0 → v2\.0\.0(?:$|\n)/m);
    });
});
