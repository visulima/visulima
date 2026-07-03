import { afterEach, describe, expect, it } from "vitest";

import type { GitleaksConfig } from "../src/config-loader";
import { buildRuleMeta, prepareScan, resetPrepareScanCacheForTests } from "../src/prepare-scan";

afterEach(() => {
    resetPrepareScanCacheForTests();
});

describe("prepareScan — memoization", () => {
    it("returns the same prepared bundle for two calls with equivalent non-inline options", () => {
        expect.assertions(1);

        const options = { config: { minConfidence: "medium" as const } };
        const first = prepareScan(options);
        const second = prepareScan({ config: { minConfidence: "medium" as const } });

        // Cache hit → identical object reference (no re-resolve / re-buildRuleMeta).
        expect(second).toBe(first);
    });

    it("does not cache inline configs (rebuilds each call)", () => {
        expect.assertions(1);

        const inline: GitleaksConfig = { rules: [{ id: "custom.rule", regex: "x" }] };
        const first = prepareScan({ config: { extendBundled: false, inline } });
        const second = prepareScan({ config: { extendBundled: false, inline } });

        expect(second).not.toBe(first);
    });

    it("misses the cache when a config-shaping option differs", () => {
        expect.assertions(1);

        const a = prepareScan({ config: { minConfidence: "low" as const } });
        const b = prepareScan({ config: { minConfidence: "high" as const } });

        expect(b).not.toBe(a);
    });
});

describe(buildRuleMeta, () => {
    it("maps a well-formed rule's checksum, pattern, validation, and deps", () => {
        expect.assertions(4);

        const config = {
            rules: [
                {
                    dependsOnRule: [{ rule_id: "aws.1", variable: "AKID" }],
                    id: "aws.2",
                    patternRequirements: { checksum: { expected: "{{ x }}" } },
                    regex: String.raw`AKIA[0-9A-Z]{16}`,
                    validation: { type: "AWS" },
                },
            ],
        } as unknown as GitleaksConfig;

        const map = buildRuleMeta(config);
        const meta = map.get("aws.2");

        expect(meta?.pattern).toBe(String.raw`AKIA[0-9A-Z]{16}`);
        expect(meta?.checksum).toStrictEqual({ expected: "{{ x }}" });
        expect(meta?.validation).toStrictEqual({ type: "AWS" });
        expect(meta?.dependsOnRule).toStrictEqual([{ ruleId: "aws.1", variable: "AKID" }]);
    });

    it("accepts the camelCase `ruleId` spelling for dependsOnRule entries", () => {
        expect.assertions(1);

        const config = {
            rules: [{ dependsOnRule: [{ ruleId: "parent.rule", variable: "TOKEN" }], id: "child.rule" }],
        } as unknown as GitleaksConfig;

        expect(buildRuleMeta(config).get("child.rule")?.dependsOnRule).toStrictEqual([{ ruleId: "parent.rule", variable: "TOKEN" }]);
    });

    it("drops dependsOnRule entries without a string variable or rule id", () => {
        expect.assertions(1);

        const config = {
            rules: [
                {
                    dependsOnRule: [
                        // missing `variable`
                        { rule_id: "x" },
                        // `variable` not a string
                        { rule_id: "x", variable: 5 },
                        // missing both rule_id and ruleId
                        { variable: "OK" },
                        // non-object entry
                        "garbage",
                    ],
                    id: "noisy.rule",
                },
            ],
        } as unknown as GitleaksConfig;

        // Every entry is malformed → deps collapse to undefined.
        expect(buildRuleMeta(config).get("noisy.rule")?.dependsOnRule).toBeUndefined();
    });

    it("skips non-object and id-less rules", () => {
        expect.assertions(1);

        const config = {
            rules: [
                // eslint-disable-next-line unicorn/no-null -- exercising the runtime null guard for malformed config rules.
                null,
                "not-an-object",
                { description: "no id" },
                { id: "kept.rule" },
            ],
        } as unknown as GitleaksConfig;

        expect([...buildRuleMeta(config).keys()]).toStrictEqual(["kept.rule"]);
    });

    it("returns an empty map when the config has no rules", () => {
        expect.assertions(1);

        expect(buildRuleMeta({}).size).toBe(0);
    });

    it("leaves checksum/pattern/validation undefined when the rule omits them", () => {
        expect.assertions(3);

        const meta = buildRuleMeta({ rules: [{ id: "bare" }] }).get("bare");

        expect(meta?.checksum).toBeUndefined();
        expect(meta?.pattern).toBeUndefined();
        expect(meta?.validation).toBeUndefined();
    });
});
