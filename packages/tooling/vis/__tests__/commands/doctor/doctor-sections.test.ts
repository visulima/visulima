import { describe, expect, it } from "vitest";

import type { DoctorResults, SectionId } from "../../../src/commands/doctor/sections";
import {
    buildJsonPayload,
    parseSectionList,
    resolveSections,
    SECTION_IDS,
    sectionStatus,
    shouldFail,
    summarizeOptimizations,
} from "../../../src/commands/doctor/sections";
import type { OptimizeEntry } from "../../../src/tui/components/optimize/OptimizeStore";

const opt = (category: OptimizeEntry["category"], name: string): OptimizeEntry =>
    ({
        category,
        description: "test",
        hasCodemod: false,
        overrideSpec: undefined,
        packageName: name,
        severity: "info",
        title: "test",
    }) as unknown as OptimizeEntry;

const baseResults = (overrides: Partial<DoctorResults> = {}): DoctorResults => {
    return {
        duplicates: [],
        elapsedMs: 0,
        installedCount: 0,
        optimizations: [],
        outdated: [],
        runtime: [],
        sections: new Set<SectionId>(SECTION_IDS),
        socketIssues: { alerts: 0, lowScore: 0 },
        supplyChain: { findings: [], status: "ok" },
        vulnCount: 0,
        workspaceCount: 0,
        ...overrides,
    };
};

describe(parseSectionList, () => {
    it("returns an empty set for undefined / empty input", () => {
        expect.assertions(2);

        expect(parseSectionList(undefined).size).toBe(0);
        expect(parseSectionList("").size).toBe(0);
    });

    it("parses a comma-separated, lowercased list of known sections", () => {
        expect.assertions(2);

        const parsed = parseSectionList("security, OPTIMIZATION ");

        expect(parsed.has("security")).toBe(true);
        expect(parsed.has("optimization")).toBe(true);
    });

    it("silently drops unknown tokens", () => {
        expect.assertions(2);

        const parsed = parseSectionList("security,unknown,foo");

        expect(parsed.size).toBe(1);
        expect(parsed.has("security")).toBe(true);
    });
});

describe(resolveSections, () => {
    it("returns all sections when neither flag is supplied", () => {
        // 1 size assertion + 1 per known section (SECTION_IDS has 4 entries).
        expect.assertions(5);

        const sections = resolveSections(undefined, undefined);

        expect(sections.size).toBe(SECTION_IDS.length);

        for (const id of SECTION_IDS) {
            // Every known id must be present.
            expect(sections.has(id)).toBe(true);
        }
    });

    it("--only narrows the set to listed sections", () => {
        expect.assertions(2);

        const sections = resolveSections("security", undefined);

        expect(sections.size).toBe(1);
        expect(sections.has("security")).toBe(true);
    });

    it("--only with no recognised tokens returns empty (caller should fail-fast)", () => {
        expect.assertions(1);

        // Distinguishes an invalid filter from a missing one — execute()
        // exits with code 2 on this, instead of silently scanning everything.
        expect(resolveSections("nope,unknown", undefined).size).toBe(0);
    });

    it("--skip removes the listed sections from the default set", () => {
        expect.assertions(2);

        const sections = resolveSections(undefined, "optimization,runtime");

        expect(sections.has("optimization")).toBe(false);
        expect(sections.has("runtime")).toBe(false);
    });

    it("--only takes precedence when both --only and --skip are set", () => {
        expect.assertions(2);

        const sections = resolveSections("security", "security,optimization");

        // --only=security wins; --skip is ignored.
        expect(sections.size).toBe(1);
        expect(sections.has("security")).toBe(true);
    });
});

describe(summarizeOptimizations, () => {
    it("counts each category and the total", () => {
        expect.assertions(5);

        const counts = summarizeOptimizations([
            opt("native", "chalk"),
            opt("native", "kleur"),
            opt("preferred", "lodash"),
            opt("micro-utility", "is-number"),
            opt("socket", "left-pad"),
        ]);

        expect(counts.native).toBe(2);
        expect(counts.preferred).toBe(1);
        expect(counts.micro).toBe(1);
        expect(counts.socket).toBe(1);
        expect(counts.total).toBe(5);
    });

    it("returns all-zero counts for an empty list", () => {
        expect.assertions(1);

        expect(summarizeOptimizations([])).toStrictEqual({
            micro: 0,
            native: 0,
            preferred: 0,
            socket: 0,
            total: 0,
        });
    });
});

describe(sectionStatus, () => {
    it("returns 'skip' when the section was filtered out", () => {
        expect.assertions(1);

        const results = baseResults({ sections: new Set<SectionId>(["security"]) });

        // dependencies wasn't selected — should report skip rather than ok.
        expect(sectionStatus(results, "dependencies")).toBe("skip");
    });

    it("dependencies → 'warn' when outdated or duplicates exist", () => {
        expect.assertions(2);

        expect(sectionStatus(baseResults({ outdated: [{} as never] }), "dependencies")).toBe("warn");
        expect(sectionStatus(baseResults({ duplicates: [{} as never] }), "dependencies")).toBe("warn");
    });

    it("security → 'error' on vulns or alerts; 'warn' on low score; 'ok' otherwise", () => {
        expect.assertions(3);

        expect(sectionStatus(baseResults({ vulnCount: 1 }), "security")).toBe("error");
        expect(sectionStatus(baseResults({ socketIssues: { alerts: 0, lowScore: 1 } }), "security")).toBe("warn");
        expect(sectionStatus(baseResults(), "security")).toBe("ok");
    });

    it("optimization → 'warn' when there are entries", () => {
        expect.assertions(1);

        expect(sectionStatus(baseResults({ optimizations: [opt("native", "chalk")] }), "optimization")).toBe("warn");
    });

    it("runtime → 'warn' when any diagnostic warns", () => {
        expect.assertions(1);

        const results = baseResults({
            runtime: [{ id: "inotify", message: "low limit", status: "warn" }],
        });

        expect(sectionStatus(results, "runtime")).toBe("warn");
    });
});

describe(buildJsonPayload, () => {
    it("includes a top-level status that escalates over per-section statuses", () => {
        expect.assertions(2);

        const payloadOk = buildJsonPayload(baseResults(), "pnpm");

        expect(payloadOk.status).toBe("ok");

        // Vulnerabilities → security status 'error' → top-level 'error'.
        const payloadError = buildJsonPayload(baseResults({ vulnCount: 3 }), "pnpm");

        expect(payloadError.status).toBe("error");
    });

    it("each section carries its own status field", () => {
        expect.assertions(4);

        const payload = buildJsonPayload(baseResults({ outdated: [{} as never], vulnCount: 1 }), "pnpm");

        expect((payload.dependencies as { status: string }).status).toBe("warn");
        expect((payload.security as { status: string }).status).toBe("error");
        expect(payload.optimization as never).toBeUndefined();
        // The optimization payload uses key `optimizations` (plural).
        expect((payload.optimizations as { status: string }).status).toBe("ok");
    });

    it("section status is 'skip' when the section was filtered out", () => {
        expect.assertions(1);

        const payload = buildJsonPayload(baseResults({ sections: new Set<SectionId>(["security"]) }), "pnpm");

        expect((payload.dependencies as { status: string }).status).toBe("skip");
    });

    it("preserves elapsedMs and packageManager", () => {
        expect.assertions(2);

        const payload = buildJsonPayload(baseResults({ elapsedMs: 1234 }), "yarn");

        expect(payload.elapsedMs).toBe(1234);
        expect(payload.packageManager).toBe("yarn");
    });
});

describe(shouldFail, () => {
    it("default mode fails only on vulnerabilities or socket alerts", () => {
        expect.assertions(4);

        expect(shouldFail(baseResults(), false)).toBe(false);
        expect(shouldFail(baseResults({ vulnCount: 1 }), false)).toBe(true);
        expect(shouldFail(baseResults({ socketIssues: { alerts: 1, lowScore: 0 } }), false)).toBe(true);
        // Outdated/duplicates/runtime warnings shouldn't fail in default mode.
        expect(shouldFail(baseResults({ duplicates: [{} as never], outdated: [{} as never] }), false)).toBe(false);
    });

    it("--strict widens the failure set", () => {
        expect.assertions(3);

        expect(shouldFail(baseResults({ outdated: [{} as never] }), true)).toBe(true);
        expect(shouldFail(baseResults({ duplicates: [{} as never] }), true)).toBe(true);
        expect(shouldFail(baseResults({ runtime: [{ id: "inotify", message: "low", status: "warn" }] }), true)).toBe(true);
    });
});
