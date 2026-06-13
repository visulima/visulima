import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock homedir before importing the module under test so the on-disk cache
// lands in a throwaway directory.
const TEST_HOME = join(tmpdir(), `vis-stepsecurity-test-${String(process.pid)}-${String(Date.now())}`);

vi.mock(import("node:os"), async (importOriginal) => {
    const original = await importOriginal<typeof import("node:os")>();

    return { ...original, homedir: () => TEST_HOME };
});

const {
    buildReport,
    clearStepSecurityCache,
    componentSeverity,
    createStepSecurityProvider,
    extractComponents,
    extractIncidentIds,
    fetchStepSecurityReports,
    normaliseVersions,
} = await import("../../src/security/stepsecurity-security");

afterEach(() => {
    clearStepSecurityCache();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.VIS_STEPSECURITY_TOKEN;
    delete process.env.VIS_STEPSECURITY_OWNER;
});

// --- Pure helpers ---

describe("normaliseVersions", () => {
    it("returns undefined for wildcard / empty / missing", () => {
        expect.assertions(4);
        expect(normaliseVersions("*")).toBeUndefined();
        expect(normaliseVersions("")).toBeUndefined();
        expect(normaliseVersions(undefined)).toBeUndefined();
        expect(normaliseVersions(["*"])).toBeUndefined();
    });

    it("splits comma-separated strings", () => {
        expect.assertions(1);
        expect(normaliseVersions("4.17.21, 4.17.20")).toStrictEqual(["4.17.21", "4.17.20"]);
    });

    it("flattens arrays", () => {
        expect.assertions(1);
        expect(normaliseVersions(["1.0.0", "2.0.0,2.0.1"])).toStrictEqual(["1.0.0", "2.0.0", "2.0.1"]);
    });
});

describe("componentSeverity", () => {
    it("defaults to critical when unscored", () => {
        expect.assertions(1);
        expect(componentSeverity({ ecosystem: "npm", incidentId: "i1", name: "x" })).toBe("critical");
    });

    it("respects a valid reported severity", () => {
        expect.assertions(1);
        expect(componentSeverity({ ecosystem: "npm", incidentId: "i1", name: "x", severity: "high" })).toBe("high");
    });
});

describe("extractIncidentIds", () => {
    it("reads a bare array of objects", () => {
        expect.assertions(1);
        expect(extractIncidentIds([{ id: "a" }, { incidentId: "b" }, { incident_id: "c" }])).toStrictEqual(["a", "b", "c"]);
    });

    it("reads the { incidents: [...] } envelope", () => {
        expect.assertions(1);
        expect(extractIncidentIds({ incidents: ["a", { id: "b" }] })).toStrictEqual(["a", "b"]);
    });

    it("returns [] for unrecognised shapes", () => {
        expect.assertions(1);
        expect(extractIncidentIds({ nope: true })).toStrictEqual([]);
    });
});

describe("extractComponents", () => {
    it("normalises a bare array with mixed field names", () => {
        expect.assertions(1);

        const components = extractComponents(
            [
                { name: "left-pad", version: "1.0.0", severity: "Critical", verified: true, description: "rat" },
                { packageName: "@scope/pkg", ecosystem: "PyPI", affectedVersions: ["1.0", "2.0"] },
            ],
            "incident-1",
        );

        expect(components).toStrictEqual([
            {
                description: "rat",
                ecosystem: "npm",
                incidentId: "incident-1",
                name: "left-pad",
                severity: "critical",
                verified: true,
                versions: ["1.0.0"],
            },
            {
                ecosystem: "pypi",
                incidentId: "incident-1",
                name: "@scope/pkg",
                versions: ["1.0", "2.0"],
            },
        ]);
    });

    it("reads the { components: [...] } envelope and skips nameless rows", () => {
        expect.assertions(1);

        const components = extractComponents({ components: [{ version: "1.0.0" }, { name: "ok" }] }, "i1");

        expect(components).toHaveLength(1);
    });
});

describe("buildReport", () => {
    it("crushes the score and emits a malware alert", () => {
        expect.assertions(4);

        const report = buildReport("left-pad", "1.0.0", [{ ecosystem: "npm", incidentId: "i1", name: "left-pad", severity: "critical" }]);

        expect(report.score.overall).toBe(0);
        expect(report.alerts).toHaveLength(1);
        expect(report.alerts[0]).toMatchObject({ severity: "critical", type: "malware" });
        expect(report.alerts[0]?.key).toBe("stepsecurity:i1:left-pad@1.0.0");
    });

    it("splits the namespace out of a scoped name", () => {
        expect.assertions(2);

        const report = buildReport("@scope/pkg", "2.0.0", [{ ecosystem: "npm", incidentId: "i1", name: "@scope/pkg" }]);

        expect(report.name).toBe("pkg");
        expect(report.namespace).toBe("@scope");
    });
});

// --- Provider factory ---

describe("createStepSecurityProvider", () => {
    it("returns undefined when disabled", () => {
        expect.assertions(1);
        expect(createStepSecurityProvider({ apiToken: "t", enabled: false, owner: "o" })).toBeUndefined();
    });

    it("returns undefined when token or owner missing", () => {
        expect.assertions(2);
        expect(createStepSecurityProvider({ enabled: true, owner: "o" })).toBeUndefined();
        expect(createStepSecurityProvider({ apiToken: "t", enabled: true })).toBeUndefined();
    });

    it("falls back to env credentials", () => {
        expect.assertions(2);

        process.env.VIS_STEPSECURITY_TOKEN = "env-token";
        process.env.VIS_STEPSECURITY_OWNER = "env-owner";

        const provider = createStepSecurityProvider({ enabled: true });

        expect(provider).toBeDefined();
        expect(provider?.id).toBe("step-security");
    });
});

// --- Network flow ---

describe("fetchStepSecurityReports", () => {
    it("returns empty for no packages", async () => {
        expect.assertions(1);

        const result = await fetchStepSecurityReports([], {
            apiBaseUrl: "https://api.stepsecurity.io",
            apiToken: "t",
            cacheTtlMs: 1000,
            owner: "o",
            timeoutMs: 1000,
        });

        expect(result.size).toBe(0);
    });

    it("matches a compromised npm package and flags it", async () => {
        expect.assertions(3);

        const fetchMock = vi.fn(async (url: string) => {
            if (url.endsWith("/threat-intel/incidents")) {
                return new Response(JSON.stringify([{ id: "inc-1" }]), { status: 200 });
            }

            return new Response(
                JSON.stringify({
                    components: [
                        { ecosystem: "npm", name: "evil-pkg", severity: "critical", version: "1.2.3" },
                        { ecosystem: "pypi", name: "evil-pkg", version: "9.9.9" },
                    ],
                }),
                { status: 200 },
            );
        });

        vi.stubGlobal("fetch", fetchMock);

        const options = {
            apiBaseUrl: "https://api.stepsecurity.io",
            apiToken: "t",
            cacheTtlMs: 60_000,
            owner: "o",
            timeoutMs: 1000,
        };

        const result = await fetchStepSecurityReports(
            [
                { name: "evil-pkg", version: "1.2.3" },
                { name: "evil-pkg", version: "9.9.9" }, // only the pypi entry matches this version → npm provider ignores it
                { name: "safe-pkg", version: "1.0.0" },
            ],
            options,
        );

        expect(result.has("evil-pkg@1.2.3")).toBe(true);
        expect(result.has("safe-pkg@1.0.0")).toBe(false);
        expect(result.get("evil-pkg@1.2.3")?.alerts[0]).toMatchObject({ severity: "critical", type: "malware" });
    });

    it("treats a versionless component as compromising every version", async () => {
        expect.assertions(1);

        const fetchMock = vi.fn(async (url: string) => {
            if (url.endsWith("/threat-intel/incidents")) {
                return new Response(JSON.stringify(["inc-1"]), { status: 200 });
            }

            return new Response(JSON.stringify([{ ecosystem: "npm", name: "wholly-bad", version: "*" }]), { status: 200 });
        });

        vi.stubGlobal("fetch", fetchMock);

        const result = await fetchStepSecurityReports([{ name: "wholly-bad", version: "7.0.0" }], {
            apiBaseUrl: "https://api.stepsecurity.io",
            apiToken: "t",
            cacheTtlMs: 60_000,
            owner: "o",
            timeoutMs: 1000,
        });

        expect(result.has("wholly-bad@7.0.0")).toBe(true);
    });

    it("degrades gracefully when the incident feed fails", async () => {
        expect.assertions(1);

        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response("nope", { status: 500 })),
        );

        const result = await fetchStepSecurityReports([{ name: "x", version: "1.0.0" }], {
            apiBaseUrl: "https://api.stepsecurity.io",
            apiToken: "t",
            cacheTtlMs: 60_000,
            owner: "o",
            timeoutMs: 1000,
        });

        expect(result.size).toBe(0);
    });

    it("honours pinned incidentIds and skips the feed call", async () => {
        expect.assertions(2);

        const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ ecosystem: "npm", name: "pinned-bad", version: "1.0.0" }]), { status: 200 }));

        vi.stubGlobal("fetch", fetchMock);

        const result = await fetchStepSecurityReports([{ name: "pinned-bad", version: "1.0.0" }], {
            apiBaseUrl: "https://api.stepsecurity.io",
            apiToken: "t",
            cacheTtlMs: 60_000,
            incidentIds: ["pinned-incident"],
            owner: "o",
            timeoutMs: 1000,
        });

        expect(result.has("pinned-bad@1.0.0")).toBe(true);
        // Only the compromised-components endpoint is hit — never the feed.
        expect(fetchMock.mock.calls.every(([url]) => String(url).includes("/compromised-components"))).toBe(true);
    });
});
