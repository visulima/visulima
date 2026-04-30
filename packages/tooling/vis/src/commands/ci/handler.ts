import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { runToolchainPreflight } from "../../runtime/toolchain";
import type { CiOptions } from "./index";

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

const execute = async ({ argument, logger, options, runtime, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, CiOptions>): Promise<void> => {
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
    const base = options.base ?? defaultBase;
    const head = options.head ?? defaultHead;

    // Pre-flight: install pinned tools before anything else, so the
    // dependency install + every affected target runs against the
    // workspace's pinned Node/pnpm/etc rather than whatever the CI
    // image happened to provision.
    if (!options.skipToolchain) {
        logger.info("▸ Toolchain pre-flight");
    }

    await runToolchainPreflight(
        wsRoot,
        visConfig?.toolchain,
        {
            error: (message) => { logger.error(message); },
            info: (message) => { logger.info(message); },
            warn: (message) => { logger.warn(message); },
        },
        Boolean(options.skipToolchain),
    );

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
};

export default execute as CommandExecute<Toolbox>;
