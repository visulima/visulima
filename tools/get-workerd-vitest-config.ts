/// <reference types="vitest" />
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import type { ViteUserConfig } from "vitest/config";
import { configDefaults, defineConfig } from "vitest/config";

const VITEST_SEQUENCE_SEED = Date.now();

/**
 * Shared Vitest config for running a package's test suite inside `workerd`,
 * the runtime behind Cloudflare Workers, via `@cloudflare/vitest-pool-workers`.
 *
 * Deliberately separate from `getVitestConfig`: the workers pool evaluates every
 * test file inside a workerd isolate, so it cannot use the Node pool defaults
 * (threads/forks, subprocess spawning, `node:fs` fixtures). Packages opt in with
 * a `vitest.workerd.config.ts` and keep workerd-only specs under
 * `__tests__/workerd/`.
 *
 * `nodejs_compat` is enabled because most packages here import at least one
 * `node:*` builtin (`node:buffer`, `node:process`, `node:async_hooks`). The
 * compatibility date pins the polyfill surface so a runtime bump cannot silently
 * change which builtins resolve.
 *
 * Reporter and `sequence.seed` handling deliberately mirrors `getVitestConfig`:
 * both configs feed the same CI jobs, so a workerd failure has to produce the
 * same GitHub Actions annotations a Node failure does, and ordering bugs have to
 * be just as reproducible from the logged seed.
 */
export const getWorkerdVitestConfig = (options: ViteUserConfig = {}): ViteUserConfig => {
    const { plugins = [], ...restOptions } = options;

    console.log("VITEST_SEQUENCE_SEED", VITEST_SEQUENCE_SEED);

    return defineConfig({
        ...restOptions,
        plugins: [
            ...plugins,
            cloudflareTest({
                miniflare: {
                    compatibilityDate: "2026-07-01",
                    compatibilityFlags: ["nodejs_compat"],
                },
            }),
        ],
        test: {
            hideSkippedTests: true,
            hookTimeout: 30_000,
            include: ["__tests__/workerd/**/*.test.ts"],
            name: "workerd",
            reporters: process.env.CI ? (process.env.CI_PREFLIGHT ? ["dot", "github-actions"] : ["dot"]) : ["default"],
            sequence: {
                seed: VITEST_SEQUENCE_SEED,
            },
            testTimeout: 30_000,
            typecheck: {
                enabled: false,
            },
            ...options.test,
            exclude: [...configDefaults.exclude, "__fixtures__/**", ...(options.test?.exclude ?? [])],
        },
    });
};
