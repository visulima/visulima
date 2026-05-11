import { describe, expect, it } from "vitest";

import { resolveCacheMode, resolveTurboEnvCompat } from "../../src/backends/factory";

describe(resolveCacheMode, () => {
    it("defaults to readwrite when nothing is set", () => {
        expect.assertions(1);

        expect(resolveCacheMode({})).toBe("readwrite");
    });

    it("honors mode when set", () => {
        expect.assertions(3);

        expect(resolveCacheMode({ mode: "read" })).toBe("read");
        expect(resolveCacheMode({ mode: "write" })).toBe("write");
        expect(resolveCacheMode({ mode: "readwrite" })).toBe("readwrite");
    });
});

describe(resolveTurboEnvCompat, () => {
    it("returns undefined when no url and no TURBO_API", () => {
        expect.assertions(2);

        expect(resolveTurboEnvCompat(undefined, {})).toBeUndefined();
        expect(resolveTurboEnvCompat({}, {})).toBeUndefined();
    });

    it("fills missing url/token/teamId from TURBO_API/TURBO_TOKEN/TURBO_TEAM", () => {
        expect.assertions(1);

        const env = { TURBO_API: "https://cache.example.com", TURBO_TEAM: "my-team", TURBO_TOKEN: "secret-token" };

        expect(resolveTurboEnvCompat(undefined, env)).toStrictEqual({
            teamId: "my-team",
            token: "secret-token",
            url: "https://cache.example.com",
        });
    });

    it("prefers explicit config values over env vars", () => {
        expect.assertions(1);

        const env = { TURBO_API: "https://env.example.com", TURBO_TEAM: "env-team", TURBO_TOKEN: "env-token" };
        const input = { teamId: "config-team", token: "config-token", url: "https://config.example.com" };

        expect(resolveTurboEnvCompat(input, env)).toStrictEqual({
            teamId: "config-team",
            token: "config-token",
            url: "https://config.example.com",
        });
    });

    it("merges partial config with env fallback", () => {
        expect.assertions(1);

        const env = { TURBO_API: "https://env.example.com", TURBO_TEAM: "env-team", TURBO_TOKEN: "env-token" };
        const input = { teamId: "config-team" };

        expect(resolveTurboEnvCompat(input, env)).toStrictEqual({
            teamId: "config-team",
            token: "env-token",
            url: "https://env.example.com",
        });
    });

    it("passes REAPI options through without env-var resolution", () => {
        expect.assertions(2);

        const env = { TURBO_API: "https://env.example.com" };
        const input = { backend: "reapi" as const, url: "grpcs://reapi.example.com" };

        expect(resolveTurboEnvCompat(input, env)).toStrictEqual(input);
        expect(resolveTurboEnvCompat({ backend: "reapi" as const, url: "" }, env)).toBeUndefined();
    });

    it("preserves extra http-backend fields when filling env defaults", () => {
        expect.assertions(1);

        const env = { TURBO_API: "https://env.example.com" };
        const input = { compression: "brotli" as const, mode: "read" as const };

        expect(resolveTurboEnvCompat(input, env)).toStrictEqual({
            compression: "brotli",
            mode: "read",
            teamId: undefined,
            token: undefined,
            url: "https://env.example.com",
        });
    });
});
