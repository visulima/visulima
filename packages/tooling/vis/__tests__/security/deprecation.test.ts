import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runDeprecationMarshall } from "../../src/security/marshalls/deprecation";
import { clearPackumentCache } from "../../src/security/marshalls/packument";

let homeOverride: string;

vi.mock(import("node:os"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        homedir: () => homeOverride,
    };
});

const stubFetch = (body: unknown, status = 200): ReturnType<typeof vi.fn> => {
    const handler = vi.fn(async () => {
        return {
            json: async () => body ?? {},
            ok: status < 400,
            status,
        };
    });

    vi.stubGlobal("fetch", handler);

    return handler;
};

const packument = (versions: Record<string, { deprecated?: string }>, distTags?: Record<string, string>): Record<string, unknown> => {
    return {
        "dist-tags": distTags,
        name: "demo",
        versions: Object.fromEntries(Object.entries(versions).map(([version, entry]) => [version, { version, ...entry }])),
    };
};

describe(runDeprecationMarshall, () => {
    beforeEach(() => {
        homeOverride = mkdtempSync(join(tmpdir(), "vis-deprecation-"));
        clearPackumentCache();
    });

    afterEach(() => {
        vi.unstubAllGlobals();

        if (existsSync(homeOverride)) {
            rmSync(homeOverride, { force: true, recursive: true });
        }
    });

    it("flags the resolved version when it is deprecated", async () => {
        expect.assertions(1);

        stubFetch(packument({ "1.0.0": {}, "2.0.0": { deprecated: "use demo@3" } }));

        const findings = await runDeprecationMarshall([{ name: "demo", version: "2.0.0" }]);

        expect(findings).toStrictEqual([{ packageName: "demo", reason: "use demo@3", version: "2.0.0" }]);
    });

    it("does not flag a non-deprecated version even when another version is deprecated", async () => {
        expect.assertions(1);

        stubFetch(packument({ "1.0.0": { deprecated: "old" }, "2.0.0": {} }));

        const findings = await runDeprecationMarshall([{ name: "demo", version: "2.0.0" }]);

        expect(findings).toStrictEqual([]);
    });

    it("treats an empty/whitespace deprecated string as not deprecated", async () => {
        expect.assertions(1);

        stubFetch(packument({ "1.0.0": { deprecated: "   " } }));

        const findings = await runDeprecationMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings).toStrictEqual([]);
    });

    it("falls back to the latest version when the resolved version is absent", async () => {
        expect.assertions(1);

        stubFetch(packument({ "1.0.0": {}, "2.0.0": { deprecated: "abandoned" } }, { latest: "2.0.0" }));

        const findings = await runDeprecationMarshall([{ name: "demo", version: "9.9.9" }]);

        expect(findings).toStrictEqual([{ packageName: "demo", reason: "abandoned", version: "2.0.0" }]);
    });

    it("strips terminal-escape / control bytes and collapses whitespace in the reason", async () => {
        expect.assertions(1);

        stubFetch(packument({ "1.0.0": { deprecated: "use\u001B[31m demo@3\n\tnow\r" } }));

        const findings = await runDeprecationMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings).toStrictEqual([{ packageName: "demo", reason: "use [31m demo@3 now", version: "1.0.0" }]);
    });

    it("truncates an over-long reason", async () => {
        expect.assertions(2);

        stubFetch(packument({ "1.0.0": { deprecated: "x".repeat(500) } }));

        const findings = await runDeprecationMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings[0]?.reason).toHaveLength(300);
        expect(findings[0]?.reason.endsWith("…")).toBe(true);
    });

    it("respects the package allowlist", async () => {
        expect.assertions(1);

        stubFetch(packument({ "1.0.0": { deprecated: "nope" } }));

        const findings = await runDeprecationMarshall([{ name: "demo", version: "1.0.0" }], { allowlist: ["demo"] });

        expect(findings).toStrictEqual([]);
    });

    it("returns nothing on a 404 packument", async () => {
        expect.assertions(1);

        stubFetch({}, 404);

        const findings = await runDeprecationMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings).toStrictEqual([]);
    });

    it("short-circuits when MARSHALL_DISABLE_DEPRECATION is set", async () => {
        expect.assertions(2);

        const previous = process.env.MARSHALL_DISABLE_DEPRECATION;
        const fetchSpy = stubFetch(packument({ "1.0.0": { deprecated: "x" } }));

        try {
            process.env.MARSHALL_DISABLE_DEPRECATION = "1";

            const findings = await runDeprecationMarshall([{ name: "demo", version: "1.0.0" }]);

            expect(findings).toStrictEqual([]);
            expect(fetchSpy).not.toHaveBeenCalled();
        } finally {
            if (previous === undefined) {
                delete process.env.MARSHALL_DISABLE_DEPRECATION;
            } else {
                process.env.MARSHALL_DISABLE_DEPRECATION = previous;
            }
        }
    });
});
