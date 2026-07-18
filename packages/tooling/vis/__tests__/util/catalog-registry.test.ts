import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { describe, expect, it, vi } from "vitest";

import type { NpmrcConfig } from "../../src/util/catalog";
import { fetchPackageVersions, getRegistryForPackage, loadNpmrc, parseNpmrc } from "../../src/util/catalog";

// --- .npmrc support ---

describe(parseNpmrc, () => {
    it("should parse default registry", () => {
        expect.assertions(1);

        const config = parseNpmrc("registry=https://custom.registry.com");

        expect(config.defaultRegistry).toBe("https://custom.registry.com");
    });

    it("should parse scoped registry", () => {
        expect.assertions(1);

        const config = parseNpmrc("@myorg:registry=https://npm.myorg.com");

        expect(config.registries.get("@myorg")).toBe("https://npm.myorg.com");
    });

    it("should parse auth token", () => {
        expect.assertions(1);

        const config = parseNpmrc("//npm.myorg.com/:_authToken=secret123");

        expect(config.authTokens.get("npm.myorg.com")).toBe("secret123");
    });

    it("should parse multiple entries", () => {
        expect.assertions(6);

        const content = `registry=https://custom.registry.com
@myorg:registry=https://npm.myorg.com
@another:registry=https://npm.another.com
//npm.myorg.com/:_authToken=token1
//npm.another.com/:_authToken=token2`;

        const config = parseNpmrc(content);

        expect(config.defaultRegistry).toBe("https://custom.registry.com");
        expect(config.registries.size).toBe(2);
        expect(config.registries.get("@myorg")).toBe("https://npm.myorg.com");
        expect(config.registries.get("@another")).toBe("https://npm.another.com");
        expect(config.authTokens.size).toBe(2);
        expect(config.authTokens.get("npm.myorg.com")).toBe("token1");
    });

    it("should ignore comments", () => {
        expect.assertions(1);

        const content = `# This is a comment
; Another comment
registry=https://custom.registry.com`;

        const config = parseNpmrc(content);

        expect(config.defaultRegistry).toBe("https://custom.registry.com");
    });

    it("should ignore empty lines", () => {
        expect.assertions(2);

        const content = `
registry=https://custom.registry.com

@myorg:registry=https://npm.myorg.com
`;

        const config = parseNpmrc(content);

        expect(config.defaultRegistry).toBe("https://custom.registry.com");
        expect(config.registries.get("@myorg")).toBe("https://npm.myorg.com");
    });

    it("should handle empty content", () => {
        expect.assertions(3);

        const config = parseNpmrc("");

        expect(config.defaultRegistry).toBe("https://registry.npmjs.org");
        expect(config.registries.size).toBe(0);
        expect(config.authTokens.size).toBe(0);
    });

    it("should handle values with = in them", () => {
        expect.assertions(1);

        const config = parseNpmrc("//npm.myorg.com/:_authToken=abc=def==");

        expect(config.authTokens.get("npm.myorg.com")).toBe("abc=def==");
    });

    it("should expand ${ENV_VAR} references in auth tokens", () => {
        expect.assertions(1);

        const original = process.env.VIS_TEST_NPM_TOKEN;

        process.env.VIS_TEST_NPM_TOKEN = "resolved-secret";

        try {
            const config = parseNpmrc("//npm.myorg.com/:_authToken=${VIS_TEST_NPM_TOKEN}");

            expect(config.authTokens.get("npm.myorg.com")).toBe("resolved-secret");
        } finally {
            if (original === undefined) {
                delete process.env.VIS_TEST_NPM_TOKEN;
            } else {
                process.env.VIS_TEST_NPM_TOKEN = original;
            }
        }
    });

    it("should drop auth tokens whose ${ENV_VAR} reference is unset", () => {
        expect.assertions(2);

        const original = process.env.VIS_TEST_MISSING_TOKEN;

        delete process.env.VIS_TEST_MISSING_TOKEN;

        try {
            const config = parseNpmrc("//npm.myorg.com/:_authToken=${VIS_TEST_MISSING_TOKEN}");

            expect(config.authTokens.has("npm.myorg.com")).toBe(false);
            expect(config.authTokens.size).toBe(0);
        } finally {
            if (original !== undefined) {
                process.env.VIS_TEST_MISSING_TOKEN = original;
            }
        }
    });

    it("should use the ${VAR:-default} fallback when the variable is unset", () => {
        expect.assertions(1);

        const original = process.env.VIS_TEST_UNSET_TOKEN;

        delete process.env.VIS_TEST_UNSET_TOKEN;

        try {
            const config = parseNpmrc("//npm.myorg.com/:_authToken=${VIS_TEST_UNSET_TOKEN:-fallback-token}");

            expect(config.authTokens.get("npm.myorg.com")).toBe("fallback-token");
        } finally {
            if (original !== undefined) {
                process.env.VIS_TEST_UNSET_TOKEN = original;
            }
        }
    });

    it("should expand ${ENV_VAR} references in registry URLs", () => {
        expect.assertions(1);

        const original = process.env.VIS_TEST_REGISTRY_HOST;

        process.env.VIS_TEST_REGISTRY_HOST = "npm.myorg.com";

        try {
            const config = parseNpmrc("@myorg:registry=https://${VIS_TEST_REGISTRY_HOST}/");

            expect(config.registries.get("@myorg")).toBe("https://npm.myorg.com/");
        } finally {
            if (original === undefined) {
                delete process.env.VIS_TEST_REGISTRY_HOST;
            } else {
                process.env.VIS_TEST_REGISTRY_HOST = original;
            }
        }
    });
});

describe(getRegistryForPackage, () => {
    const config: NpmrcConfig = {
        authTokens: new Map([["npm.myorg.com", "secret"]]),
        defaultRegistry: "https://registry.npmjs.org",
        registries: new Map([["@myorg", "https://npm.myorg.com"]]),
    };

    it("should return scoped registry for matching package", () => {
        expect.assertions(2);

        const result = getRegistryForPackage("@myorg/utils", config);

        expect(result.url).toBe("https://npm.myorg.com");
        expect(result.token).toBe("secret");
    });

    it("should return default registry for unscoped package", () => {
        expect.assertions(2);

        const result = getRegistryForPackage("react", config);

        expect(result.url).toBe("https://registry.npmjs.org");
        expect(result.token).toBeUndefined();
    });

    it("should return default registry for unmatched scope", () => {
        expect.assertions(1);

        const result = getRegistryForPackage("@other/pkg", config);

        expect(result.url).toBe("https://registry.npmjs.org");
    });
});

describe(loadNpmrc, () => {
    it("should load project .npmrc", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, ".npmrc"), "@myorg:registry=https://npm.myorg.com\n");

        const config = loadNpmrc(temporaryDirectory);

        expect(config.registries.get("@myorg")).toBe("https://npm.myorg.com");
    });

    it("should return defaults when no .npmrc exists", () => {
        expect.assertions(2);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        // Isolate from host ~/.npmrc by pointing HOME to a directory without one
        const originalHome = process.env.HOME;

        process.env.HOME = temporaryDirectory;

        try {
            const config = loadNpmrc(temporaryDirectory);

            expect(config.defaultRegistry).toBe("https://registry.npmjs.org");
            expect(config.registries.size).toBe(0);
        } finally {
            process.env.HOME = originalHome;
        }
    });
});

// --- fetchPackageVersions with timeout and registry ---

describe(fetchPackageVersions, () => {
    it("should use custom registry URL", async () => {
        expect.assertions(2);

        vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
            const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

            expect(url).toBe("https://custom.registry.com/react");

            return {
                json: async () => {
                    return { "dist-tags": { latest: "19.0.0" }, versions: { "19.0.0": {} } };
                },
                ok: true,
            } as Response;
        });

        const result = await fetchPackageVersions("react", { url: "https://custom.registry.com" });

        expect(result.latest).toBe("19.0.0");

        vi.restoreAllMocks();
    });

    it("should pass auth token in header", async () => {
        expect.assertions(1);

        vi.spyOn(globalThis, "fetch").mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
            const headers = init?.headers as Record<string, string>;

            expect(headers["Authorization"]).toBe("Bearer mytoken");

            return {
                json: async () => {
                    return { "dist-tags": { latest: "1.0.0" }, versions: { "1.0.0": {} } };
                },
                ok: true,
            } as Response;
        });

        await fetchPackageVersions("pkg", { authToken: "mytoken", url: "https://npm.example.com" });

        vi.restoreAllMocks();
    });

    it("should abort on timeout", async () => {
        expect.assertions(1);

        vi.spyOn(globalThis, "fetch").mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
            // Wait longer than timeout
            await new Promise((resolve, reject) => {
                const timer = setTimeout(resolve, 5000);

                init?.signal?.addEventListener("abort", () => {
                    clearTimeout(timer);
                    reject(new DOMException("Aborted", "AbortError"));
                });
            });

            return {
                json: async () => {
                    return {};
                },
                ok: true,
            } as Response;
        });

        await expect(fetchPackageVersions("slow-pkg", undefined, 50)).rejects.toThrow("Aborted");

        vi.restoreAllMocks();
    });

    it("should strip trailing slash from registry URL", async () => {
        expect.assertions(1);

        vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
            const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

            expect(url).toBe("https://custom.registry.com/react");

            return {
                json: async () => {
                    return { "dist-tags": { latest: "1.0.0" }, versions: { "1.0.0": {} } };
                },
                ok: true,
            } as Response;
        });

        await fetchPackageVersions("react", { url: "https://custom.registry.com/" });

        vi.restoreAllMocks();
    });
});
