import { ensureDirSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isIgnored, loadIgnoreRules } from "../../../../src/commands/update/ecosystems/dependabot";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../../test-helpers";

describe(loadIgnoreRules, () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-dependabot-rules-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("returns empty rule sets when no config is present", () => {
        expect.assertions(3);

        const rules = loadIgnoreRules(workspaceRoot);

        expect(rules.actions.size).toBe(0);
        expect(rules.docker.size).toBe(0);
        expect(rules.gitlab.size).toBe(0);
    });

    it("parses dependabot.yml ignore blocks per ecosystem", () => {
        expect.assertions(2);

        ensureDirSync(join(workspaceRoot, ".github"));
        writeFileSync(
            join(workspaceRoot, ".github/dependabot.yml"),
            [
                "version: 2",
                "updates:",
                "  - package-ecosystem: github-actions",
                "    directory: \"/\"",
                "    schedule:",
                "      interval: weekly",
                "    ignore:",
                "      - dependency-name: \"actions/checkout\"",
                "      - dependency-name: \"docker/login-action@v3\"",
                "  - package-ecosystem: docker",
                "    directory: \"/\"",
                "    ignore:",
                "      - dependency-name: \"node\"",
                "",
            ].join("\n"),
        );

        const rules = loadIgnoreRules(workspaceRoot);

        expect([...rules.actions]).toStrictEqual(["actions/checkout", "docker/login-action"]);
        expect([...rules.docker]).toStrictEqual(["node"]);
    });

    it("parses renovate.json top-level ignoreDeps + manager scopes", () => {
        expect.assertions(2);

        writeFileSync(
            join(workspaceRoot, "renovate.json"),
            JSON.stringify({
                dockerfile: { ignoreDeps: ["alpine"] },
                "github-actions": { ignoreDeps: ["actions/cache"] },
                ignoreDeps: ["typescript"],
            }),
        );

        const rules = loadIgnoreRules(workspaceRoot);

        // Top-level ignoreDeps applies to every ecosystem.
        expect(rules.actions.has("typescript")).toBe(true);
        expect(rules.docker.has("alpine")).toBe(true);
    });

    it("parses renovate.json packageRules with enabled=false", () => {
        expect.assertions(1);

        writeFileSync(
            join(workspaceRoot, "renovate.json"),
            JSON.stringify({
                packageRules: [
                    {
                        enabled: false,
                        matchManagers: ["github-actions"],
                        matchPackageNames: ["actions/upload-artifact"],
                    },
                ],
            }),
        );

        const rules = loadIgnoreRules(workspaceRoot);

        expect(rules.actions.has("actions/upload-artifact")).toBe(true);
    });
});

describe(isIgnored, () => {
    it("returns false for empty rule sets fast", () => {
        expect.assertions(1);

        const rules = { actions: new Set<string>(), docker: new Set<string>(), gitlab: new Set<string>() };

        expect(isIgnored("anything", "actions", rules)).toBe(false);
    });

    it("matches exact names", () => {
        expect.assertions(1);

        const rules = {
            actions: new Set<string>(["actions/checkout"]),
            docker: new Set<string>(),
            gitlab: new Set<string>(),
        };

        expect(isIgnored("actions/checkout", "actions", rules)).toBe(true);
    });

    it("matches glob-style patterns (`actions/*`)", () => {
        expect.assertions(2);

        const rules = {
            actions: new Set<string>(["actions/*"]),
            docker: new Set<string>(),
            gitlab: new Set<string>(),
        };

        expect(isIgnored("actions/checkout", "actions", rules)).toBe(true);
        // Anchored — `pnpm/action-setup` shouldn't match `actions/*`.
        expect(isIgnored("pnpm/action-setup", "actions", rules)).toBe(false);
    });
});
