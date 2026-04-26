import { beforeAll, describe, expect, it } from "vitest";

import { listRules, scanString } from "../src";

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
