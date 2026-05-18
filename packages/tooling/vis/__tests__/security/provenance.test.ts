import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearPackumentCache } from "../../src/security/marshalls/packument";
import { findNewestPriorWithAttestations, runProvenanceMarshall } from "../../src/security/marshalls/provenance";

let homeOverride: string;

vi.mock(import("node:os"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        homedir: () => homeOverride,
    };
});

const stubFetch = (response: { body?: unknown; status?: number }): ReturnType<typeof vi.fn> => {
    const handler = vi.fn(async () => {
        return {
            json: async () => response.body ?? {},
            ok: (response.status ?? 200) < 400,
            status: response.status ?? 200,
        };
    });

    vi.stubGlobal("fetch", handler);

    return handler;
};

const packumentWith = (versions: Record<string, { hasProvenance?: boolean }>): Record<string, unknown> => {
    return {
        name: "demo",
        versions: Object.fromEntries(
            Object.entries(versions).map(([version, info]) => [
                version,
                {
                    dist: info.hasProvenance === true ? { attestations: { provenance: { foo: "bar" } } } : {},
                    version,
                },
            ]),
        ),
    };
};

describe(findNewestPriorWithAttestations, () => {
    it("returns the highest prior version that had attestations", () => {
        expect.assertions(1);

        const packument = packumentWith({
            "1.0.0": { hasProvenance: true },
            "1.1.0": { hasProvenance: true },
            "1.2.0": { hasProvenance: false },
        }) as never;

        expect(findNewestPriorWithAttestations(packument, "1.2.0")).toBe("1.1.0");
    });

    it("returns undefined when no prior had attestations", () => {
        expect.assertions(1);

        const packument = packumentWith({
            "1.0.0": { hasProvenance: false },
            "1.1.0": { hasProvenance: false },
        }) as never;

        expect(findNewestPriorWithAttestations(packument, "1.1.0")).toBeUndefined();
    });

    it("ignores versions newer than the installed one", () => {
        expect.assertions(1);

        const packument = packumentWith({
            "1.0.0": { hasProvenance: false },
            "1.1.0": { hasProvenance: false },
            "1.2.0": { hasProvenance: true },
        }) as never;

        // We never look forward — only at strictly-less versions.
        expect(findNewestPriorWithAttestations(packument, "1.1.0")).toBeUndefined();
    });

    it("skips invalid installed semver", () => {
        expect.assertions(1);

        const packument = packumentWith({ "1.0.0": { hasProvenance: true } }) as never;

        expect(findNewestPriorWithAttestations(packument, "latest")).toBeUndefined();
    });
});

describe(runProvenanceMarshall, () => {
    beforeEach(() => {
        homeOverride = mkdtempSync(join(tmpdir(), "vis-provenance-"));
        clearPackumentCache();
    });

    afterEach(() => {
        vi.unstubAllGlobals();

        if (existsSync(homeOverride)) {
            rmSync(homeOverride, { force: true, recursive: true });
        }
    });

    it("flags a version that lost provenance compared to a prior", async () => {
        expect.assertions(2);

        stubFetch({
            body: packumentWith({
                "1.0.0": { hasProvenance: true },
                "1.1.0": { hasProvenance: false },
            }),
        });

        const findings = await runProvenanceMarshall([{ name: "demo", version: "1.1.0" }]);

        expect(findings).toHaveLength(1);
        expect(findings[0]).toStrictEqual({ packageName: "demo", priorVersionWithProvenance: "1.0.0", version: "1.1.0" });
    });

    it("does not flag when the current version retains provenance", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith({
                "1.0.0": { hasProvenance: true },
                "1.1.0": { hasProvenance: true },
            }),
        });

        const findings = await runProvenanceMarshall([{ name: "demo", version: "1.1.0" }]);

        expect(findings).toStrictEqual([]);
    });

    it("does not flag when no prior version had provenance", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith({
                "1.0.0": { hasProvenance: false },
                "1.1.0": { hasProvenance: false },
            }),
        });

        const findings = await runProvenanceMarshall([{ name: "demo", version: "1.1.0" }]);

        expect(findings).toStrictEqual([]);
    });

    it("respects the allowlist", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith({
                "1.0.0": { hasProvenance: true },
                "1.1.0": { hasProvenance: false },
            }),
        });

        const findings = await runProvenanceMarshall([{ name: "demo", version: "1.1.0" }], { allowlist: ["demo"] });

        expect(findings).toStrictEqual([]);
    });

    it("returns an empty array when the packument is missing (404)", async () => {
        expect.assertions(1);

        stubFetch({ status: 404 });

        const findings = await runProvenanceMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings).toStrictEqual([]);
    });

    it("returns an empty array when MARSHALL_DISABLE_PROVENANCE is set", async () => {
        expect.assertions(2);

        const previous = process.env.MARSHALL_DISABLE_PROVENANCE;
        const fetchSpy = stubFetch({
            body: packumentWith({
                "1.0.0": { hasProvenance: true },
                "1.1.0": { hasProvenance: false },
            }),
        });

        try {
            process.env.MARSHALL_DISABLE_PROVENANCE = "1";

            const findings = await runProvenanceMarshall([{ name: "demo", version: "1.1.0" }]);

            expect(findings).toStrictEqual([]);
            expect(fetchSpy).not.toHaveBeenCalled();
        } finally {
            if (previous === undefined) {
                delete process.env.MARSHALL_DISABLE_PROVENANCE;
            } else {
                process.env.MARSHALL_DISABLE_PROVENANCE = previous;
            }
        }
    });
});
