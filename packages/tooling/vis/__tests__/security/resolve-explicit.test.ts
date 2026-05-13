import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveExplicitPackages, resolveLatestVersions } from "../../src/security/marshalls/resolve-explicit";

describe(resolveLatestVersions, () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns an empty map for no names", async () => {
        expect.assertions(2);

        const result = await resolveLatestVersions([]);

        expect(result.size).toBe(0);
        expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    });

    it("hits the npm /<name>/latest endpoint and parses the version", async () => {
        expect.assertions(2);

        vi.mocked(fetch).mockResolvedValue({
            json: async () => { return { version: "1.2.3" }; },
            ok: true,
        } as Response);

        const result = await resolveLatestVersions(["lodash"]);

        expect(result.get("lodash")).toBe("1.2.3");
        expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe("https://registry.npmjs.org/lodash/latest");
    });

    it("drops names whose endpoint returns non-ok", async () => {
        expect.assertions(1);

        vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);

        const result = await resolveLatestVersions(["does-not-exist"]);

        expect(result.size).toBe(0);
    });

    it("drops names whose endpoint throws", async () => {
        expect.assertions(1);

        vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));

        const result = await resolveLatestVersions(["broken"]);

        expect(result.size).toBe(0);
    });
});

describe(resolveExplicitPackages, () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("coerces semver specs without a network round-trip", async () => {
        expect.assertions(2);

        const result = await resolveExplicitPackages(["react@^18.2.0"]);

        expect(result).toStrictEqual([{ name: "react", version: "18.2.0" }]);
        expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    });

    it("falls back to /latest for dist-tags like 'latest'", async () => {
        expect.assertions(2);

        vi.mocked(fetch).mockResolvedValue({
            json: async () => { return { version: "4.17.21" }; },
            ok: true,
        } as Response);

        const result = await resolveExplicitPackages(["lodash@latest"]);

        expect(result).toStrictEqual([{ name: "lodash", version: "4.17.21" }]);
        expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    });

    it("uses /latest when no spec is supplied", async () => {
        expect.assertions(2);

        vi.mocked(fetch).mockResolvedValue({
            json: async () => { return { version: "5.0.0" }; },
            ok: true,
        } as Response);

        const result = await resolveExplicitPackages(["express"]);

        expect(result).toStrictEqual([{ name: "express", version: "5.0.0" }]);
        expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe("https://registry.npmjs.org/express/latest");
    });

    it("drops entries whose coerce + /latest both fail", async () => {
        expect.assertions(1);

        vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);

        const result = await resolveExplicitPackages(["missing-pkg"]);

        expect(result).toStrictEqual([]);
    });

    it("preserves the original arg order for batch resolution", async () => {
        expect.assertions(1);

        const NAME_PATTERN = /registry\.npmjs\.org\/([^/]+)\/latest/;

        vi.mocked(fetch).mockImplementation(async (url) => {
            const urlString = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
            const name = NAME_PATTERN.exec(urlString)?.[1];

            return {
                json: async () => {
                    return { version: name === "express" ? "5.0.0" : "18.0.0" };
                },
                ok: true,
            } as Response;
        });

        const result = await resolveExplicitPackages(["express", "react@^18", "lodash@4.17.21"]);

        expect(result).toStrictEqual([
            { name: "express", version: "5.0.0" },
            { name: "react", version: "18.0.0" },
            { name: "lodash", version: "4.17.21" },
        ]);
    });

    it("handles scoped names", async () => {
        expect.assertions(1);

        const result = await resolveExplicitPackages(["@scope/pkg@^1.2.3"]);

        expect(result).toStrictEqual([{ name: "@scope/pkg", version: "1.2.3" }]);
    });
});
