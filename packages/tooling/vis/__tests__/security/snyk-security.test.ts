import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_HOME = join(tmpdir(), `vis-snyk-test-${String(process.pid)}-${String(Date.now())}`);

vi.mock(import("node:os"), async (importOriginal) => {
    const original = await importOriginal<typeof import("node:os")>();

    return { ...original, homedir: () => TEST_HOME };
});

const { buildReport, clearSnykCache, createSnykProvider, fetchSnykReports, issueSeverity, issueToAlert } = await import("../../src/security/snyk-security");

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

describe("snyk-security", () => {
    beforeEach(() => {
        setupHome();
    });

    afterEach(() => {
        clearSnykCache();
        teardownHome();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        delete process.env.VIS_SNYK_TOKEN;
        delete process.env.VIS_SNYK_ORG;
    });

    describe("issueSeverity", () => {
        it("prefers effective_severity_level", () => {
            expect.assertions(1);

            expect(issueSeverity({ attributes: { effective_severity_level: "critical", severities: [{ level: "low", type: "primary" }] }, id: "x" })).toBe(
                "critical",
            );
        });

        it("falls back to the primary severity level", () => {
            expect.assertions(1);

            expect(
                issueSeverity({
                    attributes: {
                        severities: [
                            { level: "medium", type: "secondary" },
                            { level: "high", type: "primary" },
                        ],
                    },
                    id: "x",
                }),
            ).toBe("high");
        });

        it("falls back to a CVSS band when no usable level is present", () => {
            expect.assertions(1);

            expect(issueSeverity({ attributes: { severities: [{ score: 9.1, type: "primary" }] }, id: "x" })).toBe("critical");
        });
    });

    describe("issueToAlert", () => {
        it("extracts CVE and CWE from problems", () => {
            expect.assertions(3);

            const alert = issueToAlert({
                attributes: {
                    created_at: "2024-02-02T00:00:00Z",
                    effective_severity_level: "high",
                    problems: [
                        { id: "CVE-2024-1111", source: "CVE" },
                        { id: "CWE-79", source: "CWE" },
                    ],
                },
                id: "SNYK-JS-FOO-1",
            });

            expect(alert.severity).toBe("high");
            expect(alert.props?.cveId).toBe("CVE-2024-1111");
            expect(alert.props?.cwes).toStrictEqual([{ id: "CWE-79" }]);
        });

        it("omits props when there is no CVE", () => {
            expect.assertions(2);

            const alert = issueToAlert({ attributes: { effective_severity_level: "low", problems: [] }, id: "SNYK-JS-BAR-2" });

            expect(alert.key).toBe("SNYK-JS-BAR-2");
            expect(alert.props).toBeUndefined();
        });
    });

    describe("buildReport", () => {
        it("returns neutral scores and no alerts for a clean package", () => {
            expect.assertions(3);

            const report = buildReport("lodash", "4.17.21", []);

            expect(report.alerts).toHaveLength(0);
            expect(report.score.overall).toBe(0.5);
            expect(report.score.vulnerability).toBe(0.5);
        });

        it("knocks the vulnerability axis down for critical/high issues", () => {
            expect.assertions(2);

            const report = buildReport("lodash", "4.17.20", [{ attributes: { effective_severity_level: "critical" }, id: "SNYK-1" }]);

            expect(report.score.vulnerability).toBe(0.2);
            // (0.5*4 + 0.2) / 5 = 0.44
            expect(report.score.overall).toBe(0.44);
        });

        it("splits the scope into namespace + short name", () => {
            expect.assertions(2);

            const report = buildReport("@angular/core", "17.0.0", []);

            expect(report.namespace).toBe("@angular");
            expect(report.name).toBe("core");
        });
    });

    describe("createSnykProvider", () => {
        it("returns undefined when disabled", () => {
            expect.assertions(1);

            expect(createSnykProvider({ apiToken: "t", enabled: false, orgId: "o" })).toBeUndefined();
        });

        it("returns undefined when org or token is missing", () => {
            expect.assertions(2);

            expect(createSnykProvider({ apiToken: "t", enabled: true })).toBeUndefined();
            expect(createSnykProvider({ enabled: true, orgId: "o" })).toBeUndefined();
        });

        it("resolves credentials from env vars", () => {
            expect.assertions(1);

            process.env.VIS_SNYK_TOKEN = "env-token";
            process.env.VIS_SNYK_ORG = "env-org";

            expect(createSnykProvider({ enabled: true })?.id).toBe("snyk");
        });
    });

    describe("fetchSnykReports", () => {
        it("returns an empty map when given no packages", async () => {
            expect.assertions(1);

            const result = await fetchSnykReports([], { apiToken: "t", orgId: "o" });

            expect(result.size).toBe(0);
        });

        it("graceful failure: omits a package when the endpoint errors out", async () => {
            expect.assertions(1);

            vi.stubGlobal(
                "fetch",
                vi.fn(async () => new Response("unauthorized", { status: 401 })),
            );

            const result = await fetchSnykReports([{ name: "lodash", version: "4.17.21" }], { apiToken: "t", orgId: "o" });

            expect(result.size).toBe(0);
        });

        it("assembles a report and sends the token auth header", async () => {
            expect.assertions(4);

            const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
                const auth = new Headers(init?.headers).get("Authorization");

                expect(auth).toBe("token secret-token");

                return Response.json(
                    {
                        data: [
                            {
                                attributes: {
                                    created_at: "2024-03-03T00:00:00Z",
                                    effective_severity_level: "high",
                                    problems: [{ id: "CVE-2024-2222", source: "CVE" }],
                                    title: "Prototype Pollution",
                                },
                                id: "SNYK-JS-LODASH-567",
                            },
                        ],
                    },
                    { status: 200 },
                );
            });

            vi.stubGlobal("fetch", fetchMock);

            const result = await fetchSnykReports([{ name: "lodash", version: "4.17.20" }], { apiToken: "secret-token", orgId: "my-org" });
            const report = result.get("lodash@4.17.20");

            expect(report?.alerts).toHaveLength(1);
            expect(report?.alerts[0]?.props?.cveId).toBe("CVE-2024-2222");
            expect(report?.score.vulnerability).toBe(0.2);
        });

        it("follows same-origin pagination and aggregates pages", async () => {
            expect.assertions(3);

            const fetchMock = vi.fn(async (url: string | URL) => {
                const u = typeof url === "string" ? url : url.toString();

                if (u.includes("starting_after=cursor2")) {
                    return Response.json({ data: [{ attributes: { effective_severity_level: "low" }, id: "SNYK-2" }] }, { status: 200 });
                }

                return Response.json(
                    {
                        data: [{ attributes: { effective_severity_level: "low" }, id: "SNYK-1" }],
                        links: { next: "https://api.snyk.io/rest/orgs/o/packages/p/issues?version=v&starting_after=cursor2" },
                    },
                    { status: 200 },
                );
            });

            vi.stubGlobal("fetch", fetchMock);

            const result = await fetchSnykReports([{ name: "pkg", version: "1.0.0" }], { apiToken: "t", orgId: "o" });

            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(result.get("pkg@1.0.0")?.alerts).toHaveLength(2);
            expect(result.get("pkg@1.0.0")?.alerts.map((a) => a.key)).toStrictEqual(["SNYK-1", "SNYK-2"]);
        });

        it("does not follow an off-origin pagination link (token must not leak)", async () => {
            expect.assertions(2);

            const fetchMock = vi.fn(async () =>
                Response.json(
                    {
                        data: [{ attributes: { effective_severity_level: "low" }, id: "SNYK-1" }],
                        links: { next: "https://evil.example.com/steal?version=v" },
                    },
                    { status: 200 },
                ),
            );

            vi.stubGlobal("fetch", fetchMock);

            const result = await fetchSnykReports([{ name: "pkg", version: "1.0.0" }], { apiToken: "t", orgId: "o" });

            // Only the initial Snyk request — the evil.example.com link is dropped.
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(result.get("pkg@1.0.0")?.alerts).toHaveLength(1);
        });
    });
});
