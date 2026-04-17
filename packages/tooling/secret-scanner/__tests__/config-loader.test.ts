import { describe, expect, it } from "vitest";

import type { GitleaksConfig, GitleaksRule } from "../src/config-loader";
import { expandTagFilters, gateOptInRules } from "../src/config-loader";

const rules: GitleaksRule[] = [
    { id: "aws", tags: ["cloud", "iam"] },
    { id: "gh", tags: ["scm"] },
    { defaultEnabled: false, id: "weak-1", tags: ["preset:weak-passwords"] },
    { defaultEnabled: false, id: "pm-1", tags: ["preset:password-manager", "vault"] },
    { defaultEnabled: false, id: "pm-2", tags: ["preset:password-manager", "vault"] },
    { id: "no-tags" },
];

describe(expandTagFilters, () => {
    it("returns undefined for empty or missing lists", () => {
        expect.assertions(2);

        expect(expandTagFilters(undefined, rules, "rules.include")).toBeUndefined();
        expect(expandTagFilters([], rules, "rules.include")).toBeUndefined();
    });

    it("passes literal ids through untouched", () => {
        expect.assertions(1);

        expect(expandTagFilters(["aws", "gh"], rules, "rules.include")).toStrictEqual(["aws", "gh"]);
    });

    it("expands tag:<name> to every matching rule id", () => {
        expect.assertions(1);

        expect(expandTagFilters(["tag:preset:password-manager"], rules, "rules.enable")).toStrictEqual(["pm-1", "pm-2"]);
    });

    it("mixes literal ids and tag expansions in input order", () => {
        expect.assertions(1);

        expect(expandTagFilters(["aws", "tag:preset:weak-passwords", "gh"], rules, "rules.enable")).toStrictEqual(["aws", "weak-1", "gh"]);
    });

    it("throws on a tag that matches zero rules, listing known tags", () => {
        expect.assertions(2);

        expect(() => expandTagFilters(["tag:preset:week-passwords"], rules, "rules.enable")).toThrow(/matched zero rules/);
        expect(() => expandTagFilters(["tag:preset:week-passwords"], rules, "rules.enable")).toThrow(/preset:weak-passwords/);
    });

    it("does not throw on literal ids that reference unloaded rules", () => {
        expect.assertions(1);

        // Filtering is downstream's job — missing ids silently match nothing.
        expect(expandTagFilters(["unknown-rule"], rules, "rules.include")).toStrictEqual(["unknown-rule"]);
    });
});

describe(gateOptInRules, () => {
    const config: GitleaksConfig = { rules };

    it("returns the config unchanged when no rule is opt-in", () => {
        expect.assertions(1);

        const allEnabled: GitleaksConfig = { rules: rules.filter((r) => r.defaultEnabled !== false) };

        expect(gateOptInRules(allEnabled, new Set())).toBe(allEnabled);
    });

    it("drops every opt-in rule when the enabled set is empty", () => {
        expect.assertions(1);

        const gated = gateOptInRules(config, new Set());

        expect(gated.rules?.map((r) => r.id)).toStrictEqual(["aws", "gh", "no-tags"]);
    });

    it("keeps opt-in rules whose id is in the enabled set", () => {
        expect.assertions(1);

        const gated = gateOptInRules(config, new Set(["pm-1"]));

        expect(gated.rules?.map((r) => r.id)).toStrictEqual(["aws", "gh", "pm-1", "no-tags"]);
    });

    it("leaves always-enabled rules alone regardless of enabled set contents", () => {
        expect.assertions(1);

        const gated = gateOptInRules(config, new Set(["aws", "weak-1"]));

        expect(gated.rules?.map((r) => r.id)).toStrictEqual(["aws", "gh", "weak-1", "no-tags"]);
    });
});
