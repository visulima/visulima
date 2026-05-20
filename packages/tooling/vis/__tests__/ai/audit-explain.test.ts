import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AiProviderInfo } from "@visulima/find-ai-runner";
import { describe, expect, it, vi } from "vitest";

import type { SecurityVulnerability } from "../../src/util/catalog";

const TEST_HOME = join(tmpdir(), `vis-explain-test-${String(process.pid)}-${String(Date.now())}`);

vi.mock(import("node:os"), async (importOriginal) => {
    const original = await importOriginal<typeof import("node:os")>();

    return { ...original, homedir: () => TEST_HOME };
});

const { buildExplainPrompt, explainFindings, explainKey, parseExplanation, selectTargets } = await import("../../src/ai/audit-explain");

const vuln = (overrides: Partial<SecurityVulnerability> = {}): SecurityVulnerability => {
    return {
        aliases: ["CVE-2021-23337"],
        cvssScore: 7.2,
        fixedVersions: ["4.17.21"],
        id: "GHSA-35jh-r3h4-6jhm",
        severity: "HIGH",
        summary: "Prototype pollution",
        ...overrides,
    };
};

const target = (name: string, version: string, v: SecurityVulnerability) => {
    return { packageName: name, packageVersion: version, vulnerability: v };
};

const provider: AiProviderInfo = { available: true, name: "claude" };

describe(selectTargets, () => {
    const targets = [target("lodash", "4.17.20", vuln()), target("minimist", "1.2.5", vuln({ aliases: [], id: "GHSA-vh95-rmgr-6w4m" }))];

    it("should return all targets for a bare flag", () => {
        expect.assertions(3);

        expect(selectTargets(targets, null)).toHaveLength(2);
        expect(selectTargets(targets, "")).toHaveLength(2);
        expect(selectTargets(targets, true)).toHaveLength(2);
    });

    it("should pick a single target by 1-based index", () => {
        expect.assertions(2);

        expect(selectTargets(targets, "2")).toStrictEqual([targets[1]]);
        expect(selectTargets(targets, "9")).toStrictEqual([]);
    });

    it("should match by advisory id or alias, case-insensitively", () => {
        expect.assertions(2);

        expect(selectTargets(targets, "cve-2021-23337")).toStrictEqual([targets[0]]);
        expect(selectTargets(targets, "GHSA-vh95-rmgr-6w4m")).toStrictEqual([targets[1]]);
    });

    it("should return empty when nothing matches", () => {
        expect.assertions(1);

        expect(selectTargets(targets, "CVE-0000-0000")).toStrictEqual([]);
    });
});

describe(buildExplainPrompt, () => {
    it("should include package, advisory, and the JSON contract", () => {
        expect.assertions(4);

        const prompt = buildExplainPrompt(target("lodash", "4.17.20", vuln()));

        expect(prompt).toContain("lodash@4.17.20");
        expect(prompt).toContain("GHSA-35jh-r3h4-6jhm");
        expect(prompt).toContain("CVE-2021-23337");
        expect(prompt).toContain("whatItIs");
    });
});

describe(parseExplanation, () => {
    it("should format the three structured fields", () => {
        expect.assertions(3);

        const out = parseExplanation(JSON.stringify({ areYouAtRisk: "Only if called", whatItIs: "Proto pollution", whatToDo: "Upgrade" }));

        expect(out).toContain("What it is: Proto pollution");
        expect(out).toContain("Are you at risk: Only if called");
        expect(out).toContain("What to do: Upgrade");
    });

    it("should fall back to raw text when not the expected JSON", () => {
        expect.assertions(1);

        expect(parseExplanation("  just prose  ")).toBe("just prose");
    });
});

describe(explainKey, () => {
    it("should be stable and collision-safe across package/version/id", () => {
        expect.assertions(1);

        expect(explainKey(target("lodash", "4.17.20", vuln()))).toBe("lodash@4.17.20:GHSA-35jh-r3h4-6jhm");
    });
});

describe(explainFindings, () => {
    it("should be a no-op when no provider is available", async () => {
        expect.assertions(2);

        const runWithRetry = vi.fn();
        const result = await explainFindings([target("lodash", "4.17.20", vuln())], undefined, undefined, {
            resolveProvider: () => undefined,
            runWithRetry,
        });

        expect(result.size).toBe(0);
        expect(runWithRetry).not.toHaveBeenCalled();
    });

    it("should explain each target and key the map by explainKey", async () => {
        expect.assertions(2);

        const runWithRetry = vi.fn().mockResolvedValue(JSON.stringify({ areYouAtRisk: "no", whatItIs: "x", whatToDo: "y" }));
        const result = await explainFindings([target("lodash", "4.17.20", vuln())], undefined, undefined, {
            resolveProvider: () => provider,
            runWithRetry,
        });

        expect(result.get("lodash@4.17.20:GHSA-35jh-r3h4-6jhm")).toContain("What it is: x");
        expect(runWithRetry).toHaveBeenCalledTimes(1);
    });

    it("should serve a second identical run from cache without calling the provider again", async () => {
        expect.assertions(1);

        const t = [target("serve-static", "1.14.0", vuln({ aliases: [], id: "GHSA-cache-hit-test" }))];

        await explainFindings(t, undefined, undefined, { resolveProvider: () => provider, runWithRetry: vi.fn().mockResolvedValue("cached prose") });

        const secondRun = vi.fn();

        await explainFindings(t, undefined, undefined, { resolveProvider: () => provider, runWithRetry: secondRun });

        expect(secondRun).not.toHaveBeenCalled();
    });

    it("should never exceed a concurrency of 3 in flight", async () => {
        expect.assertions(1);

        let inFlight = 0;
        let peak = 0;
        const targets = Array.from({ length: 12 }, (_, index) => target(`pkg-${String(index)}`, "1.0.0", vuln({ aliases: [], id: `GHSA-conc-${String(index)}` })));

        const runWithRetry = vi.fn().mockImplementation(async () => {
            inFlight += 1;
            peak = Math.max(peak, inFlight);

            await new Promise((resolve) => {
                setTimeout(resolve, 5);
            });

            inFlight -= 1;

            return "prose";
        });

        await explainFindings(targets, undefined, undefined, { resolveProvider: () => provider, runWithRetry });

        expect(peak).toBeLessThanOrEqual(3);
    });

    it("should skip a target whose provider call throws, without rejecting", async () => {
        expect.assertions(1);

        const runWithRetry = vi.fn().mockRejectedValue(new Error("boom"));
        const result = await explainFindings([target("qs", "6.2.0", vuln({ aliases: [], id: "GHSA-throw-test" }))], undefined, undefined, {
            resolveProvider: () => provider,
            runWithRetry,
        });

        expect(result.size).toBe(0);
    });
});
