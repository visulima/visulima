import { describe, expect, it } from "vitest";

import {
    DEFAULT_CLEAN_KEEP,
    DEFAULT_CLEAN_STRIP,
    DEFAULT_CONFIG,
    DEFAULT_DEPENDENCY_BUMP_RULES,
    defineReleaseConfig,
    resolveCleanStripList,
} from "../../src/release/config";

describe(defineReleaseConfig, () => {
    it("returns the input unchanged (identity for typing only)", () => {
        const input = { access: "public" as const, baseBranch: "main" };
        const output = defineReleaseConfig(input);

        expect(output).toBe(input);
    });
});

describe("defaults — DEFAULT_CONFIG", () => {
    it("uses sane defaults", () => {
        expect(DEFAULT_CONFIG.baseBranch).toBe("main");
        expect(DEFAULT_CONFIG.changesDir).toBe(".vis/release");
        expect(DEFAULT_CONFIG.access).toBe("public");
        expect(DEFAULT_CONFIG.changelog).toBe("default");
        expect(DEFAULT_CONFIG.changedFilePatterns).toEqual(["**"]);
        expect(DEFAULT_CONFIG.updateInternalDependencies).toBe("out-of-range");
        expect(DEFAULT_CONFIG.fixed).toEqual([]);
        expect(DEFAULT_CONFIG.linked).toEqual([]);
        expect(DEFAULT_CONFIG.ignore).toEqual([]);
        expect(DEFAULT_CONFIG.include).toEqual([]);
        expect(DEFAULT_CONFIG.allowCustomCommands).toBe(false);
        expect(DEFAULT_CONFIG.defaultManaged).toBe(false);
    });
});

describe("defaults — DEFAULT_DEPENDENCY_BUMP_RULES", () => {
    it("propagates patch on dependencies, match on peers, ignores devDeps", () => {
        expect(DEFAULT_DEPENDENCY_BUMP_RULES.dependencies).toEqual({ bumpAs: "patch", trigger: "patch" });
        expect(DEFAULT_DEPENDENCY_BUMP_RULES.peerDependencies).toEqual({ bumpAs: "match", trigger: "major" });
        expect(DEFAULT_DEPENDENCY_BUMP_RULES.devDependencies).toBe(false);
        expect(DEFAULT_DEPENDENCY_BUMP_RULES.optionalDependencies).toEqual({ bumpAs: "patch", trigger: "minor" });
    });
});

describe("defaults — DEFAULT_CLEAN_STRIP / DEFAULT_CLEAN_KEEP", () => {
    it("strips scripts and devDependencies by default", () => {
        expect(DEFAULT_CLEAN_STRIP).toContain("scripts");
        expect(DEFAULT_CLEAN_STRIP).toContain("devDependencies");
        expect(DEFAULT_CLEAN_STRIP).toContain("vis-release");
    });

    it("keeps essential publish fields by default", () => {
        expect(DEFAULT_CLEAN_KEEP).toContain("name");
        expect(DEFAULT_CLEAN_KEEP).toContain("version");
        expect(DEFAULT_CLEAN_KEEP).toContain("dependencies");
        expect(DEFAULT_CLEAN_KEEP).toContain("exports");
    });
});

describe(resolveCleanStripList, () => {
    it("returns [] for false (do not strip)", () => {
        expect(resolveCleanStripList(false)).toEqual([]);
    });

    it("returns defaults for true", () => {
        expect(resolveCleanStripList(true)).toEqual([...DEFAULT_CLEAN_STRIP]);
    });

    it("returns defaults for undefined", () => {
        expect(resolveCleanStripList(undefined)).toEqual([...DEFAULT_CLEAN_STRIP]);
    });

    it("merges user strip list with defaults", () => {
        const list = resolveCleanStripList({ strip: ["customField"] });

        expect(list).toContain("scripts");
        expect(list).toContain("customField");
    });

    it("removes keys listed in keep[] from the strip list", () => {
        const list = resolveCleanStripList({ keep: ["scripts"] });

        expect(list).not.toContain("scripts");
        expect(list).toContain("devDependencies"); // not in keep
    });

    it("strip + keep — strip wins for new fields, keep wins for defaults", () => {
        const list = resolveCleanStripList({ keep: ["devDependencies"], strip: ["custom"] });

        expect(list).toContain("custom");
        expect(list).not.toContain("devDependencies");
    });

    it("deduplicates entries when user strip overlaps defaults", () => {
        const list = resolveCleanStripList({ strip: ["scripts", "scripts"] });

        const scriptsCount = list.filter((s) => s === "scripts").length;

        expect(scriptsCount).toBe(1);
    });

    it("ignores keep entries that aren't in defaults — has no error", () => {
        const list = resolveCleanStripList({ keep: ["nonexistent-field"] });

        expect(list).toEqual([...DEFAULT_CLEAN_STRIP]);
    });
});
