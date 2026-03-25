import { describe, expect, it } from "vitest";

import type { AiAnalysisResult } from "../src/ai-analysis";
import { buildAnalysisPrompt, extractJson, formatAiAnalysis, normalizeRecommendation, parseAiResponse, ruleBasedAnalysis } from "../src/ai-analysis";
import type { OutdatedEntry } from "../src/catalog";

const makeEntry = (overrides: Partial<OutdatedEntry> = {}): OutdatedEntry => {
    return {
        catalogName: "default",
        currentRange: "^1.0.0",
        newRange: "^2.0.0",
        packageName: "react",
        targetVersion: "2.0.0",
        updateType: "major",
        ...overrides,
    };
};

// --- buildAnalysisPrompt ---

describe("buildAnalysisPrompt", () => {
    it("should include package names and versions", () => {
        expect.assertions(4);

        const prompt = buildAnalysisPrompt([makeEntry()]);

        expect(prompt).toContain("react");
        expect(prompt).toContain("^1.0.0");
        expect(prompt).toContain("^2.0.0");
        expect(prompt).toContain("major");
    });

    it("should include vulnerability info when present", () => {
        expect.assertions(3);

        const prompt = buildAnalysisPrompt([
            makeEntry({
                vulnerabilities: [{ cvssScore: 9.8, fixedVersions: ["2.0.0"], id: "GHSA-1234", severity: "CRITICAL", summary: "RCE" }],
            }),
        ]);

        expect(prompt).toContain("VULNERABILITIES");
        expect(prompt).toContain("CRITICAL");
        expect(prompt).toContain("GHSA-1234");
    });

    it("should not include vulnerability section when none", () => {
        expect.assertions(1);

        const prompt = buildAnalysisPrompt([makeEntry()]);

        expect(prompt).not.toContain("VULNERABILITIES");
    });

    it("should request JSON response format", () => {
        expect.assertions(2);

        const prompt = buildAnalysisPrompt([makeEntry()]);

        expect(prompt).toContain("JSON");
        expect(prompt).toContain("recommendations");
    });
});

// --- extractJson ---

describe("extractJson", () => {
    it("should parse direct JSON", () => {
        expect.assertions(1);

        const result = extractJson("{\"foo\": \"bar\"}");

        expect(result).toStrictEqual({ foo: "bar" });
    });

    it("should extract from markdown code block", () => {
        expect.assertions(1);

        const result = extractJson("Here is the analysis:\n```json\n{\"foo\": \"bar\"}\n```\nDone.");

        expect(result).toStrictEqual({ foo: "bar" });
    });

    it("should extract from plain code block", () => {
        expect.assertions(1);

        const result = extractJson("```\n{\"foo\": \"bar\"}\n```");

        expect(result).toStrictEqual({ foo: "bar" });
    });

    it("should find JSON object in text", () => {
        expect.assertions(1);

        const result = extractJson("Some text before {\"foo\": \"bar\"} and after");

        expect(result).toStrictEqual({ foo: "bar" });
    });

    it("should return undefined for non-JSON", () => {
        expect.assertions(1);

        expect(extractJson("no json here")).toBeUndefined();
    });

    it("should return undefined for empty string", () => {
        expect.assertions(1);

        expect(extractJson("")).toBeUndefined();
    });
});

// --- normalizeRecommendation ---

describe("normalizeRecommendation", () => {
    it("should normalize valid values", () => {
        expect.assertions(4);

        const result = normalizeRecommendation({
            action: "update",
            breakingChanges: ["change1"],
            effort: "low",
            package: "react",
            reason: "safe update",
            riskLevel: "low",
        });

        expect(result.action).toBe("update");
        expect(result.riskLevel).toBe("low");
        expect(result.effort).toBe("low");
        expect(result.package).toBe("react");
    });

    it("should default invalid action to review", () => {
        expect.assertions(1);

        expect(normalizeRecommendation({ action: "invalid" }).action).toBe("review");
    });

    it("should default invalid riskLevel to medium", () => {
        expect.assertions(1);

        expect(normalizeRecommendation({ riskLevel: "extreme" }).riskLevel).toBe("medium");
    });

    it("should default invalid effort to medium", () => {
        expect.assertions(1);

        expect(normalizeRecommendation({ effort: "huge" }).effort).toBe("medium");
    });

    it("should default missing fields", () => {
        expect.assertions(3);

        const result = normalizeRecommendation({});

        expect(result.package).toBe("");
        expect(result.reason).toBe("");
        expect(result.breakingChanges).toStrictEqual([]);
    });
});

// --- parseAiResponse ---

describe("parseAiResponse", () => {
    it("should parse valid AI response", () => {
        expect.assertions(4);

        const response = JSON.stringify({
            recommendations: [{ action: "update", breakingChanges: [], effort: "low", package: "react", reason: "safe", riskLevel: "low" }],
            summary: "All good",
            warnings: [],
        });

        const result = parseAiResponse(response, "claude");

        expect(result.provider).toBe("claude");
        expect(result.summary).toBe("All good");
        expect(result.recommendations).toHaveLength(1);
        expect(result.recommendations[0]?.package).toBe("react");
    });

    it("should handle invalid JSON gracefully", () => {
        expect.assertions(3);

        const result = parseAiResponse("not json at all", "gemini");

        expect(result.provider).toBe("gemini");
        expect(result.recommendations).toHaveLength(0);
        expect(result.warnings).toHaveLength(1);
    });

    it("should handle response wrapped in markdown", () => {
        expect.assertions(2);

        const json = JSON.stringify({
            recommendations: [{ action: "review", package: "lodash", reason: "major", riskLevel: "high" }],
            summary: "Review needed",
        });

        const result = parseAiResponse(`Here's my analysis:\n\`\`\`json\n${json}\n\`\`\``, "claude");

        expect(result.recommendations).toHaveLength(1);
        expect(result.summary).toBe("Review needed");
    });

    it("should handle missing recommendations field", () => {
        expect.assertions(2);

        const result = parseAiResponse("{\"summary\": \"test\"}", "codex");

        expect(result.recommendations).toHaveLength(0);
        expect(result.summary).toBe("test");
    });
});

// --- ruleBasedAnalysis ---

describe("ruleBasedAnalysis", () => {
    it("should classify patch updates as low risk", () => {
        expect.assertions(2);

        const result = ruleBasedAnalysis([makeEntry({ updateType: "patch" })]);

        expect(result.recommendations[0]?.riskLevel).toBe("low");
        expect(result.recommendations[0]?.action).toBe("update");
    });

    it("should classify minor updates as medium risk", () => {
        expect.assertions(1);

        const result = ruleBasedAnalysis([makeEntry({ updateType: "minor" })]);

        expect(result.recommendations[0]?.riskLevel).toBe("medium");
    });

    it("should classify major updates as high risk", () => {
        expect.assertions(1);

        const result = ruleBasedAnalysis([makeEntry({ updateType: "major" })]);

        expect(result.recommendations[0]?.riskLevel).toBe("high");
    });

    it("should detect known breaking changes for react", () => {
        expect.assertions(2);

        const result = ruleBasedAnalysis([makeEntry({ packageName: "react", updateType: "major" })]);

        expect(result.recommendations[0]?.breakingChanges.length).toBeGreaterThan(0);
        expect(result.recommendations[0]?.action).toBe("review");
    });

    it("should flag security-sensitive packages", () => {
        expect.assertions(2);

        const result = ruleBasedAnalysis([makeEntry({ packageName: "jsonwebtoken", updateType: "major" })]);

        expect(result.recommendations[0]?.action).toBe("review");
        expect(result.recommendations[0]?.effort).toBe("high");
    });

    it("should prioritize security updates", () => {
        expect.assertions(2);

        const result = ruleBasedAnalysis([
            makeEntry({
                updateType: "patch",
                vulnerabilities: [{ cvssScore: 7.5, fixedVersions: [], id: "GHSA-1234", severity: "HIGH", summary: "vuln" }],
            }),
        ]);

        expect(result.recommendations[0]?.action).toBe("update");
        expect(result.recommendations[0]?.reason).toContain("vulnerabilities");
    });

    it("should use rule-engine as provider name", () => {
        expect.assertions(1);

        const result = ruleBasedAnalysis([makeEntry()]);

        expect(result.provider).toBe("rule-engine");
    });

    it("should include fallback warning", () => {
        expect.assertions(2);

        const result = ruleBasedAnalysis([makeEntry()]);

        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain("rule engine");
    });
});

// --- formatAiAnalysis ---

describe("formatAiAnalysis", () => {
    it("should include provider name in header", () => {
        expect.assertions(3);

        const result: AiAnalysisResult = {
            provider: "claude",
            recommendations: [{ action: "update", breakingChanges: [], effort: "low", package: "react", reason: "safe", riskLevel: "low" }],
            summary: "All safe",
            warnings: [],
        };

        const output = formatAiAnalysis(result);

        expect(output).toContain("claude");
        expect(output).toContain("All safe");
        expect(output).toContain("react");
    });

    it("should show breaking changes", () => {
        expect.assertions(2);

        const result: AiAnalysisResult = {
            provider: "rule-engine",
            recommendations: [{ action: "review", breakingChanges: ["API changed"], effort: "medium", package: "react", reason: "major", riskLevel: "high" }],
            summary: "Review needed",
            warnings: [],
        };

        const output = formatAiAnalysis(result);

        expect(output).toContain("Breaking");
        expect(output).toContain("API changed");
    });

    it("should show warnings", () => {
        expect.assertions(1);

        const result: AiAnalysisResult = {
            provider: "rule-engine",
            recommendations: [],
            summary: "Done",
            warnings: ["No AI provider available"],
        };

        const output = formatAiAnalysis(result);

        expect(output).toContain("No AI provider available");
    });
});
