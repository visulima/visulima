import { describe, expect, it, vi } from "vitest";

import { checkActions } from "../../../../src/commands/update/ecosystems/actions/index";
import { extractUsesFromContent } from "../../../../src/commands/update/ecosystems/actions/scanner";
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

const fetchTags = (tags: { name: string; sha: string }[]): typeof fetch =>
    vi.fn(async () =>
        Response.json(
            tags.map((tag) => {
                return { commit: { sha: tag.sha }, name: tag.name };
            }),
            { status: 200 },
        ),
    );

describe("actions scanner quote preservation", () => {
    it("captures the original quote character when uses: is single-quoted", () => {
        expect.assertions(2);

        const refs = extractUsesFromContent("/tmp/wf.yml", "      - uses: 'actions/checkout@v3'\n");

        expect(refs[0]?.quote).toBe("'");
        // `original` MUST include the quotes so the applier rewrites the
        // entire quoted span (including the closing quote) — otherwise
        // a SHA-pinned replacement with a trailing `# vN.M.P` lands
        // *inside* the YAML string literal and breaks the workflow.
        expect(refs[0]?.original).toBe("'actions/checkout@v3'");
    });

    it("captures empty quote for unquoted refs", () => {
        expect.assertions(2);

        const refs = extractUsesFromContent("/tmp/wf.yml", "      - uses: actions/checkout@v3\n");

        expect(refs[0]?.quote).toBe("");
        expect(refs[0]?.original).toBe("actions/checkout@v3");
    });

    it("treats `actions-up-ignore-next-line` on a uses: line as an inline (this-line) ignore", () => {
        expect.assertions(2);

        const refs = extractUsesFromContent(
            "/tmp/wf.yml",
            ["      - uses: actions/checkout@v3 # actions-up-ignore-next-line", "      - uses: actions/setup-node@v4", ""].join("\n"),
        );

        // The first uses: must be ignored; the second must NOT inherit the directive.
        const checkout = refs.find((r) => r.slug === "actions/checkout");
        const setupNode = refs.find((r) => r.slug === "actions/setup-node");

        expect(checkout?.ignoreReason).toBeDefined();
        expect(setupNode?.ignoreReason).toBeUndefined();
    });
});

describe("actions orchestrator — quoted YAML SHA pin", () => {
    it("re-emits the quoted form and places the `# vN.M.P` hint outside the closing quote", async () => {
        expect.assertions(1);

        const refs = extractUsesFromContent("/tmp/wf.yml", "      - uses: 'actions/checkout@v3'\n");
        const result = await checkActions("/tmp", {
            options: baseOptions,
            references: refs,
            resolverOptions: {
                fetch: fetchTags([{ name: "v4.0.0", sha: "4444444444444444444444444444444444444444" }]),
            },
        });

        // The replacement must wrap the new ref in single quotes and put
        // the version-hint comment OUTSIDE the closing quote so YAML
        // doesn't parse `# v4.0.0` as part of the action reference.
        expect(result.updates[0]?.replacement).toBe("'actions/checkout@4444444444444444444444444444444444444444' # v4.0.0");
    });
});
