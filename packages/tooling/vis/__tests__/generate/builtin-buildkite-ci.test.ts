import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { loadMoonTemplate } from "../../src/generate/moon-adapter";
import type { Creation, CreationDirectory, CreationFile } from "../../src/generate/types";

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIRECTORY = join(here, "../../templates/buildkite-ci");

const baseBuiltins = {
    dest_dir: "/tmp/dest",
    dest_rel_dir: "dest",
    working_dir: "/tmp",
    workspace_root: "/tmp",
};

const flatten = (tree: CreationDirectory, prefix = ""): Record<string, CreationFile> => {
    const out: Record<string, CreationFile> = {};

    for (const [key, value] of Object.entries(tree)) {
        const path = prefix ? `${prefix}/${key}` : key;

        if (typeof value === "string" || Buffer.isBuffer(value)) {
            out[path] = value;
        } else if (value && typeof value === "object") {
            Object.assign(out, flatten(value, path));
        }
    }

    return out;
};

const renderPipeline = async (options: Record<string, unknown>): Promise<string> => {
    const template = loadMoonTemplate(TEMPLATE_DIRECTORY, "buildkite-ci");
    const creation: Creation = await template.produce({ builtins: baseBuiltins, options });
    const files = flatten(creation.files ?? {});
    const pipeline = files[".buildkite/pipeline.yml"];

    if (typeof pipeline !== "string") {
        throw new TypeError("buildkite-ci template did not render `.buildkite/pipeline.yml` as text");
    }

    return pipeline;
};

describe("builtin buildkite-ci template", () => {
    it("should expose the documented metadata and variables", () => {
        expect.assertions(5);

        const template = loadMoonTemplate(TEMPLATE_DIRECTORY, "buildkite-ci");

        expect(template.about.name).toBe("Buildkite CI");
        expect(template.about.description).toContain("Buildkite pipeline.yml");
        expect(template.options.targets).toMatchObject({ default: "lint,test,build", type: "string" });
        expect(template.options.packageManager).toMatchObject({ type: "enum", values: ["pnpm", "npm", "yarn", "bun"] });
        expect(template.options.withHeal).toMatchObject({ default: false, type: "boolean" });
    });

    it("should render a minimal pnpm pipeline when withHeal is false", async () => {
        expect.assertions(7);

        const pipeline = await renderPipeline({ agentQueue: "default", packageManager: "pnpm", targets: "lint,test,build", withHeal: false });

        // Install step must run before invoking vis (otherwise vis is not on PATH).
        expect(pipeline).toContain("pnpm install --frozen-lockfile");
        expect(pipeline).toContain("pnpm vis ci lint,test,build");
        expect(pipeline).toContain("queue: default");
        expect(pipeline).toContain("timeout_in_minutes: 30");
        expect(pipeline).not.toContain("vis ai heal");
        expect(pipeline).not.toContain("heal-propose");
        expect(pipeline).not.toContain("heal-gate");
    });

    it("should render the heal propose + block + accept flow when withHeal is true", async () => {
        expect.assertions(8);

        const pipeline = await renderPipeline({ agentQueue: "ci-large", packageManager: "pnpm", targets: "lint,test,build", withHeal: true });

        expect(pipeline).toContain("pnpm vis ai heal");
        expect(pipeline).toContain("pnpm vis ai heal accept");
        expect(pipeline).toContain("key: heal-propose");
        expect(pipeline).toContain("key: heal-gate");
        expect(pipeline).toContain("key: heal-accept");
        expect(pipeline).toContain("build.failed_jobs > 0 && build.pull_request.id != null");
        // Defense-in-depth guard on the accept step too.
        expect(pipeline).toMatch(/heal-accept[\s\S]*?if: build\.pull_request\.id != null/);
        expect(pipeline).toContain("queue: ci-large");
    });

    it("should install before invoking vis on every package manager", async () => {
        expect.assertions(8);

        const pnpmPipeline = await renderPipeline({ agentQueue: "default", packageManager: "pnpm", targets: "lint,test,build", withHeal: false });
        const npmPipeline = await renderPipeline({ agentQueue: "default", packageManager: "npm", targets: "lint,test,build", withHeal: false });
        const yarnPipeline = await renderPipeline({ agentQueue: "default", packageManager: "yarn", targets: "lint,test,build", withHeal: false });
        const bunPipeline = await renderPipeline({ agentQueue: "default", packageManager: "bun", targets: "lint,test,build", withHeal: false });

        // Each PM must run a frozen / immutable install before the vis invocation.
        expect(pnpmPipeline).toMatch(/pnpm install --frozen-lockfile[\s\S]*?pnpm vis ci/);
        expect(npmPipeline).toMatch(/npm ci[\s\S]*?npx vis ci/);
        expect(yarnPipeline).toMatch(/yarn install --immutable[\s\S]*?yarn vis ci/);
        expect(bunPipeline).toMatch(/bun install --frozen-lockfile[\s\S]*?bunx vis ci/);

        // None of the templates should pin a `@latest` / `@stable` PM version —
        // corepack reads `packageManager` from package.json, and forcing a
        // floating tag yields non-reproducible CI.
        expect(pnpmPipeline).not.toContain("corepack prepare pnpm@latest");
        expect(yarnPipeline).not.toContain("corepack prepare yarn@stable");
        expect(npmPipeline).not.toContain("corepack");
        expect(bunPipeline).not.toContain("corepack");
    });

    it("should use the right exec form for `vis ai heal` on each package manager", async () => {
        expect.assertions(4);

        const pnpmPipeline = await renderPipeline({ agentQueue: "default", packageManager: "pnpm", targets: "lint,test,build", withHeal: true });
        const npmPipeline = await renderPipeline({ agentQueue: "default", packageManager: "npm", targets: "lint,test,build", withHeal: true });
        const yarnPipeline = await renderPipeline({ agentQueue: "default", packageManager: "yarn", targets: "lint,test,build", withHeal: true });
        const bunPipeline = await renderPipeline({ agentQueue: "default", packageManager: "bun", targets: "lint,test,build", withHeal: true });

        // `npm vis ai heal` is invalid — npm has no run-bin shorthand. Must use npx.
        expect(pnpmPipeline).toContain("pnpm vis ai heal accept");
        expect(npmPipeline).toMatch(/npx vis ai heal\b/);
        expect(yarnPipeline).toContain("yarn vis ai heal accept");
        expect(bunPipeline).toContain("bunx vis ai heal accept");
    });
});
