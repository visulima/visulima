import { existsSync } from "node:fs";

import { join } from "@visulima/path";

import type { PackageJson } from "../config/workspace";
import type { VisTargetConfiguration } from "../task/target-options";
import { apiExtractorDetector } from "./detectors/api-extractor";
import { astroDetector } from "./detectors/astro";
import { biomeDetector } from "./detectors/biome";
import { bunDetector } from "./detectors/bun";
import { changesetDetector } from "./detectors/changeset";
import { cypressDetector } from "./detectors/cypress";
import { denoDetector } from "./detectors/deno";
import { docusaurusDetector } from "./detectors/docusaurus";
import { drizzleDetector } from "./detectors/drizzle";
import { eslintDetector } from "./detectors/eslint";
import { gatsbyDetector } from "./detectors/gatsby";
import { graphqlCodegenDetector } from "./detectors/graphql-codegen";
import { jestDetector } from "./detectors/jest";
import { knipDetector } from "./detectors/knip";
import { nestDetector } from "./detectors/nest";
import { nextDetector } from "./detectors/next";
import { nuxtDetector } from "./detectors/nuxt";
import { oxfmtDetector } from "./detectors/oxfmt";
import { oxlintDetector } from "./detectors/oxlint";
import { packemDetector } from "./detectors/packem";
import { playwrightDetector } from "./detectors/playwright";
import { prettierDetector } from "./detectors/prettier";
import { prismaDetector } from "./detectors/prisma";
import { remixDetector } from "./detectors/remix";
import { rolldownDetector } from "./detectors/rolldown";
import { rollupDetector } from "./detectors/rollup";
import { storybookDetector } from "./detectors/storybook";
import { stylelintDetector } from "./detectors/stylelint";
import { tsdownDetector } from "./detectors/tsdown";
import { tsupDetector } from "./detectors/tsup";
import { typedocDetector } from "./detectors/typedoc";
import { typescriptDetector } from "./detectors/typescript";
import { viteDetector } from "./detectors/vite";
import { vitepressDetector } from "./detectors/vitepress";
import { vitestDetector } from "./detectors/vitest";
import { webpackDetector } from "./detectors/webpack";
import type { DetectContext, Detector } from "./types";

export type { DetectContext, DetectedTargets, Detector } from "./types";

/**
 * Detector registry. Order is meaningful: when two detectors would
 * synthesize the same target name, the earlier entry wins. Per-name
 * priorities baked into this list:
 *
 * - `build`: nuxt > next > remix > astro > gatsby > docusaurus > vite >
 *   nest > rolldown > tsdown > tsup > packem > rollup > webpack
 * - `dev` / `preview` / `start` / `serve`: cascades from `build` order;
 *   gatsby owns `develop` uniquely
 * - `test`: vitest > jest > bun > deno (`test:e2e` is playwright >
 *   cypress)
 * - `lint`: eslint > biome > oxlint > deno
 * - `format` / `format:check`: prettier > biome > oxfmt
 *
 * Single-owner targets (no collision possible): `typecheck` (typescript),
 * `storybook` / `build-storybook`, `knip`, `lint:css` (stylelint),
 * `generate` (nuxt), `cypress:open`, `docs` (typedoc), `docs:build` /
 * `docs:dev` / `docs:preview` (vitepress), `db:*` (prisma > drizzle),
 * `codegen` (graphql), `api-extract`, `changeset:*`, deno's `fmt` /
 * `check`.
 */
export const BUILT_IN_DETECTORS: ReadonlyArray<Detector> = [
    nuxtDetector,
    nextDetector,
    remixDetector,
    astroDetector,
    gatsbyDetector,
    docusaurusDetector,
    viteDetector,
    vitepressDetector,
    nestDetector,
    rolldownDetector,
    tsdownDetector,
    tsupDetector,
    packemDetector,
    rollupDetector,
    webpackDetector,
    vitestDetector,
    jestDetector,
    bunDetector,
    playwrightDetector,
    cypressDetector,
    storybookDetector,
    typescriptDetector,
    typedocDetector,
    eslintDetector,
    prettierDetector,
    biomeDetector,
    oxlintDetector,
    oxfmtDetector,
    stylelintDetector,
    knipDetector,
    denoDetector,
    prismaDetector,
    drizzleDetector,
    graphqlCodegenDetector,
    apiExtractorDetector,
    changesetDetector,
];

const hasDependency = (pkg: Pick<PackageJson, "dependencies" | "devDependencies" | "optionalDependencies" | "peerDependencies">, name: string): boolean =>
    // `Object.hasOwn` so a pinned-but-empty version (`"vitest": ""`,
    // workspace-link sentinels, `"file:..."` style entries) still counts
    // as "this dep is declared". `Boolean(value)` would drop the empty
    // string and miss the dep.
    (pkg.dependencies !== undefined && Object.hasOwn(pkg.dependencies, name)) ||
    (pkg.devDependencies !== undefined && Object.hasOwn(pkg.devDependencies, name)) ||
    (pkg.peerDependencies !== undefined && Object.hasOwn(pkg.peerDependencies, name)) ||
    (pkg.optionalDependencies !== undefined && Object.hasOwn(pkg.optionalDependencies, name));
const matchConfigFiles = (projectRoot: string, configFiles: ReadonlyArray<string>): string[] => {
    const matched: string[] = [];

    for (const file of configFiles) {
        if (existsSync(join(projectRoot, file))) {
            matched.push(file);
        }
    }

    return matched;
};

/**
 * Run every detector against a single project and return the merged
 * inferred-target map. Detector targets that already exist in the map
 * (from an earlier detector) are skipped — first wins, matching the
 * order of `BUILT_IN_DETECTORS`.
 *
 * Cheap by design: each detector does at most `configFiles.length`
 * `existsSync` calls plus an in-memory dep lookup. We intentionally
 * skip persistent caching in v1 — for a 50-project workspace with
 * ~16 detectors that's ~800 stat calls (sub-millisecond on any modern
 * FS), and a stale on-disk cache would be a worse failure mode than
 * recomputing.
 */
export const inferProjectTargets = (
    context: Omit<DetectContext, "hasConfigFile" | "matchedConfigs">,
    detectors: ReadonlyArray<Detector> = BUILT_IN_DETECTORS,
): { sources: string[]; targets: Record<string, Partial<VisTargetConfiguration>> } => {
    const targets: Record<string, Partial<VisTargetConfiguration>> = {};
    const sources: string[] = [];

    for (const detector of detectors) {
        const matchedConfigs = matchConfigFiles(context.projectRoot, detector.configFiles);
        const matchedByDep = detector.fallbackDependency !== undefined && hasDependency(context.pkg, detector.fallbackDependency);

        if (matchedConfigs.length === 0 && !matchedByDep) {
            continue;
        }

        const detected = detector.detect({ ...context, hasConfigFile: matchedConfigs.length > 0, matchedConfigs });
        let contributed = false;

        for (const [name, target] of Object.entries(detected.targets)) {
            if (targets[name] !== undefined) {
                continue;
            }

            targets[name] = target;
            contributed = true;
        }

        if (contributed) {
            sources.push(detector.name);
        }
    }

    return { sources, targets };
};
