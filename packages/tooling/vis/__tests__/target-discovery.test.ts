import type { WorkspaceConfiguration } from "@visulima/task-runner";
import { describe, expect, it } from "vitest";

import { collectAvailableTargets, formatTargetList, suggestTarget } from "../src/target-discovery";

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
