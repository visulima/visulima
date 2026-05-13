import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearArchivedRepoCache, parseGitHubUrl, runArchivedRepoMarshall } from "../../src/security/marshalls/archived-repo";
import { clearPackumentCache } from "../../src/security/marshalls/packument";

const PACKUMENT_PATTERN = /registry\.npmjs\.org\/([^/]+)/;

let homeOverride: string;

vi.mock(import("node:os"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        homedir: () => homeOverride,
    };
});

interface StubResponse {
    body?: unknown;
    status?: number;
}

const stubFetchSequence = (responses: StubResponse[]): ReturnType<typeof vi.fn> => {
    let index = 0;
    const handler = vi.fn(async () => {
        const response = responses[Math.min(index, responses.length - 1)] ?? {};

        index += 1;

        return {
            json: async () => response.body ?? {},
            ok: (response.status ?? 200) < 400,
            status: response.status ?? 200,
        };
    });

    vi.stubGlobal("fetch", handler);

    return handler;
};

const packumentBody = (repoUrl: string | undefined, name = "demo"): Record<string, unknown> => {
    return {
        "dist-tags": { latest: "1.0.0" },
        name,
        versions: {
            "1.0.0": {
                ...(repoUrl === undefined ? {} : { repository: { type: "git", url: repoUrl } }),
                version: "1.0.0",
            },
        },
    };
};

describe(parseGitHubUrl, () => {
    it("parses git+https form", () => {
        expect.assertions(1);

        expect(parseGitHubUrl("git+https://github.com/example/demo.git")).toStrictEqual({ owner: "example", repo: "demo" });
    });

    it("parses plain https form without .git", () => {
        expect.assertions(1);

        expect(parseGitHubUrl("https://github.com/example/demo")).toStrictEqual({ owner: "example", repo: "demo" });
    });

    it("parses www.github.com host", () => {
        expect.assertions(1);

        expect(parseGitHubUrl("https://www.github.com/example/demo.git")).toStrictEqual({ owner: "example", repo: "demo" });
    });

    it("parses git@github.com:owner/repo ssh shorthand", () => {
        expect.assertions(1);

        expect(parseGitHubUrl("git@github.com:example/demo.git")).toStrictEqual({ owner: "example", repo: "demo" });
    });

    it("parses ssh://git@github.com/owner/repo form", () => {
        expect.assertions(1);

        expect(parseGitHubUrl("ssh://git@github.com/example/demo.git")).toStrictEqual({ owner: "example", repo: "demo" });
    });

    it("returns undefined for non-GitHub hosts", () => {
        expect.assertions(2);

        expect(parseGitHubUrl("https://gitlab.com/example/demo.git")).toBeUndefined();
        expect(parseGitHubUrl("git+https://bitbucket.org/example/demo.git")).toBeUndefined();
    });

    it("returns undefined for empty/garbage input", () => {
        expect.assertions(3);

        expect(parseGitHubUrl(undefined)).toBeUndefined();
        expect(parseGitHubUrl("")).toBeUndefined();
        expect(parseGitHubUrl("not a url")).toBeUndefined();
    });
});

describe(runArchivedRepoMarshall, () => {
    beforeEach(() => {
        homeOverride = mkdtempSync(join(tmpdir(), "vis-archived-repo-"));
        clearPackumentCache();
        clearArchivedRepoCache();
    });

    afterEach(() => {
        vi.unstubAllGlobals();

        if (existsSync(homeOverride)) {
            rmSync(homeOverride, { force: true, recursive: true });
        }
    });

    it("flags an archived repository", async () => {
        expect.assertions(2);

        stubFetchSequence([
            { body: packumentBody("git+https://github.com/example/demo.git") },
            { body: { archived: true, archived_at: "2025-01-01T00:00:00Z" } },
        ]);

        const findings = await runArchivedRepoMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings).toHaveLength(1);
        expect(findings[0]).toStrictEqual({
            archivedAt: "2025-01-01T00:00:00Z",
            kind: "archived",
            owner: "example",
            packageName: "demo",
            repo: "demo",
        });
    });

    it("returns no finding when the repo is live", async () => {
        expect.assertions(1);

        stubFetchSequence([
            { body: packumentBody("git+https://github.com/example/demo.git") },
            { body: { archived: false } },
        ]);

        const findings = await runArchivedRepoMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings).toStrictEqual([]);
    });

    it("emits a missing-repo finding when GitHub returns 404", async () => {
        expect.assertions(2);

        stubFetchSequence([
            { body: packumentBody("git+https://github.com/example/demo.git") },
            { status: 404 },
        ]);

        const findings = await runArchivedRepoMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings).toHaveLength(1);
        expect(findings[0]).toStrictEqual({
            kind: "missing-repo",
            owner: "example",
            packageName: "demo",
            repo: "demo",
        });
    });

    it("silently skips packages with no repository field", async () => {
        expect.assertions(2);

        const fetchSpy = stubFetchSequence([{ body: packumentBody(undefined) }]);

        const findings = await runArchivedRepoMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings).toStrictEqual([]);
        // Only the packument fetch fired — no GitHub call.
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("silently skips non-GitHub repository URLs", async () => {
        expect.assertions(2);

        const fetchSpy = stubFetchSequence([{ body: packumentBody("https://gitlab.com/example/demo.git") }]);

        const findings = await runArchivedRepoMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings).toStrictEqual([]);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("degrades silently on transient GitHub errors (5xx, 403)", async () => {
        expect.assertions(1);

        stubFetchSequence([
            { body: packumentBody("git+https://github.com/example/demo.git") },
            { status: 403 },
        ]);

        const findings = await runArchivedRepoMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings).toStrictEqual([]);
    });

    it("caches positive responses across calls", async () => {
        expect.assertions(2);

        const fetchSpy = stubFetchSequence([
            { body: packumentBody("git+https://github.com/example/demo.git") },
            { body: { archived: true, archived_at: "2025-01-01T00:00:00Z" } },
            { body: packumentBody("git+https://github.com/example/demo.git") },
        ]);

        await runArchivedRepoMarshall([{ name: "demo", version: "1.0.0" }]);
        clearPackumentCache();
        const findings = await runArchivedRepoMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings).toHaveLength(1);
        // 2 packument fetches + 1 GitHub fetch — second pass reuses the cache.
        expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("caches negative (live) responses to avoid hammering GitHub", async () => {
        expect.assertions(1);

        const fetchSpy = stubFetchSequence([
            { body: packumentBody("git+https://github.com/example/demo.git") },
            { body: { archived: false } },
            { body: packumentBody("git+https://github.com/example/demo.git") },
        ]);

        await runArchivedRepoMarshall([{ name: "demo", version: "1.0.0" }]);
        clearPackumentCache();
        await runArchivedRepoMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("sends Authorization when githubToken is provided", async () => {
        expect.assertions(1);

        const fetchSpy = stubFetchSequence([
            { body: packumentBody("git+https://github.com/example/demo.git") },
            { body: { archived: false } },
        ]);

        await runArchivedRepoMarshall([{ name: "demo", version: "1.0.0" }], { githubToken: "token-abc" });

        const githubCall = fetchSpy.mock.calls[1];

        expect((githubCall?.[1] as { headers: Record<string, string> }).headers["Authorization"]).toBe("Bearer token-abc");
    });

    it("respects the allowlist", async () => {
        expect.assertions(2);

        const fetchSpy = stubFetchSequence([
            { body: packumentBody("git+https://github.com/example/demo.git") },
            { body: { archived: true } },
        ]);

        const findings = await runArchivedRepoMarshall([{ name: "demo", version: "1.0.0" }], { allowlist: ["demo"] });

        expect(findings).toStrictEqual([]);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("dedupes a shared GitHub repo across packages running in parallel (one GitHub call total)", async () => {
        expect.assertions(3);

        const fetchSpy = vi.fn(async (input: unknown) => {
            const url = input as string;
            const packumentMatch = PACKUMENT_PATTERN.exec(url);

            if (packumentMatch !== null) {
                const name = decodeURIComponent(packumentMatch[1] as string);

                return {
                    json: async () => packumentBody("git+https://github.com/shared-org/shared-repo.git", name),
                    ok: true,
                    status: 200,
                };
            }

            if (url.includes("api.github.com/repos/shared-org/shared-repo")) {
                return {
                    json: async () => {
                        return { archived: true, archived_at: "2025-06-01T00:00:00Z" };
                    },
                    ok: true,
                    status: 200,
                };
            }

            return {
                json: async () => {
                    return {};
                },
                ok: true,
                status: 200,
            };
        });

        vi.stubGlobal("fetch", fetchSpy);

        const findings = await runArchivedRepoMarshall([
            { name: "demo-a", version: "1.0.0" },
            { name: "demo-b", version: "1.0.0" },
        ]);

        const githubCalls = fetchSpy.mock.calls.filter((call) => (call[0] as string).includes("api.github.com"));

        expect(findings).toHaveLength(2);
        expect(findings.every((finding) => finding.kind === "archived")).toBe(true);
        expect(githubCalls).toHaveLength(1);
    });

    it("returns an empty array when MARSHALL_DISABLE_ARCHIVED_REPO is set", async () => {
        expect.assertions(2);

        const previous = process.env.MARSHALL_DISABLE_ARCHIVED_REPO;
        const fetchSpy = stubFetchSequence([{ body: packumentBody("git+https://github.com/example/demo.git") }]);

        try {
            process.env.MARSHALL_DISABLE_ARCHIVED_REPO = "1";

            const findings = await runArchivedRepoMarshall([{ name: "demo", version: "1.0.0" }]);

            expect(findings).toStrictEqual([]);
            expect(fetchSpy).not.toHaveBeenCalled();
        } finally {
            if (previous === undefined) {
                delete process.env.MARSHALL_DISABLE_ARCHIVED_REPO;
            } else {
                process.env.MARSHALL_DISABLE_ARCHIVED_REPO = previous;
            }
        }
    });
});

describe(clearArchivedRepoCache, () => {
    beforeEach(() => {
        homeOverride = mkdtempSync(join(tmpdir(), "vis-archived-repo-clear-"));
        clearPackumentCache();
        clearArchivedRepoCache();
    });

    afterEach(() => {
        vi.unstubAllGlobals();

        if (existsSync(homeOverride)) {
            rmSync(homeOverride, { force: true, recursive: true });
        }
    });

    it("returns 0 when the directory does not exist", () => {
        expect.assertions(1);

        expect(clearArchivedRepoCache()).toBe(0);
    });

    it("removes every cached entry and reports the count", async () => {
        expect.assertions(2);

        stubFetchSequence([
            { body: packumentBody("git+https://github.com/example/demo.git") },
            { body: { archived: false } },
            { body: packumentBody("git+https://github.com/example/other.git") },
            { body: { archived: false } },
        ]);

        await runArchivedRepoMarshall([{ name: "demo", version: "1.0.0" }]);
        await runArchivedRepoMarshall([{ name: "demo", version: "1.0.0" }]);

        // First pass cached owner/example__demo; second uses different repo URL via fresh packument
        // But "demo" reuses the same cache key, so only one file. Force a second package:
        clearPackumentCache();

        const second = stubFetchSequence([
            { body: packumentBody("git+https://github.com/example/other.git") },
            { body: { archived: false } },
        ]);

        await runArchivedRepoMarshall([{ name: "demo", version: "1.0.0" }]);
        void second;

        const removed = clearArchivedRepoCache();

        expect(removed).toBeGreaterThanOrEqual(1);
        expect(clearArchivedRepoCache()).toBe(0);
    });
});
