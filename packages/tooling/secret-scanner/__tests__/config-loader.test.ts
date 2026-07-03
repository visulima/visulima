import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GitleaksConfig, GitleaksRule } from "../src/config-loader";
import { expandTagFilters, gateOptInRules, getBundledConfig, resetConfigCacheForTests, resolveConfig } from "../src/config-loader";

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

    it("returns the config untouched when there is no `rules` array", () => {
        expect.assertions(1);

        // `rules` is optional; its absence hits the `!Array.isArray` guard and
        // returns the same object reference unchanged.
        const noRules: GitleaksConfig = { description: "no rules array" };

        expect(gateOptInRules(noRules, new Set())).toBe(noRules);
    });
});

describe(resolveConfig, () => {
    let tmp: string;

    beforeEach(async () => {
        resetConfigCacheForTests();
        tmp = await mkdtemp(resolve(tmpdir(), "secret-scanner-config-"));
    });

    afterEach(async () => {
        resetConfigCacheForTests();
        await rm(tmp, { force: true, recursive: true });
    });

    it("returns the bundled config when neither inline config nor path is given", () => {
        expect.assertions(1);

        const resolved = resolveConfig();

        expect((resolved.rules ?? []).length).toBeGreaterThan(0);
    });

    it("returns the inline config verbatim when extendBundled is false", () => {
        expect.assertions(2);

        const inline: GitleaksConfig = { rules: [{ id: "only-mine" }] };
        const resolved = resolveConfig({ config: inline, extendBundled: false });

        expect(resolved).toBe(inline);
        expect(resolved.rules?.map((r) => r.id)).toStrictEqual(["only-mine"]);
    });

    it("merges an inline config over the bundled rules by default, with overlay ids winning", () => {
        expect.assertions(2);

        const bundledCount = (getBundledConfig().rules ?? []).length;
        const resolved = resolveConfig({ config: { rules: [{ id: "custom-extra-rule" }] } });

        expect(resolved.rules?.some((r) => r.id === "custom-extra-rule")).toBe(true);
        // The overlay added exactly one new id, so the merged count grows by one.
        expect(resolved.rules ?? []).toHaveLength(bundledCount + 1);
    });

    it("reads, caches, and merges a config from a path", async () => {
        expect.assertions(2);

        const path = resolve(tmp, "user-config.json");

        await writeFile(path, JSON.stringify({ rules: [{ id: "from-disk" }] }));

        const first = resolveConfig({ configPath: path });

        expect(first.rules?.some((r) => r.id === "from-disk")).toBe(true);

        // Mutate the file; the second resolve should hit the per-path cache and
        // still see the original rule (proving the cache short-circuits the read).
        await writeFile(path, JSON.stringify({ rules: [{ id: "changed-on-disk" }] }));

        const second = resolveConfig({ configPath: path });

        expect(second.rules?.some((r) => r.id === "from-disk")).toBe(true);
    });

    it("returns the user config verbatim from a path when extendBundled is false", async () => {
        expect.assertions(1);

        const path = resolve(tmp, "standalone.json");

        await writeFile(path, JSON.stringify({ rules: [{ id: "standalone-rule" }] }));

        const resolved = resolveConfig({ configPath: path, extendBundled: false });

        expect(resolved.rules?.map((r) => r.id)).toStrictEqual(["standalone-rule"]);
    });

    it("falls back to the bundled config when a path config has no rules", async () => {
        expect.assertions(1);

        const path = resolve(tmp, "empty.json");

        await writeFile(path, JSON.stringify({ description: "no rules here" }));

        const resolved = resolveConfig({ configPath: path });
        const bundledCount = (getBundledConfig().rules ?? []).length;

        expect(resolved.rules ?? []).toHaveLength(bundledCount);
    });
});
