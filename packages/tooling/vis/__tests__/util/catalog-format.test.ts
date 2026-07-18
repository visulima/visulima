import { describe, expect, it, vi } from "vitest";

import type { CatalogCheckOptions, CheckOutdatedResult, NpmrcConfig } from "../../src/util/catalog";
import {
    checkOutdated,
    fetchChangelogInfo,
    fetchVulnerabilities,
    formatOutdatedJson,
    formatOutdatedMinimal,
    formatOutdatedTable,
    formatSummary,
} from "../../src/util/catalog";

// --- checkOutdated with npmrc ---

describe("checkOutdated with npmrcConfig", () => {
    it("should use scoped registry from npmrc", async () => {
        expect.assertions(1);

        const fetchCalls: string[] = [];

        vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
            const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

            fetchCalls.push(url);

            return {
                json: async () => {
                    return { "dist-tags": { latest: "2.0.0" }, versions: { "1.0.0": {}, "2.0.0": {} } };
                },
                ok: true,
            } as Response;
        });

        const catalogs = new Map([["default", new Map([["@myorg/utils", "^1.0.0"]])]]);
        const options: CatalogCheckOptions = { exclude: [], ignore: [], include: [], includeLocked: false, includePrerelease: false, target: "latest" };
        const npmrcConfig: NpmrcConfig = {
            authTokens: new Map(),
            defaultRegistry: "https://registry.npmjs.org",
            registries: new Map([["@myorg", "https://npm.myorg.com"]]),
        };

        await checkOutdated(catalogs, options, npmrcConfig);

        expect(fetchCalls[0]).toBe("https://npm.myorg.com/@myorg/utils");

        vi.restoreAllMocks();
    });

    it("should use default registry when no npmrcConfig", async () => {
        expect.assertions(1);

        const fetchCalls: string[] = [];

        vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
            fetchCalls.push(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);

            return {
                json: async () => {
                    return { "dist-tags": { latest: "2.0.0" }, versions: { "1.0.0": {}, "2.0.0": {} } };
                },
                ok: true,
            } as Response;
        });

        const catalogs = new Map([["default", new Map([["react", "^1.0.0"]])]]);
        const options: CatalogCheckOptions = { exclude: [], ignore: [], include: [], includeLocked: false, includePrerelease: false, target: "latest" };

        await checkOutdated(catalogs, options);

        expect(fetchCalls[0]).toBe("https://registry.npmjs.org/react");

        vi.restoreAllMocks();
    });
});

// --- Security scanning (OSV.dev) ---

describe(fetchVulnerabilities, () => {
    it("should return vulnerabilities from OSV batch API", async () => {
        expect.assertions(9);

        vi.spyOn(globalThis, "fetch").mockImplementation(
            async () =>
                ({
                    json: async () => {
                        return {
                            results: [
                                {
                                    vulns: [
                                        {
                                            affected: [{ ranges: [{ events: [{ introduced: "0" }, { fixed: "4.17.21" }] }] }],
                                            id: "GHSA-1234-5678",
                                            severity: [{ score: "7.5", type: "CVSS_V3" }],
                                            summary: "Prototype Pollution",
                                        },
                                    ],
                                },
                                { vulns: [] },
                            ],
                        };
                    },
                    ok: true,
                }) as Response,
        );

        const result = await fetchVulnerabilities([
            { name: "lodash", version: "4.17.20" },
            { name: "react", version: "18.2.0" },
        ]);

        expect(result.size).toBe(1);
        expect(result.has("lodash")).toBe(true);
        expect(result.has("react")).toBe(false);

        const vulns = result.get("lodash");

        expect(vulns).toHaveLength(1);
        expect(vulns?.[0]?.id).toBe("GHSA-1234-5678");
        expect(vulns?.[0]?.severity).toBe("HIGH");
        expect(vulns?.[0]?.cvssScore).toBe(7.5);
        expect(vulns?.[0]?.fixedVersions).toStrictEqual(["4.17.21"]);
        expect(vulns?.[0]?.summary).toBe("Prototype Pollution");

        vi.restoreAllMocks();
    });

    it("should return empty map on API failure", async () => {
        expect.assertions(1);

        vi.spyOn(globalThis, "fetch").mockImplementation(
            async () =>
                ({
                    ok: false,
                    status: 500,
                }) as Response,
        );

        const result = await fetchVulnerabilities([{ name: "lodash", version: "4.17.20" }]);

        expect(result.size).toBe(0);

        vi.restoreAllMocks();
    });

    it("should return empty map on network error", async () => {
        expect.assertions(1);

        vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
            throw new Error("Network error");
        });

        const result = await fetchVulnerabilities([{ name: "lodash", version: "4.17.20" }]);

        expect(result.size).toBe(0);

        vi.restoreAllMocks();
    });

    it("should return empty map for empty input", async () => {
        expect.assertions(1);

        const result = await fetchVulnerabilities([]);

        expect(result.size).toBe(0);
    });

    it("should map severity from database_specific", async () => {
        expect.assertions(1);

        vi.spyOn(globalThis, "fetch").mockImplementation(
            async () =>
                ({
                    json: async () => {
                        return {
                            results: [
                                {
                                    vulns: [
                                        {
                                            database_specific: { severity: "CRITICAL" },
                                            id: "GHSA-test",
                                            summary: "Test",
                                        },
                                    ],
                                },
                            ],
                        };
                    },
                    ok: true,
                }) as Response,
        );

        const result = await fetchVulnerabilities([{ name: "pkg", version: "1.0.0" }]);

        expect(result.get("pkg")?.[0]?.severity).toBe("CRITICAL");

        vi.restoreAllMocks();
    });

    it("should map CVSS score ranges correctly", async () => {
        expect.assertions(4);

        const makeResponse = (score: string) =>
            ({
                json: async () => {
                    return {
                        results: [
                            {
                                vulns: [
                                    {
                                        id: "GHSA-test",
                                        severity: [{ score, type: "CVSS_V3" }],
                                        summary: "Test",
                                    },
                                ],
                            },
                        ],
                    };
                },
                ok: true,
            }) as Response;

        // CRITICAL >= 9.0
        vi.spyOn(globalThis, "fetch").mockImplementation(async () => makeResponse("9.8"));

        const criticalResult = await fetchVulnerabilities([{ name: "a", version: "1.0.0" }]);

        expect(criticalResult.get("a")?.[0]?.severity).toBe("CRITICAL");

        vi.restoreAllMocks();

        // HIGH >= 7.0
        vi.spyOn(globalThis, "fetch").mockImplementation(async () => makeResponse("7.0"));

        const highResult = await fetchVulnerabilities([{ name: "a", version: "1.0.0" }]);

        expect(highResult.get("a")?.[0]?.severity).toBe("HIGH");

        vi.restoreAllMocks();

        // MODERATE >= 4.0
        vi.spyOn(globalThis, "fetch").mockImplementation(async () => makeResponse("4.0"));

        const moderateResult = await fetchVulnerabilities([{ name: "a", version: "1.0.0" }]);

        expect(moderateResult.get("a")?.[0]?.severity).toBe("MODERATE");

        vi.restoreAllMocks();

        // LOW < 4.0
        vi.spyOn(globalThis, "fetch").mockImplementation(async () => makeResponse("2.5"));

        const lowResult = await fetchVulnerabilities([{ name: "a", version: "1.0.0" }]);

        expect(lowResult.get("a")?.[0]?.severity).toBe("LOW");

        vi.restoreAllMocks();
    });

    it("should extract multiple fixed versions from affected ranges", async () => {
        expect.assertions(1);

        vi.spyOn(globalThis, "fetch").mockImplementation(
            async () =>
                ({
                    json: async () => {
                        return {
                            results: [
                                {
                                    vulns: [
                                        {
                                            affected: [
                                                { ranges: [{ events: [{ introduced: "0" }, { fixed: "1.2.0" }] }] },
                                                { ranges: [{ events: [{ introduced: "2.0.0" }, { fixed: "2.1.0" }] }] },
                                            ],
                                            id: "GHSA-test",
                                            summary: "Test",
                                        },
                                    ],
                                },
                            ],
                        };
                    },
                    ok: true,
                }) as Response,
        );

        const result = await fetchVulnerabilities([{ name: "pkg", version: "1.0.0" }]);

        expect(result.get("pkg")?.[0]?.fixedVersions).toStrictEqual(["1.2.0", "2.1.0"]);

        vi.restoreAllMocks();
    });
});

describe("checkOutdated with security", () => {
    it("should enrich outdated entries with vulnerability data when security=true", async () => {
        expect.assertions(5);

        let callCount = 0;

        vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
            const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

            // npm registry call
            if (url.includes("registry.npmjs.org")) {
                return {
                    json: async () => {
                        return {
                            "dist-tags": { latest: "4.17.21" },
                            versions: { "4.17.20": {}, "4.17.21": {} },
                        };
                    },
                    ok: true,
                } as Response;
            }

            // OSV API call
            if (url.includes("osv.dev")) {
                callCount += 1;

                return {
                    json: async () => {
                        return {
                            results: [
                                {
                                    vulns: [
                                        {
                                            affected: [{ ranges: [{ events: [{ introduced: "0" }, { fixed: "4.17.21" }] }] }],
                                            id: "GHSA-sec-1234",
                                            severity: [{ score: "7.5", type: "CVSS_V3" }],
                                            summary: "Prototype Pollution in lodash",
                                        },
                                    ],
                                },
                            ],
                        };
                    },
                    ok: true,
                } as Response;
            }

            return { ok: false, status: 404 } as Response;
        });

        const catalogs = new Map([["default", new Map([["lodash", "^4.17.20"]])]]);
        const options: CatalogCheckOptions = { exclude: [], ignore: [], include: [], includePrerelease: false, security: true, target: "latest" };
        const { outdated } = await checkOutdated(catalogs, options);

        expect(outdated).toHaveLength(1);
        expect(outdated[0]?.vulnerabilities).toBeDefined();
        expect(outdated[0]?.vulnerabilities).toHaveLength(1);
        expect(outdated[0]?.vulnerabilities?.[0]?.id).toBe("GHSA-sec-1234");
        expect(callCount).toBe(1);

        vi.restoreAllMocks();
    });

    it("should not call OSV when security=false", async () => {
        expect.assertions(3);

        vi.spyOn(globalThis, "fetch").mockImplementation(
            async () =>
                ({
                    json: async () => {
                        return {
                            "dist-tags": { latest: "2.0.0" },
                            versions: { "1.0.0": {}, "2.0.0": {} },
                        };
                    },
                    ok: true,
                }) as Response,
        );

        const catalogs = new Map([["default", new Map([["react", "^1.0.0"]])]]);
        const options: CatalogCheckOptions = { exclude: [], ignore: [], include: [], includePrerelease: false, security: false, target: "latest" };
        const { outdated } = await checkOutdated(catalogs, options);

        expect(outdated).toHaveLength(1);
        expect(outdated[0]?.vulnerabilities).toBeUndefined();

        // Only npm registry calls, no OSV
        const { calls } = (globalThis.fetch as ReturnType<typeof vi.fn>).mock;

        expect(calls.every((c: unknown[]) => !(c[0] as string).includes("osv.dev"))).toBe(true);

        vi.restoreAllMocks();
    });
});

describe("formatOutdatedTable with security", () => {
    it("should show [SEC] prefix for entries with vulnerabilities", () => {
        expect.assertions(4);

        const logs: string[] = [];
        const mockLogger = { info: (message: string) => logs.push(message) } as unknown as Console;

        formatOutdatedTable(
            [
                {
                    catalogName: "default",
                    currentRange: "^4.17.20",
                    newRange: "^4.17.21",
                    packageName: "lodash",
                    targetVersion: "4.17.21",
                    updateType: "patch",
                    vulnerabilities: [{ cvssScore: 7.5, fixedVersions: ["4.17.21"], id: "GHSA-1234", severity: "HIGH", summary: "Prototype Pollution" }],
                },
                {
                    catalogName: "default",
                    currentRange: "^18.0.0",
                    newRange: "^19.0.0",
                    packageName: "react",
                    targetVersion: "19.0.0",
                    updateType: "major",
                },
            ],
            mockLogger,
        );

        const output = logs.join("\n");

        expect(output).toContain("[SEC] lodash");
        expect(output).toContain("HIGH GHSA-1234");
        expect(output).toContain("Prototype Pollution");
        expect(output).not.toContain("[SEC] react");
    });
});

describe("formatSummary with security", () => {
    it("should include vulnerability count in summary", () => {
        expect.assertions(3);

        const result = formatSummary([
            {
                catalogName: "default",
                currentRange: "^4.17.20",
                newRange: "^4.17.21",
                packageName: "lodash",
                targetVersion: "4.17.21",
                updateType: "patch",
                vulnerabilities: [{ cvssScore: 7.5, fixedVersions: [], id: "GHSA-1234", severity: "HIGH", summary: "test" }],
            },
            {
                catalogName: "default",
                currentRange: "^18.0.0",
                newRange: "^19.0.0",
                packageName: "react",
                targetVersion: "19.0.0",
                updateType: "major",
            },
        ]);

        expect(result).toContain("1 major");
        expect(result).toContain("1 patch");
        expect(result).toContain("1 with vulnerabilities");
    });

    it("should not mention vulnerabilities when none found", () => {
        expect.assertions(1);

        const result = formatSummary([
            {
                catalogName: "default",
                currentRange: "^18.0.0",
                newRange: "^19.0.0",
                packageName: "react",
                targetVersion: "19.0.0",
                updateType: "major",
            },
        ]);

        expect(result).not.toContain("vulnerabilit");
    });
});

// --- fetchChangelogInfo ---

describe(fetchChangelogInfo, () => {
    it("should return GitHub release URL when repo is on GitHub", async () => {
        expect.assertions(3);

        vi.spyOn(globalThis, "fetch").mockImplementation(
            async () =>
                ({
                    json: async () => {
                        return { repository: { url: "git+https://github.com/facebook/react.git" } };
                    },
                    ok: true,
                }) as Response,
        );

        const result = await fetchChangelogInfo([
            { catalogName: "default", currentRange: "^18.0.0", newRange: "^19.0.0", packageName: "react", targetVersion: "19.0.0", updateType: "major" },
        ]);

        expect(result).toHaveLength(1);
        expect(result[0]?.releaseUrl).toBe("https://github.com/facebook/react/releases/tag/v19.0.0");
        expect(result[0]?.repoUrl).toBe("https://github.com/facebook/react");

        vi.restoreAllMocks();
    });

    it("should fallback to npm URL when no repo info", async () => {
        expect.assertions(2);

        vi.spyOn(globalThis, "fetch").mockImplementation(
            async () =>
                ({
                    json: async () => {
                        return {};
                    },
                    ok: true,
                }) as Response,
        );

        const result = await fetchChangelogInfo([
            { catalogName: "default", currentRange: "^1.0.0", newRange: "^2.0.0", packageName: "my-pkg", targetVersion: "2.0.0", updateType: "major" },
        ]);

        expect(result[0]?.releaseUrl).toBeUndefined();
        expect(result[0]?.npmUrl).toBe("https://www.npmjs.com/package/my-pkg");

        vi.restoreAllMocks();
    });

    it("should handle fetch failure gracefully", async () => {
        expect.assertions(2);

        vi.spyOn(globalThis, "fetch").mockImplementation(async () => ({ ok: false, status: 404 }) as Response);

        const result = await fetchChangelogInfo([
            { catalogName: "default", currentRange: "^1.0.0", newRange: "^2.0.0", packageName: "missing-pkg", targetVersion: "2.0.0", updateType: "major" },
        ]);

        expect(result).toHaveLength(1);
        expect(result[0]?.npmUrl).toBe("https://www.npmjs.com/package/missing-pkg");

        vi.restoreAllMocks();
    });

    it("should handle non-GitHub repos", async () => {
        expect.assertions(2);

        vi.spyOn(globalThis, "fetch").mockImplementation(
            async () =>
                ({
                    json: async () => {
                        return { repository: { url: "https://gitlab.com/my/repo.git" } };
                    },
                    ok: true,
                }) as Response,
        );

        const result = await fetchChangelogInfo([
            { catalogName: "default", currentRange: "^1.0.0", newRange: "^2.0.0", packageName: "gitlab-pkg", targetVersion: "2.0.0", updateType: "major" },
        ]);

        expect(result[0]?.releaseUrl).toBeUndefined();
        expect(result[0]?.repoUrl).toBe("https://gitlab.com/my/repo.git");

        vi.restoreAllMocks();
    });

    it("should handle multiple packages in parallel", async () => {
        expect.assertions(2);

        vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
            const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
            const name = url.replace("https://registry.npmjs.org/", "");

            return {
                json: async () => {
                    return { repository: { url: `git+https://github.com/owner/${name}.git` } };
                },
                ok: true,
            } as Response;
        });

        const result = await fetchChangelogInfo([
            { catalogName: "default", currentRange: "^1.0.0", newRange: "^2.0.0", packageName: "pkg-a", targetVersion: "2.0.0", updateType: "major" },
            { catalogName: "default", currentRange: "^1.0.0", newRange: "^2.0.0", packageName: "pkg-b", targetVersion: "2.0.0", updateType: "major" },
        ]);

        expect(result).toHaveLength(2);
        expect(result[0]?.releaseUrl).toContain("pkg-a");

        vi.restoreAllMocks();
    });

    it("caps concurrent registry requests at 8", async () => {
        expect.assertions(2);

        let inFlight = 0;
        let maxInFlight = 0;

        vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);

            await new Promise((resolve) => {
                setTimeout(resolve, 5);
            });

            inFlight -= 1;

            const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

            return {
                json: async () => {
                    return { repository: { url: `git+https://github.com/owner/${url}.git` } };
                },
                ok: true,
            } as Response;
        });

        const packages = Array.from({ length: 20 }, (_unused, index) => {
            return {
                catalogName: "default",
                currentRange: "^1.0.0",
                newRange: "^2.0.0",
                packageName: `pkg-${index}`,
                targetVersion: "2.0.0",
                updateType: "minor" as const,
            };
        });

        const result = await fetchChangelogInfo(packages);

        expect(result).toHaveLength(20);
        expect(maxInFlight).toBeLessThanOrEqual(8);

        vi.restoreAllMocks();
    });

    it("requests the latest version manifest instead of the full packument", async () => {
        expect.assertions(1);

        const requestedUrls: string[] = [];

        vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
            requestedUrls.push(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);

            return {
                json: async () => {
                    return {};
                },
                ok: true,
            } as Response;
        });

        await fetchChangelogInfo([
            { catalogName: "default", currentRange: "^1.0.0", newRange: "^2.0.0", packageName: "react", targetVersion: "19.0.0", updateType: "major" },
        ]);

        expect(requestedUrls[0]).toBe("https://registry.npmjs.org/react/latest");

        vi.restoreAllMocks();
    });

    it("routes scoped packages to the configured private registry", async () => {
        expect.assertions(3);

        const requestedUrls: string[] = [];
        const requestedAuth: (string | undefined)[] = [];

        vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            requestedUrls.push(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
            const authHeader = (init?.headers as Record<string, string> | undefined)?.Authorization;

            requestedAuth.push(authHeader);

            return {
                json: async () => {
                    return { repository: { url: "git+https://github.com/myorg/lib.git" } };
                },
                ok: true,
            } as Response;
        });

        const config = {
            authTokens: new Map([["npm.myorg.com", "secret-token"]]),
            defaultRegistry: "https://registry.npmjs.org",
            registries: new Map([["@myorg", "https://npm.myorg.com"]]),
        };

        await fetchChangelogInfo(
            [{ catalogName: "default", currentRange: "^1.0.0", newRange: "^2.0.0", packageName: "@myorg/lib", targetVersion: "2.0.0", updateType: "major" }],
            10_000,
            config,
        );

        expect(requestedUrls[0]).toBe("https://npm.myorg.com/@myorg/lib/latest");
        expect(requestedAuth[0]).toBe("Bearer secret-token");
        expect(requestedUrls).toHaveLength(1);

        vi.restoreAllMocks();
    });

    it("falls back to the public registry for unscoped packages", async () => {
        expect.assertions(2);

        const requestedUrls: string[] = [];

        vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
            requestedUrls.push(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);

            return {
                json: async () => {
                    return {};
                },
                ok: true,
            } as Response;
        });

        const config = {
            authTokens: new Map(),
            defaultRegistry: "https://registry.npmjs.org",
            registries: new Map([["@myorg", "https://npm.myorg.com"]]),
        };

        await fetchChangelogInfo(
            [{ catalogName: "default", currentRange: "^1.0.0", newRange: "^2.0.0", packageName: "react", targetVersion: "19.0.0", updateType: "major" }],
            10_000,
            config,
        );

        expect(requestedUrls[0]).toBe("https://registry.npmjs.org/react/latest");
        expect(requestedUrls).toHaveLength(1);

        vi.restoreAllMocks();
    });
});

// --- Output formatting ---

describe(formatOutdatedJson, () => {
    it("should produce valid JSON with outdated and failed", () => {
        expect.assertions(3);

        const result: CheckOutdatedResult = {
            failed: ["broken-pkg"],
            outdated: [
                {
                    catalogName: "default",
                    currentRange: "^18.0.0",
                    newRange: "^19.0.0",
                    packageName: "react",
                    targetVersion: "19.0.0",
                    updateType: "major",
                },
            ],
        };
        const json = formatOutdatedJson(result);
        const parsed = JSON.parse(json);

        expect(parsed.outdated).toHaveLength(1);
        expect(parsed.outdated[0].packageName).toBe("react");
        expect(parsed.failed).toStrictEqual(["broken-pkg"]);
    });

    it("should produce valid JSON for empty results", () => {
        expect.assertions(2);

        const json = formatOutdatedJson({ failed: [], outdated: [] });
        const parsed = JSON.parse(json);

        expect(parsed.outdated).toHaveLength(0);
        expect(parsed.failed).toHaveLength(0);
    });
});

describe(formatOutdatedMinimal, () => {
    it("should format one entry per line", () => {
        expect.assertions(4);

        const result = formatOutdatedMinimal([
            {
                catalogName: "default",
                currentRange: "^18.0.0",
                newRange: "^19.0.0",
                packageName: "react",
                targetVersion: "19.0.0",
                updateType: "major",
            },
            {
                catalogName: "default",
                currentRange: "~5.3.0",
                newRange: "~5.7.0",
                packageName: "typescript",
                targetVersion: "5.7.0",
                updateType: "minor",
            },
        ]);

        const lines = result.split("\n");

        expect(lines).toHaveLength(2);
        expect(lines[0]).toContain("react");
        expect(lines[0]).toContain("→");
        expect(lines[1]).toContain("typescript");
    });

    it("should return empty string for no entries", () => {
        expect.assertions(1);

        expect(formatOutdatedMinimal([])).toBe("");
    });
});
