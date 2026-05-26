import { describe, expect, it, vi } from "vitest";

import { checkActions } from "../../../../src/commands/update/ecosystems/actions/index";
import type { UsesReference } from "../../../../src/commands/update/ecosystems/actions/scanner";
import type { EcosystemUpdateOptions } from "../../../../src/commands/update/ecosystems/types";

const baseOptions: EcosystemUpdateOptions = {
    disabled: new Set(),
    exclude: [],
    githubToken: undefined,
    gitlabToken: undefined,
    include: [],
    includeBranches: false,
    maxConcurrentRequests: 4,
    minAgeDays: undefined,
    mode: "latest",
    respectDependabotConfig: false,
    style: "sha",
};

const makeReference = (overrides: Partial<UsesReference> = {}): UsesReference => ({
    file: "/tmp/workflow.yml",
    ignoreReason: undefined,
    isSha: false,
    line: 5,
    original: "actions/checkout@v3.5.0",
    owner: "actions",
    quote: "",
    ref: "v3.5.0",
    repo: "checkout",
    slug: "actions/checkout",
    subpath: undefined,
    trailingComment: undefined,
    ...overrides,
});

const fetchTags = (tags: { name: string; sha: string }[]): typeof fetch =>
    vi.fn(async () => new Response(JSON.stringify(tags.map((tag) => ({ commit: { sha: tag.sha }, name: tag.name }))), { status: 200 })) as typeof fetch;

describe(checkActions, () => {
    it("emits a SHA-pinned replacement with version-hint comment by default", async () => {
        expect.assertions(3);

        const result = await checkActions("/tmp", {
            options: baseOptions,
            references: [makeReference()],
            resolverOptions: {
                fetch: fetchTags([
                    { name: "v4.0.0", sha: "4444444444444444444444444444444444444444" },
                    { name: "v3.5.0", sha: "3333333333333333333333333333333333333333" },
                ]),
            },
        });

        expect(result.updates).toHaveLength(1);
        expect(result.updates[0]?.newRef).toBe("4444444444444444444444444444444444444444");
        expect(result.updates[0]?.replacement).toBe("actions/checkout@4444444444444444444444444444444444444444 # v4.0.0");
    });

    it("emits tag-style replacement when style=preserve and ref isn't already a SHA", async () => {
        expect.assertions(1);

        const result = await checkActions("/tmp", {
            options: { ...baseOptions, style: "preserve" },
            references: [makeReference()],
            resolverOptions: {
                fetch: fetchTags([{ name: "v4.0.0", sha: "4444444444444444444444444444444444444444" }]),
            },
        });

        expect(result.updates[0]?.replacement).toBe("actions/checkout@v4.0.0");
    });

    it("skips branch references unless --include-branches", async () => {
        expect.assertions(2);

        const reference = makeReference({ original: "actions/checkout@main", ref: "main" });

        const skipped = await checkActions("/tmp", {
            options: baseOptions,
            references: [reference],
            resolverOptions: {
                fetch: fetchTags([{ name: "v4.0.0", sha: "4444444444444444444444444444444444444444" }]),
            },
        });

        expect(skipped.updates).toHaveLength(0);
        expect(skipped.ignored[0]?.reason).toContain("branch reference");
    });

    it("honours the actions-up-ignore inline directive", async () => {
        expect.assertions(2);

        const reference = makeReference({ ignoreReason: "actions-up-ignore" });

        const result = await checkActions("/tmp", {
            options: baseOptions,
            references: [reference],
            resolverOptions: {
                fetch: fetchTags([{ name: "v4.0.0", sha: "4444444444444444444444444444444444444444" }]),
            },
        });

        expect(result.updates).toHaveLength(0);
        expect(result.ignored[0]?.reason).toBe("actions-up-ignore");
    });

    it("respects mode=patch — same major+minor only", async () => {
        expect.assertions(1);

        const result = await checkActions("/tmp", {
            options: { ...baseOptions, mode: "patch" },
            references: [makeReference({ original: "actions/checkout@v3.5.0", ref: "v3.5.0" })],
            resolverOptions: {
                fetch: fetchTags([
                    { name: "v3.5.1", sha: "1111111111111111111111111111111111111111" },
                    { name: "v3.6.0", sha: "2222222222222222222222222222222222222222" },
                    { name: "v4.0.0", sha: "4444444444444444444444444444444444444444" },
                ]),
            },
        });

        expect(result.updates[0]?.newVersion).toBe("v3.5.1");
    });

    it("excludes references matched by --exclude", async () => {
        expect.assertions(1);

        const result = await checkActions("/tmp", {
            options: { ...baseOptions, exclude: ["actions/checkout"] },
            references: [makeReference()],
            resolverOptions: { fetch: fetchTags([{ name: "v4.0.0", sha: "4444444444444444444444444444444444444444" }]) },
        });

        expect(result.ignored[0]?.reason).toBe("matched --exclude");
    });
});
