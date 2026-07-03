import { beforeAll, describe, expect, it } from "vitest";

import { listRules, listTags, scanString } from "../src";

// Warm the Rust regex JIT (full bundled ruleset) once so tests don't timeout.
beforeAll(async () => {
    await scanString("warmup", "warmup.txt");
}, 120_000);

const AWS_ACCESS_KEY_NOT_EXAMPLE = "AKIAQYLPMN5HJ38DNCZG";
const AWS_EXAMPLE_PLACEHOLDER = "AKIAIOSFODNN7EXAMPLE";

describe("bundled ruleset", () => {
    it("catches AWS access keys via the kingfisher-derived rule", async () => {
        expect.assertions(1);

        const findings = await scanString(`key=${AWS_ACCESS_KEY_NOT_EXAMPLE}\n`, "t.env");

        expect(findings.some((f) => f.ruleId.startsWith("kingfisher.aws"))).toBe(true);
    });

    it("patternRequirements.ignoreIfContains drops EXAMPLE/TEST placeholders", async () => {
        expect.assertions(1);

        const findings = await scanString(`key=${AWS_EXAMPLE_PLACEHOLDER}\n`, "t.env");

        expect(findings.some((f) => f.ruleId === "kingfisher.aws.1")).toBe(false);
    });

    it("every finding carries source + confidence metadata", async () => {
        expect.assertions(2);

        const findings = await scanString(`key=${AWS_ACCESS_KEY_NOT_EXAMPLE}\n`, "t.env");

        expect(findings.length).toBeGreaterThan(0);
        expect(findings.every((f) => f.source && typeof f.confidence === "string")).toBe(true);
    });

    it("minConfidence=high drops low/medium-confidence rules at load time", async () => {
        expect.assertions(2);

        const allRules = await listRules();
        const highOnlyRules = await listRules({ config: { minConfidence: "high" } });

        expect(highOnlyRules.length).toBeLessThan(allRules.length);
        expect(highOnlyRules.every((rule) => rule.confidence === "high")).toBe(true);
    });

    it("minConfidence=high drops every gitleaks rule (unlabeled → low)", async () => {
        expect.assertions(2);

        const rules = await listRules({ config: { minConfidence: "high" } });

        expect(rules.some((rule) => rule.source === "gitleaks")).toBe(false);
        expect(rules.every((rule) => rule.confidence === "high")).toBe(true);
    });
});

describe(listTags, () => {
    it("aggregates tags from the bundled ruleset with per-tag counts, sorted by descending count", () => {
        expect.assertions(3);

        const tags = listTags();

        expect(tags.length).toBeGreaterThan(0);
        expect(tags.every((entry) => typeof entry.tag === "string" && entry.count > 0)).toBe(true);

        // Sorted by descending count (ties broken by tag name).
        const sorted = [...tags].toSorted((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

        expect(tags).toStrictEqual(sorted);
    });

    it("surfaces the preset/exposure tags the `tag:` selectors expand against", () => {
        expect.assertions(2);

        const names = new Set(listTags().map((entry) => entry.tag));

        // These tags are present in the bundled ruleset and accepted by
        // `rules.enable: ["tag:exposure"]` etc.
        expect(names.has("exposure")).toBe(true);
        expect([...names].some((tag) => tag.startsWith("preset:"))).toBe(true);
    });

    it("reflects an inline config's tags when extendBundled is false", () => {
        expect.assertions(1);

        const tags = listTags({
            config: {
                extendBundled: false,
                inline: {
                    rules: [
                        { id: "a", tags: ["x", "y"] },
                        { id: "b", tags: ["x"] },
                    ],
                },
            },
        });

        expect(tags).toStrictEqual([
            { count: 2, tag: "x" },
            { count: 1, tag: "y" },
        ]);
    });
});
