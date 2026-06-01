import { describe, expect, it, vi } from "vitest";

import { checkActions } from "../../../../src/commands/update/ecosystems/actions/index";
import type { UsesReference } from "../../../../src/commands/update/ecosystems/actions/scanner";
import { parseTag, pickBestTag } from "../../../../src/commands/update/ecosystems/semver-helpers";
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
    mode: "patch",
    respectDependabotConfig: false,
    style: "sha",
};

const fetchTags = (tags: { name: string; sha: string }[]): typeof fetch =>
    vi.fn(async () => Response.json(tags.map((tag) => { return { commit: { sha: tag.sha }, name: tag.name }; }), { status: 200 }));

const SHA_PIN_NO_HINT: UsesReference = {
    file: "/tmp/wf.yml",
    ignoreReason: undefined,
    isSha: true,
    line: 5,
    original: "actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    owner: "actions",
    quote: "",
    ref: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    repo: "checkout",
    slug: "actions/checkout",
    subpath: undefined,
    trailingComment: undefined,
};

describe("pickBestTag — undefined current ref under constrained modes", () => {
    it("returns undefined for mode=patch when current is unknown (refuses to silently major-bump)", () => {
        expect.assertions(1);

        const candidates = ["1.0.0", "2.0.0"].map((entry) => parseTag(entry)).filter((value): value is NonNullable<typeof value> => value !== undefined);

        expect(pickBestTag(candidates, undefined, "patch", false)).toBeUndefined();
    });

    it("returns undefined for mode=minor when current is unknown", () => {
        expect.assertions(1);

        const candidates = ["1.0.0", "2.0.0"].map((entry) => parseTag(entry)).filter((value): value is NonNullable<typeof value> => value !== undefined);

        expect(pickBestTag(candidates, undefined, "minor", false)).toBeUndefined();
    });

    it("still returns the highest tag for mode=latest (unconstrained)", () => {
        expect.assertions(1);

        const candidates = ["1.0.0", "2.0.0"].map((entry) => parseTag(entry)).filter((value): value is NonNullable<typeof value> => value !== undefined);

        expect(pickBestTag(candidates, undefined, "latest", false)?.normalized).toBe("2.0.0");
    });
});

describe("actions orchestrator — SHA pin without version hint", () => {
    it("surfaces an ignored entry with a clear reason when --target=patch and current is unknown", async () => {
        expect.assertions(2);

        const result = await checkActions("/tmp", {
            options: baseOptions,
            references: [SHA_PIN_NO_HINT],
            resolverOptions: {
                fetch: fetchTags([{ name: "v4.0.0", sha: "4444444444444444444444444444444444444444" }]),
            },
        });

        expect(result.updates).toHaveLength(0);
        expect(result.ignored[0]?.reason).toContain("SHA pin has no version-hint comment");
    });
});
