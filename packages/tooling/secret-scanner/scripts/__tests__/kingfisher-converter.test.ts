import { describe, expect, it } from "vitest";

import { convertKingfisherRule, extractKeywords } from "../kingfisher-converter.mjs";

describe("convertKingfisherRule — skip paths", () => {
    it("skips rules missing id or pattern", () => {
        expect.assertions(2);

        const missing = convertKingfisherRule({ id: "x" }, "t.yml");
        const nonObj = convertKingfisherRule(null, "t.yml");

        expect(missing.skipped).toBe(true);
        expect(nonObj.skipped).toBe(true);
    });
});

describe("convertKingfisherRule — checksum round-trip", () => {
    it("preserves pattern_requirements.checksum on the output rule for the TS filter", () => {
        expect.assertions(2);

        const result = convertKingfisherRule(
            {
                id: "kingfisher.zuplo.1",
                name: "Zuplo",
                pattern: "\\b(zpka_[a-z0-9]{32}_[0-9a-f]{8})\\b",
                pattern_requirements: {
                    checksum: { actual: { template: "{{ CHECKSUM }}" }, expected: "{{ BODY | crc32_hex }}" },
                },
            },
            "zuplo.yml",
        );

        expect(result.skipped).toBe(false);
        expect(result.rule.patternRequirements.checksum).toEqual({
            actual: { template: "{{ CHECKSUM }}" },
            expected: "{{ BODY | crc32_hex }}",
        });
    });
});

describe("convertKingfisherRule — metadata round-trip", () => {
    it("preserves validation blocks as opaque metadata (pattern-only detection)", () => {
        expect.assertions(3);

        const result = convertKingfisherRule(
            {
                id: "kingfisher.slack.1",
                name: "Slack",
                pattern: "\\b(xapp-[a-z0-9-]+)\\b",
                confidence: "medium",
                validation: { type: "Http", content: { request: { url: "https://slack.com/api/auth.test" } } },
            },
            "slack.yml",
        );

        expect(result.skipped).toBe(false);
        expect(result.rule.id).toBe("kingfisher.slack.1");
        expect(result.rule.validation).toEqual({ type: "Http", content: { request: { url: "https://slack.com/api/auth.test" } } });
    });

    it("preserves depends_on_rule under camelCase `dependsOnRule`", () => {
        expect.assertions(2);

        const result = convertKingfisherRule(
            {
                id: "kingfisher.aws.2",
                name: "AWS Secret",
                pattern: "\\b([A-Za-z0-9/+]{40})\\b",
                depends_on_rule: [{ rule_id: "kingfisher.aws.1", variable: "AKID" }],
            },
            "aws.yml",
        );

        expect(result.skipped).toBe(false);
        expect(result.rule.dependsOnRule).toEqual([{ rule_id: "kingfisher.aws.1", variable: "AKID" }]);
    });
});

describe("convertKingfisherRule — happy path", () => {
    it("maps every supported field into our JSON shape", () => {
        expect.assertions(7);

        const result = convertKingfisherRule(
            {
                id: "kingfisher.aws.1",
                name: "AWS Access Key ID",
                pattern: "(?x)\\b((?:AKIA|ASIA)[A-Z0-9]{16})\\b",
                min_entropy: 3.2,
                confidence: "medium",
                pattern_requirements: {
                    min_digits: 1,
                    ignore_if_contains: ["EXAMPLE", "TEST"],
                },
                tags: ["aws", "cloud"],
            },
            "aws.yml",
        );

        expect(result.skipped).toBe(false);
        expect(result.rule).toMatchObject({
            id: "kingfisher.aws.1",
            description: "AWS Access Key ID",
            secretGroup: 1,
            source: "kingfisher",
            entropy: 3.2,
            confidence: "medium",
            priority: 1,
            patternRequirements: { ignoreIfContains: ["EXAMPLE", "TEST"], minDigits: 1 },
            tags: ["aws", "cloud"],
        });
        expect(result.rule.regex).toContain("AKIA");
        expect(result.rule.keywords).toContain("akia");
        expect(result.rule.keywords).toContain("asia");
        expect(result.rule.keywords?.length ?? 0).toBeGreaterThanOrEqual(2);
        expect(result.rule.patternRequirements?.minLength).toBeUndefined();
    });

    it("drops confidence when the value is not low/medium/high", () => {
        expect.assertions(2);

        const result = convertKingfisherRule({ id: "x.1", name: "X", pattern: "foo", confidence: "unknown" }, "x.yml");

        expect(result.rule.confidence).toBeUndefined();
        expect(result.rule.priority).toBeUndefined();
    });

    it("omits patternRequirements when the rule declares none", () => {
        expect.assertions(1);

        const result = convertKingfisherRule({ id: "x.1", name: "X", pattern: "bar" }, "x.yml");

        expect(result.rule.patternRequirements).toBeUndefined();
    });
});

describe("extractKeywords", () => {
    it("extracts every alternative of a `(?:a|b|c)` prefix", () => {
        expect.assertions(1);

        const keywords = extractKeywords("(?x)\\b((?:AKIA|ASIA|AGPA|AIDA)[A-Z0-9]{16})\\b");

        expect(keywords.sort()).toEqual(["agpa", "aida", "akia", "asia"].sort());
    });

    it("returns an empty array for pure character-class + quantifier patterns", () => {
        expect.assertions(1);

        const keywords = extractKeywords("\\b[A-Za-z0-9+/]{40}\\b");

        expect(keywords).toEqual([]);
    });

    it("handles (?x) free-spacing mode without splitting whitespace runs", () => {
        expect.assertions(1);

        const keywords = extractKeywords("(?x)\n  client_token\n  \\s* = \\s*\n  ([a-z0-9]{32})");

        expect(keywords).toContain("client_token");
    });
});
