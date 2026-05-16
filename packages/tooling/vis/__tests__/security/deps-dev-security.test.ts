import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_HOME = join(tmpdir(), `vis-deps-dev-test-${String(process.pid)}-${String(Date.now())}`);

vi.mock(import("node:os"), async (importOriginal) => {
    const original = await importOriginal<typeof import("node:os")>();

    return { ...original, homedir: () => TEST_HOME };
});

const { advisoryToAlert, clearDepsDevCache, createDepsDevProvider, cvssToSeverity, fetchDepsDevReports, scorecardToScore } = await import("../../src/security/deps-dev-security");

const setupHome = (): void => {
    mkdirSync(TEST_HOME, { recursive: true });
};

const teardownHome = (): void => {
    try {
        rmSync(TEST_HOME, { force: true, recursive: true });
    } catch {
        // ignore — test cleanup
    }
};

describe("deps-dev-security", () => {
    beforeEach(() => {
        setupHome();
    });

    afterEach(() => {
        clearDepsDevCache();
        teardownHome();
        vi.restoreAllMocks();
    });

    describe("cvssToSeverity", () => {
        it("maps cvss bands to severity labels", () => {
            expect.assertions(5);
            expect(cvssToSeverity(9.5)).toBe("critical");
            expect(cvssToSeverity(7)).toBe("high");
            expect(cvssToSeverity(4.5)).toBe("medium");
            expect(cvssToSeverity(2)).toBe("low");
            // Missing CVSS — assume medium, the most common real-world band.
            expect(cvssToSeverity(undefined)).toBe("medium");
        });
    });

    describe("scorecardToScore", () => {
        it("returns neutral 0.5 scores when scorecard is missing", () => {
            expect.assertions(2);

            const score = scorecardToScore(undefined);

            expect(score.license).toBe(0.5);
            expect(score.overall).toBe(0.5);
        });

        it("converts 0–10 scorecard scores to 0–1 axis averages", () => {
            expect.assertions(3);

            const score = scorecardToScore({
                checks: [
                    { name: "Maintained", score: 10 },
                    { name: "Code-Review", score: 8 },
                    { name: "License", score: 9 },
                ],
                overallScore: 7.4,
            });

            // (10 + 8) / 2 / 10 = 0.9
            expect(score.maintenance).toBe(0.9);
            // 9 / 10 = 0.9
            expect(score.license).toBe(0.9);
            // overallScore wins when present
            expect(score.overall).toBe(0.74);
        });

        it("filters -1 'not applicable' scorecard checks", () => {
            expect.assertions(1);

            const score = scorecardToScore({
                checks: [
                    { name: "Pinned-Dependencies", score: -1 },
                    { name: "Pinned-Dependencies", score: 6 },
                ],
                overallScore: 5,
            });

            // -1 entry is dropped; only the 6 contributes: 6/10 = 0.6
            expect(score.supplyChain).toBe(0.6);
        });

        it("falls back to a 5-axis average when overallScore is missing", () => {
            expect.assertions(1);

            const score = scorecardToScore({
                checks: [
                    { name: "Maintained", score: 10 },
                    { name: "License", score: 10 },
                ],
            });

            // license=1.0, maintenance=1.0, others=0.5 → (1+1+0.5+0.5+0.5)/5 = 0.7
            expect(score.overall).toBe(0.7);
        });

        it("ignores unmapped scorecard checks", () => {
            expect.assertions(1);

            const score = scorecardToScore({
                checks: [{ name: "Unknown-Future-Check", score: 10 }],
                overallScore: 5,
            });

            // No mapped checks contributed → all buckets stay neutral 0.5.
            expect(score.license).toBe(0.5);
        });
    });

    describe("advisoryToAlert", () => {
        it("extracts the CVE alias when present", () => {
            expect.assertions(2);

            const alert = advisoryToAlert(
                "GHSA-f23m-r3pf-42rh",
                { aliases: ["CVE-2024-12345", "OSV-2024-001"], cvss3Score: 7.5 },
                "2024-01-01T00:00:00Z",
            );

            expect(alert.severity).toBe("high");
            expect(alert.props?.cveId).toBe("CVE-2024-12345");
        });

        it("falls back to medium severity when CVSS is missing", () => {
            expect.assertions(1);

            const alert = advisoryToAlert("GHSA-test", undefined, undefined);

            expect(alert.severity).toBe("medium");
        });
    });

    describe("fetchDepsDevReports", () => {
        it("returns an empty map when given no packages", async () => {
            expect.assertions(1);

            const result = await fetchDepsDevReports([]);

            expect(result.size).toBe(0);
        });

        it("graceful failure: returns empty when the version endpoint errors out", async () => {
            expect.assertions(1);

            vi.stubGlobal(
                "fetch",
                vi.fn(async () => new Response("server error", { status: 500 })),
            );

            const result = await fetchDepsDevReports([{ name: "lodash", version: "4.17.21" }]);

            expect(result.size).toBe(0);
        });

        it("assembles a report from version + project + advisory responses", async () => {
            expect.assertions(5);

            const fetchMock = vi.fn(async (url: string | URL) => {
                const u = typeof url === "string" ? url : url.toString();

                if (u.includes("/versions/")) {
                    return Response.json({
                        advisoryKeys: [{ id: "GHSA-test-1234" }],
                        licenses: ["MIT"],
                        publishedAt: "2024-01-01T00:00:00Z",
                        relatedProjects: [{ projectKey: { id: "github.com/example/repo" }, relationType: "SOURCE_REPO" }],
                        versionKey: { name: "lodash", system: "NPM", version: "4.17.21" },
                    }, { headers: { "content-type": "application/json" }, status: 200 });
                }

                if (u.includes("/projects/")) {
                    return Response.json({
                        license: "MIT",
                        scorecard: {
                            checks: [
                                { name: "Maintained", score: 10 },
                                { name: "License", score: 10 },
                            ],
                            overallScore: 8.5,
                        },
                    }, { headers: { "content-type": "application/json" }, status: 200 });
                }

                if (u.includes("/advisories/")) {
                    return Response.json({
                        aliases: ["CVE-2024-9999"],
                        cvss3Score: 9.2,
                        title: "Test vulnerability",
                    }, { headers: { "content-type": "application/json" }, status: 200 });
                }

                return new Response("not found", { status: 404 });
            });

            vi.stubGlobal("fetch", fetchMock);

            const result = await fetchDepsDevReports([{ name: "lodash", version: "4.17.21" }]);
            const report = result.get("lodash@4.17.21");

            expect(report).toBeDefined();
            expect(report?.license).toBe("MIT");
            // Critical advisory pulls vulnerability axis down to 0.2; overall recomputed.
            expect(report?.score.vulnerability).toBe(0.2);
            expect(report?.alerts).toHaveLength(1);
            expect(report?.alerts[0].severity).toBe("critical");
        });

        it("handles packages without a source repo (no Scorecard)", async () => {
            expect.assertions(3);

            const fetchMock = vi.fn(async (url: string | URL) => {
                const u = typeof url === "string" ? url : url.toString();

                if (u.includes("/versions/")) {
                    return Response.json({
                        licenses: ["ISC"],
                        versionKey: { name: "some-pkg", system: "NPM", version: "1.0.0" },
                    }, { headers: { "content-type": "application/json" }, status: 200 });
                }

                return new Response("not found", { status: 404 });
            });

            vi.stubGlobal("fetch", fetchMock);

            const result = await fetchDepsDevReports([{ name: "some-pkg", version: "1.0.0" }]);
            const report = result.get("some-pkg@1.0.0");

            expect(report).toBeDefined();
            // Neutral 0.5 scores when no Scorecard data is available.
            expect(report?.score.overall).toBe(0.5);
            expect(report?.alerts).toHaveLength(0);
        });

        it("scoped packages are split into namespace + name correctly", async () => {
            expect.assertions(2);

            const fetchMock = vi.fn(async (url: string | URL) => {
                const u = typeof url === "string" ? url : url.toString();

                if (u.includes("/versions/")) {
                    return Response.json({
                        licenses: ["MIT"],
                        versionKey: { name: "@types/node", system: "NPM", version: "20.0.0" },
                    }, { headers: { "content-type": "application/json" }, status: 200 });
                }

                return new Response("not found", { status: 404 });
            });

            vi.stubGlobal("fetch", fetchMock);

            const result = await fetchDepsDevReports([{ name: "@types/node", version: "20.0.0" }]);
            const report = result.get("@types/node@20.0.0");

            expect(report?.namespace).toBe("@types");
            expect(report?.name).toBe("node");
        });
    });

    describe("createDepsDevProvider", () => {
        it("returns undefined when disabled", () => {
            expect.assertions(1);
            expect(createDepsDevProvider({ enabled: false })).toBeUndefined();
        });

        it("returns undefined when config is missing", () => {
            expect.assertions(1);
            expect(createDepsDevProvider(undefined)).toBeUndefined();
        });

        it("returns a provider when enabled", () => {
            expect.assertions(2);

            const provider = createDepsDevProvider({ enabled: true });

            expect(provider?.id).toBe("deps-dev");
            expect(provider?.displayName).toBe("deps.dev");
        });
    });
});
