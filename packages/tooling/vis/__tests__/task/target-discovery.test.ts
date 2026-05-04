import type { WorkspaceConfiguration } from "@visulima/task-runner";
import { describe, expect, it } from "vitest";

import type { ProjectOptionsIndex } from "../../src/config/workspace";
import { buildAliasMap, collectAvailableTargets, formatTargetList, resolveTargetAlias, suggestTarget, suggestTargets } from "../../src/task/target-discovery";
import type { VisTargetConfiguration } from "../../src/task/target-options";

describe(collectAvailableTargets, () => {
    it("should return sorted unique targets from 2 projects with overlapping targets", () => {
        expect.assertions(1);

        const workspace: WorkspaceConfiguration = {
            projects: {
                "app-a": {
                    root: "packages/app-a",
                    targets: {
                        build: { command: "tsc" },
                        lint: { command: "eslint ." },
                        test: { command: "vitest" },
                    },
                },
                "app-b": {
                    root: "packages/app-b",
                    targets: {
                        build: { command: "tsc" },
                        deploy: { command: "deploy.sh" },
                        test: { command: "vitest" },
                    },
                },
            },
        };

        expect(collectAvailableTargets(workspace)).toStrictEqual(["build", "deploy", "lint", "test"]);
    });
});

describe(suggestTarget, () => {
    it("should suggest 'build' for typo 'buld'", () => {
        expect.assertions(1);

        expect(suggestTarget("buld", ["build", "test", "lint"])).toBe("build");
    });

    it("should return undefined when no candidate is within maxDistance", () => {
        expect.assertions(1);

        expect(suggestTarget("xyz", ["build", "test", "lint"], 1)).toBeUndefined();
    });
});

describe(formatTargetList, () => {
    it("should format a non-empty list with indented dashes", () => {
        expect.assertions(1);

        expect(formatTargetList(["build", "test"])).toBe("  - build\n  - test");
    });

    it("should return '(no targets found)' for an empty list", () => {
        expect.assertions(1);

        expect(formatTargetList([])).toBe("  (no targets found)");
    });
});

describe(suggestTargets, () => {
    it("returns candidates ranked by ascending edit distance up to limit", () => {
        expect.assertions(1);

        // tst→test=1, tst→lint=2, tst→build=4, *-unit/-e2e=5-6.
        // With maxDistance=3, only test (1) and lint (2) qualify.
        expect(suggestTargets("tst", ["build", "lint", "test", "test-unit"], 3, 3)).toStrictEqual(["test", "lint"]);
    });

    it("returns [] when nothing falls inside maxDistance", () => {
        expect.assertions(1);
        expect(suggestTargets("wildlyoff", ["build", "test"])).toStrictEqual([]);
    });
});

describe(buildAliasMap, () => {
    const makeIndex = (targets: Record<string, VisTargetConfiguration>): ProjectOptionsIndex => new Map([["app", targets]]);

    it("returns declared aliases mapped to their canonical names", () => {
        expect.assertions(2);

        const index = makeIndex({
            test: { aliases: ["t", "spec"], command: "vitest" },
        });

        const map = buildAliasMap(index);

        expect(map.get("t")).toBe("test");
        expect(map.get("spec")).toBe("test");
    });

    it("first declaration wins on conflict", () => {
        expect.assertions(1);

        const index: ProjectOptionsIndex = new Map([
            ["a", { test: { aliases: ["x"] } }],
            ["b", { build: { aliases: ["x"] } }],
        ]);

        const map = buildAliasMap(index);

        // "test" is encountered first because of insertion order.
        expect(map.get("x")).toBe("test");
    });

    it("does not map canonical names", () => {
        expect.assertions(1);

        const index = makeIndex({
            test: { command: "vitest" },
        });

        expect(buildAliasMap(index).has("test")).toBe(false);
    });
});

describe(resolveTargetAlias, () => {
    it("returns the canonical name for an alias", () => {
        expect.assertions(1);
        expect(resolveTargetAlias("t", new Map([["t", "test"]]))).toBe("test");
    });

    it("passes non-alias input through unchanged", () => {
        expect.assertions(1);
        expect(resolveTargetAlias("build", new Map([["t", "test"]]))).toBe("build");
    });
});
