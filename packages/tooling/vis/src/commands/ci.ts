import type { Command } from "@visulima/cerebro";

import { ensureToolchain } from "../toolchain";

/**
 * Detect base/head refs from common CI provider environment variables.
 * Falls back to `main` / `HEAD` when no CI-specific info is available.
 */
const detectCiRefs = (): { base: string; head: string } => {
    // GitHub Actions: GITHUB_BASE_REF is set on pull_request events
    if (process.env["GITHUB_BASE_REF"]) {
        return {
            base: `origin/${process.env["GITHUB_BASE_REF"]}`,
            head: process.env["GITHUB_SHA"] ?? "HEAD",
        };
    }

    // GitLab CI
    if (process.env["CI_MERGE_REQUEST_TARGET_BRANCH_NAME"]) {
        return {
            base: `origin/${process.env["CI_MERGE_REQUEST_TARGET_BRANCH_NAME"]}`,
            head: process.env["CI_COMMIT_SHA"] ?? "HEAD",
        };
    }

    // CircleCI
    if (process.env["CIRCLE_BRANCH"] && process.env["CIRCLE_SHA1"]) {
        return {
            base: "origin/main",
            head: process.env["CIRCLE_SHA1"],
        };
    }

    // Generic / local fallback
    return { base: "origin/main", head: "HEAD" };
};

/**
 * `vis ci` bundles the CI lifecycle in a single entry:
 *
 * 1. Install dependencies (respecting lockfile / frozen install).
 * 2. Enforce project constraints (implicit, via the `run` command).
 * 3. Determine affected projects since the base ref.
 * 4. Run the requested targets on affected projects only.
 *
 * Meant to be invoked as a single command at the top of a CI job:
 *
 *   vis ci lint test build
 *
 * Compared to wiring these up by hand, this skips reinstalling when
 * already installed, uses CI-safe defaults, and picks up the base ref
 * from common CI provider environment variables.
 */
const ci: Command = {
    argument: {
        description: "Comma-separated list of targets to run (e.g., lint,test,build)",
        name: "targets",
        type: String,
    },
    description: "Run affected targets in a CI-optimized pipeline",
    examples: [
        ["vis ci lint,test,build", "Run lint, test, and build on affected projects"],
        ["vis ci test --base=origin/main", "Override the base ref"],
        ["vis ci build --no-install", "Skip the install step (assume deps already present)"],
        ["vis ci build --parallel=6", "Increase concurrency"],
    ],
    execute: async ({ argument, logger, options, runtime, visConfig, workspaceRoot: wsRoot }) => {
        const rawTargets = argument[0];

        if (!rawTargets) {
            throw new Error("Missing targets. Usage: vis ci <target>[,<target>…]");
        }

        const targets = rawTargets
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);

        if (targets.length === 0) {
            throw new Error("Missing targets. Usage: vis ci <target>[,<target>…]");
        }

        if (!wsRoot) {
            throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
        }

        const { base: defaultBase, head: defaultHead } = detectCiRefs();
        const base = (options.base as string | undefined) ?? defaultBase;
        const head = (options.head as string | undefined) ?? defaultHead;

        // Pre-flight: install pinned tools before anything else, so the
        // dependency install + every affected target runs against the
        // workspace's pinned Node/pnpm/etc rather than whatever the CI
        // image happened to provision.
        if (!options.skipToolchain) {
            logger.info("▸ Toolchain pre-flight");

            const result = await ensureToolchain(wsRoot, visConfig?.toolchain, {
                error: (message) => logger.error(message),
                info: (message) => logger.info(message),
                warn: (message) => logger.warn(message),
            });

            for (const failure of result.failed) {
                logger.warn(`toolchain: ${failure.spec.tool} ${failure.spec.version} — ${failure.error}`);
            }
        }

        if (options.install === false) {
            logger.info("▸ Skipping install (--no-install)");
        } else {
            logger.info("▸ Installing dependencies");

            await runtime.runCommand("install", {
                argv: ["--frozen-lockfile"],
            });
        }

        for (const target of targets) {
            logger.info(`▸ Running affected ${target} (base=${base}, head=${head})`);

            const argv: string[] = [
                target,
                `--base=${base}`,
                `--head=${head}`,
                `--upstream=${String(options.upstream ?? "none")}`,
                `--downstream=${String(options.downstream ?? "deep")}`,
            ];

            if (options.parallel !== undefined) {
                argv.push(`--parallel=${String(options.parallel)}`);
            }

            if (options.partition) {
                argv.push(`--partition=${String(options.partition)}`);
            }

            if (options.query) {
                argv.push(`--query=${String(options.query)}`);
            }

            await runtime.runCommand("affected", { argv });
        }

        logger.info("▸ CI pipeline complete");
    },
    group: "Run & Execute",
    name: "ci",
    options: [
        {
            defaultValue: true,
            description: "Install dependencies before running targets (use --no-install to skip)",
            name: "install",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Skip the toolchain pre-flight (no auto-install on engines.node mismatch)",
            name: "skip-toolchain",
            type: Boolean,
        },
        {
            description: "Git base ref for affected detection (default: auto-detected from CI env)",
            name: "base",
            type: String,
        },
        {
            description: "Git head ref for affected detection (default: HEAD)",
            name: "head",
            type: String,
        },
        {
            defaultValue: "none",
            description: "Upstream scope: none | direct | deep",
            name: "upstream",
            type: String,
        },
        {
            defaultValue: "deep",
            description: "Downstream scope: none | direct | deep",
            name: "downstream",
            type: String,
        },
        {
            defaultValue: 4,
            description: "Maximum number of parallel tasks per target",
            name: "parallel",
            type: Number,
        },
        {
            description: 'Partition tasks for distributed CI (e.g., "1/4")',
            name: "partition",
            type: String,
        },
        {
            description: "Filter affected projects by a query (e.g. 'language=typescript && tag=lib')",
            name: "query",
            type: String,
        },
    ],
};

export default ci;
