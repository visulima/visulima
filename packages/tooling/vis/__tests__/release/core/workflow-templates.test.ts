import { describe, expect, it } from "vitest";

import { generateWorkflowFiles } from "../../../src/release/core/workflow-templates";

describe("generateWorkflowFiles — GitHub", () => {
    it("emits 3 files (release + check + snapshot) by default", () => {
        const files = generateWorkflowFiles({}, { branches: ["main"], packageManager: "pnpm", provider: "github" });

        expect(files).toHaveLength(3);
        expect(files.map((f) => f.path).sort()).toEqual([
            ".github/workflows/vis-release-check.yml",
            ".github/workflows/vis-release-snapshot.yml",
            ".github/workflows/vis-release.yml",
        ]);
    });

    it("uses configured branches in the on.push trigger", () => {
        const files = generateWorkflowFiles({}, {
            branches: ["main", "alpha", "beta"],
            packageManager: "pnpm",
            provider: "github",
        });

        const release = files.find((f) => f.path === ".github/workflows/vis-release.yml");

        expect(release).toBeDefined();
        expect(release!.content).toContain("\"main\"");
        expect(release!.content).toContain("\"alpha\"");
        expect(release!.content).toContain("\"beta\"");
    });

    it("derives branches from config.channels when not overridden", () => {
        const files = generateWorkflowFiles({
            channels: { alpha: { prerelease: "alpha", tag: "alpha" }, main: { tag: "latest" } },
        }, { packageManager: "pnpm", provider: "github" });

        const release = files.find((f) => f.path === ".github/workflows/vis-release.yml")!;

        expect(release.content).toContain("\"main\"");
        expect(release.content).toContain("\"alpha\"");
    });

    it("falls back to ['main'] when no channels are configured and no branches override", () => {
        const files = generateWorkflowFiles({}, { packageManager: "pnpm", provider: "github" });
        const release = files.find((f) => f.path === ".github/workflows/vis-release.yml")!;

        expect(release.content).toContain("\"main\"");
    });

    it("emits id-token: write when useOidc is true (default)", () => {
        const files = generateWorkflowFiles({}, { branches: ["main"], packageManager: "pnpm", provider: "github", useOidc: true });
        const release = files.find((f) => f.path === ".github/workflows/vis-release.yml")!;

        expect(release.content).toContain("id-token: write");
        expect(release.content).not.toContain("NPM_TOKEN");
    });

    it("emits NPM_TOKEN env when useOidc is false", () => {
        const files = generateWorkflowFiles({}, { branches: ["main"], packageManager: "pnpm", provider: "github", useOidc: false });
        const release = files.find((f) => f.path === ".github/workflows/vis-release.yml")!;

        expect(release.content).toContain("NPM_TOKEN");
        expect(release.content).not.toContain("id-token: write");
    });

    it("includes pnpm/action-setup for pnpm projects", () => {
        const files = generateWorkflowFiles({}, { branches: ["main"], packageManager: "pnpm", provider: "github" });
        const release = files.find((f) => f.path === ".github/workflows/vis-release.yml")!;

        expect(release.content).toContain("pnpm/action-setup");
    });

    it("includes oven-sh/setup-bun for bun projects", () => {
        const files = generateWorkflowFiles({}, { branches: ["main"], packageManager: "bun", provider: "github" });
        const release = files.find((f) => f.path === ".github/workflows/vis-release.yml")!;

        expect(release.content).toContain("oven-sh/setup-bun");
    });

    it("uses npm-specific install + exec commands for npm projects", () => {
        const files = generateWorkflowFiles({}, { branches: ["main"], packageManager: "npm", provider: "github" });
        const release = files.find((f) => f.path === ".github/workflows/vis-release.yml")!;

        expect(release.content).toContain("npm ci");
        expect(release.content).toContain("npx vis release");
        expect(release.content).not.toContain("pnpm exec");
    });

    it("uses yarn-specific install + exec commands for yarn projects", () => {
        const files = generateWorkflowFiles({}, { branches: ["main"], packageManager: "yarn", provider: "github" });
        const release = files.find((f) => f.path === ".github/workflows/vis-release.yml")!;

        expect(release.content).toContain("yarn install --immutable");
        expect(release.content).toContain("yarn exec vis release");
        expect(release.content).not.toContain("pnpm/action-setup");
        expect(release.content).not.toContain("oven-sh/setup-bun");
    });

    it("uses bun-specific install + exec commands for bun projects", () => {
        const files = generateWorkflowFiles({}, { branches: ["main"], packageManager: "bun", provider: "github" });
        const release = files.find((f) => f.path === ".github/workflows/vis-release.yml")!;

        expect(release.content).toContain("bun install --frozen-lockfile");
        expect(release.content).toContain("bunx vis release");
    });

    it("respects includeSnapshot: false", () => {
        const files = generateWorkflowFiles({}, { branches: ["main"], includeSnapshot: false, packageManager: "pnpm", provider: "github" });

        expect(files.find((f) => f.path === ".github/workflows/vis-release-snapshot.yml")).toBeUndefined();
    });

    it("respects includeCheck: false", () => {
        const files = generateWorkflowFiles({}, { branches: ["main"], includeCheck: false, packageManager: "pnpm", provider: "github" });

        expect(files.find((f) => f.path === ".github/workflows/vis-release-check.yml")).toBeUndefined();
    });
});

describe("generateWorkflowFiles — GitLab", () => {
    it("emits a single .gitlab-ci.yml at repo root", () => {
        const files = generateWorkflowFiles({}, { branches: ["main"], packageManager: "pnpm", provider: "gitlab" });

        expect(files).toHaveLength(1);
        expect(files[0]?.path).toBe(".gitlab-ci.yml");
    });

    it("uses GitLab merge_request_event for check + snapshot stages", () => {
        const files = generateWorkflowFiles({}, { branches: ["main"], packageManager: "pnpm", provider: "gitlab" });

        expect(files[0]?.content).toContain("merge_request_event");
        expect(files[0]?.content).toContain("vis-release-check");
        expect(files[0]?.content).toContain("vis-release-snapshot");
    });

    it("uses GitLab branch rules for release stage", () => {
        const files = generateWorkflowFiles({}, { branches: ["main", "alpha"], packageManager: "pnpm", provider: "gitlab" });

        expect(files[0]?.content).toContain("$CI_COMMIT_BRANCH == \"main\"");
        expect(files[0]?.content).toContain("$CI_COMMIT_BRANCH == \"alpha\"");
    });

    it("documents the GitLab token variables in the generated comment header", () => {
        const files = generateWorkflowFiles({}, { branches: ["main"], packageManager: "pnpm", provider: "gitlab" });

        expect(files[0]?.content).toContain("VIS_GH_TOKEN");
        expect(files[0]?.content).toContain("NPM_TOKEN");
    });

    it("emits corepack-based yarn bootstrap for yarn projects", () => {
        const files = generateWorkflowFiles({}, { branches: ["main"], packageManager: "yarn", provider: "gitlab" });

        expect(files[0]?.content).toContain("corepack enable");
        expect(files[0]?.content).toContain("yarn install --immutable");
        expect(files[0]?.content).toContain("yarn exec vis release ci release");
    });

    it("emits npm install -g pnpm for pnpm projects", () => {
        const files = generateWorkflowFiles({}, { branches: ["main"], packageManager: "pnpm", provider: "gitlab" });

        expect(files[0]?.content).toContain("npm install -g pnpm");
        expect(files[0]?.content).toContain("pnpm install --frozen-lockfile");
    });

    it("emits npm install -g bun for bun projects", () => {
        const files = generateWorkflowFiles({}, { branches: ["main"], packageManager: "bun", provider: "gitlab" });

        expect(files[0]?.content).toContain("npm install -g bun");
        expect(files[0]?.content).toContain("bun install --frozen-lockfile");
    });

    it("omits the bootstrap line entirely for npm projects", () => {
        const files = generateWorkflowFiles({}, { branches: ["main"], packageManager: "npm", provider: "gitlab" });

        // No package-manager bootstrap needed — node:22 image already ships npm.
        expect(files[0]?.content).not.toContain("npm install -g pnpm");
        expect(files[0]?.content).not.toContain("npm install -g bun");
        expect(files[0]?.content).not.toContain("corepack enable");
        expect(files[0]?.content).toContain("npm ci");
    });
});

describe("generateWorkflowFiles — provider auto-detection from config", () => {
    it("uses config.provider when set to github", () => {
        const files = generateWorkflowFiles({ provider: "github" }, { branches: ["main"], packageManager: "pnpm" });

        expect(files[0]?.path).toContain(".github/workflows/");
    });

    it("uses config.provider when set to gitlab", () => {
        const files = generateWorkflowFiles({ provider: "gitlab" }, { branches: ["main"], packageManager: "pnpm" });

        expect(files[0]?.path).toBe(".gitlab-ci.yml");
    });

    it("defaults to github when config.provider is auto", () => {
        const files = generateWorkflowFiles({ provider: "auto" }, { branches: ["main"], packageManager: "pnpm" });

        expect(files[0]?.path).toContain(".github/workflows/");
    });
});
