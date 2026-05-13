import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearPackumentCache } from "../../src/security/marshalls/packument";
import { runAuthorMarshall } from "../../src/security/marshalls/author";

let homeOverride: string;

vi.mock(import("node:os"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        homedir: () => homeOverride,
    };
});

const stubFetch = (response: { body?: unknown; status?: number }): ReturnType<typeof vi.fn> => {
    const handler = vi.fn(async () =>
        Promise.resolve({
            json: async () => Promise.resolve(response.body ?? {}),
            ok: (response.status ?? 200) < 400,
            status: response.status ?? 200,
        }),
    );

    vi.stubGlobal("fetch", handler);

    return handler;
};

// Fix `now` to a stable instant so day-math is deterministic in tests.
const NOW_MS = new Date("2026-05-13T12:00:00Z").getTime();
const now = (): number => NOW_MS;
const daysAgoIso = (days: number): string => new Date(NOW_MS - days * 24 * 60 * 60 * 1000).toISOString();

interface VersionFixture {
    publishedAt?: string;
    user?: { email?: string; name?: string };
}

const packumentWith = (versions: Record<string, VersionFixture>): Record<string, unknown> => {
    const time: Record<string, string> = {};
    const versionsOut: Record<string, Record<string, unknown>> = {};

    for (const [version, fixture] of Object.entries(versions)) {
        versionsOut[version] = {
            version,
            ...(fixture.user === undefined ? {} : { _npmUser: fixture.user }),
        };

        if (fixture.publishedAt !== undefined) {
            time[version] = fixture.publishedAt;
        }
    }

    return { name: "demo", time, versions: versionsOut };
};

describe(runAuthorMarshall, () => {
    beforeEach(() => {
        homeOverride = mkdtempSync(join(tmpdir(), "vis-author-"));
        clearPackumentCache();
    });

    afterEach(() => {
        vi.unstubAllGlobals();

        if (existsSync(homeOverride)) {
            rmSync(homeOverride, { force: true, recursive: true });
        }
    });

    describe("recent-version", () => {
        it("errors when the version was published 5 days ago", async () => {
            expect.assertions(2);

            stubFetch({
                body: packumentWith({
                    "1.0.0": { publishedAt: daysAgoIso(400), user: { email: "old@example.com" } },
                    "1.1.0": { publishedAt: daysAgoIso(5), user: { email: "old@example.com" } },
                }),
            });

            const findings = await runAuthorMarshall([{ name: "demo", version: "1.1.0" }], { now });
            const recent = findings.find((finding) => finding.kind === "recent-version");

            expect(recent?.severity).toBe("error");
            expect(recent?.version).toBe("1.1.0");
        });

        it("warns when the version was published 25 days ago", async () => {
            expect.assertions(1);

            stubFetch({
                body: packumentWith({
                    "1.0.0": { publishedAt: daysAgoIso(400), user: { email: "old@example.com" } },
                    "1.1.0": { publishedAt: daysAgoIso(25), user: { email: "old@example.com" } },
                }),
            });

            const findings = await runAuthorMarshall([{ name: "demo", version: "1.1.0" }], { now });
            const recent = findings.find((finding) => finding.kind === "recent-version");

            expect(recent?.severity).toBe("warning");
        });

        it("does not flag versions older than the warn threshold", async () => {
            expect.assertions(1);

            stubFetch({
                body: packumentWith({
                    "1.0.0": { publishedAt: daysAgoIso(400), user: { email: "old@example.com" } },
                    "1.1.0": { publishedAt: daysAgoIso(60), user: { email: "old@example.com" } },
                }),
            });

            const findings = await runAuthorMarshall([{ name: "demo", version: "1.1.0" }], { now });

            expect(findings.find((finding) => finding.kind === "recent-version")).toBeUndefined();
        });

        it("does not cross the boundary at exactly 7 days (treated as warn, not error)", async () => {
            expect.assertions(1);

            stubFetch({
                body: packumentWith({
                    "1.0.0": { publishedAt: daysAgoIso(400), user: { email: "old@example.com" } },
                    "1.1.0": { publishedAt: daysAgoIso(7), user: { email: "old@example.com" } },
                }),
            });

            const findings = await runAuthorMarshall([{ name: "demo", version: "1.1.0" }], { now });
            const recent = findings.find((finding) => finding.kind === "recent-version");

            // 7 days exactly is *not less than* 7, so it falls into the warning bucket only.
            expect(recent?.severity).toBe("warning");
        });
    });

    describe("new-publisher", () => {
        it("errors when a brand-new publisher releases on a >21d-old package", async () => {
            expect.assertions(2);

            stubFetch({
                body: packumentWith({
                    "1.0.0": { publishedAt: daysAgoIso(400), user: { email: "original@example.com" } },
                    "1.1.0": { publishedAt: daysAgoIso(35), user: { email: "newcomer@example.com" } },
                }),
            });

            const findings = await runAuthorMarshall([{ name: "demo", version: "1.1.0" }], { now });
            const newPub = findings.find((finding) => finding.kind === "new-publisher");

            expect(newPub?.severity).toBe("error");
            expect(newPub?.message).toContain("newcomer@example.com");
        });

        it("does not fire on young (<=21d) packages", async () => {
            expect.assertions(1);

            stubFetch({
                body: packumentWith({
                    "1.0.0": { publishedAt: daysAgoIso(10), user: { email: "original@example.com" } },
                    "1.1.0": { publishedAt: daysAgoIso(40), user: { email: "newcomer@example.com" } },
                }),
            });

            const findings = await runAuthorMarshall([{ name: "demo", version: "1.1.0" }], { now });

            expect(findings.find((finding) => finding.kind === "new-publisher")).toBeUndefined();
        });

        it("does not fire when the same publisher has prior releases", async () => {
            expect.assertions(1);

            stubFetch({
                body: packumentWith({
                    "1.0.0": { publishedAt: daysAgoIso(400), user: { email: "same@example.com" } },
                    "1.1.0": { publishedAt: daysAgoIso(40), user: { email: "same@example.com" } },
                }),
            });

            const findings = await runAuthorMarshall([{ name: "demo", version: "1.1.0" }], { now });

            expect(findings.find((finding) => finding.kind === "new-publisher")).toBeUndefined();
        });
    });

    describe("dormant-maintainer", () => {
        it("errors when the same publisher's prior release was >274 days ago", async () => {
            expect.assertions(1);

            stubFetch({
                body: packumentWith({
                    "1.0.0": { publishedAt: daysAgoIso(400), user: { email: "publisher@example.com" } },
                    "1.1.0": { publishedAt: daysAgoIso(40), user: { email: "publisher@example.com" } },
                }),
            });

            const findings = await runAuthorMarshall([{ name: "demo", version: "1.1.0" }], { now });
            const dormant = findings.find((finding) => finding.kind === "dormant-maintainer");

            expect(dormant?.severity).toBe("error");
        });

        it("warns in the 183–274 day band", async () => {
            expect.assertions(1);

            stubFetch({
                body: packumentWith({
                    "1.0.0": { publishedAt: daysAgoIso(220), user: { email: "publisher@example.com" } },
                    "1.1.0": { publishedAt: daysAgoIso(40), user: { email: "publisher@example.com" } },
                }),
            });

            const findings = await runAuthorMarshall([{ name: "demo", version: "1.1.0" }], { now });
            const dormant = findings.find((finding) => finding.kind === "dormant-maintainer");

            expect(dormant?.severity).toBe("warning");
        });

        it("does not flag a fresh prior release", async () => {
            expect.assertions(1);

            stubFetch({
                body: packumentWith({
                    "1.0.0": { publishedAt: daysAgoIso(60), user: { email: "publisher@example.com" } },
                    "1.1.0": { publishedAt: daysAgoIso(40), user: { email: "publisher@example.com" } },
                }),
            });

            const findings = await runAuthorMarshall([{ name: "demo", version: "1.1.0" }], { now });

            expect(findings.find((finding) => finding.kind === "dormant-maintainer")).toBeUndefined();
        });
    });

    describe("edge cases & flags", () => {
        it("returns no findings when time/_npmUser are missing", async () => {
            expect.assertions(1);

            stubFetch({
                body: {
                    name: "demo",
                    versions: { "1.0.0": { version: "1.0.0" }, "1.1.0": { version: "1.1.0" } },
                },
            });

            const findings = await runAuthorMarshall([{ name: "demo", version: "1.1.0" }], { now });

            expect(findings).toStrictEqual([]);
        });

        it("respects the allowlist", async () => {
            expect.assertions(1);

            stubFetch({
                body: packumentWith({
                    "1.0.0": { publishedAt: daysAgoIso(400), user: { email: "old@example.com" } },
                    "1.1.0": { publishedAt: daysAgoIso(2), user: { email: "old@example.com" } },
                }),
            });

            const findings = await runAuthorMarshall([{ name: "demo", version: "1.1.0" }], { allowlist: ["demo"], now });

            expect(findings).toStrictEqual([]);
        });

        it("returns an empty array when MARSHALL_DISABLE_AUTHOR is set", async () => {
            expect.assertions(2);

            const previous = process.env.MARSHALL_DISABLE_AUTHOR;
            const fetchSpy = stubFetch({
                body: packumentWith({
                    "1.0.0": { publishedAt: daysAgoIso(400), user: { email: "publisher@example.com" } },
                    "1.1.0": { publishedAt: daysAgoIso(5), user: { email: "publisher@example.com" } },
                }),
            });

            try {
                process.env.MARSHALL_DISABLE_AUTHOR = "1";

                const findings = await runAuthorMarshall([{ name: "demo", version: "1.1.0" }], { now });

                expect(findings).toStrictEqual([]);
                expect(fetchSpy).not.toHaveBeenCalled();
            } finally {
                if (previous === undefined) {
                    delete process.env.MARSHALL_DISABLE_AUTHOR;
                } else {
                    process.env.MARSHALL_DISABLE_AUTHOR = previous;
                }
            }
        });
    });
});
