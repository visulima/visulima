import { describe, expect, it } from "vitest";

import { toSarif } from "../src/sarif";
import type { Finding } from "../src/types";

const sampleFinding = (overrides: Partial<Finding> = {}): Finding => {
    return {
        alternateMatches: [],
        confidence: "high",
        description: "AWS access token",
        endColumn: 32,
        endLine: 10,
        entropy: 4.2,
        file: "src/config.ts",
        match: "AKIAIOSFODNN7EXAMPLE",
        ruleId: "aws-access-token",
        secret: "AKIAIOSFODNN7EXAMPLE",
        startColumn: 12,
        startLine: 10,
        tags: ["cloud", "aws"],
        ...overrides,
    };
};

describe(toSarif, () => {
    it("emits a SARIF 2.1.0 log with one result per finding", () => {
        expect.assertions(4);

        const log = toSarif([sampleFinding(), sampleFinding({ file: "src/other.ts", ruleId: "github-pat" })]);

        expect(log.version).toBe("2.1.0");
        expect(log.$schema).toContain("sarif-schema-2.1.0");
        expect(log.runs).toHaveLength(1);
        expect(log.runs[0]?.results).toHaveLength(2);
    });

    it("maps the location region from the finding's 1-based line/column span", () => {
        expect.assertions(1);

        const log = toSarif([sampleFinding()]);
        const region = log.runs[0]?.results[0]?.locations[0]?.physicalLocation.region;

        expect(region).toStrictEqual({ endColumn: 32, endLine: 10, startColumn: 12, startLine: 10 });
    });

    it("dedupes the rule catalogue by ruleId", () => {
        expect.assertions(2);

        const log = toSarif([sampleFinding(), sampleFinding(), sampleFinding({ ruleId: "github-pat" })]);
        const rules = log.runs[0]?.tool.driver.rules ?? [];

        expect(rules).toHaveLength(2);
        expect(rules.map((rule) => rule.id).toSorted((a, b) => a.localeCompare(b))).toStrictEqual(["aws-access-token", "github-pat"]);
    });

    it("stamps the tool version and carries confidence/source/validation in result properties", () => {
        expect.assertions(3);

        const log = toSarif([sampleFinding({ source: "gitleaks", validation: "verified" })], { toolVersion: "1.2.3" });

        expect(log.runs[0]?.tool.driver.version).toBe("1.2.3");
        expect(log.runs[0]?.results[0]?.properties).toMatchObject({ confidence: "high", source: "gitleaks", validation: "verified" });
        expect(log.runs[0]?.results[0]?.level).toBe("error");
    });

    it("returns an empty results + rules array for no findings", () => {
        expect.assertions(2);

        const log = toSarif([]);

        expect(log.runs[0]?.results).toStrictEqual([]);
        expect(log.runs[0]?.tool.driver.rules).toStrictEqual([]);
    });
});
