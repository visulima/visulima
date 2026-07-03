import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { resolveAffectedShas } from "../../runtime/affected-shas";
import { runToolchainPreflight } from "../../runtime/toolchain";
import type { CiOptions } from "./index";

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

    const resolved = resolveAffectedShas({
        defaultBase: visConfig?.defaultBase,
        workspaceRoot: wsRoot,
    });

    const base = options.base ?? resolved.base;
    const head = options.head ?? resolved.head;

    if (!options.base && !options.head) {
        logger.info(`▸ Resolved affected refs from ${resolved.provider} (${resolved.notes.join("; ")})`);
    }

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
            error: (message) => {
                logger.error(message);
            },
            info: (message) => {
                logger.info(message);
            },
            warn: (message) => {
                logger.warn(message);
            },
        },
        Boolean(options.skipToolchain),
    );

    if (options.install === false) {
        logger.info("▸ Skipping install (--no-install)");
    } else {
        logger.info("▸ Installing dependencies");

        await runtime.runCommand("install", {
            // `--ci` mirrors `npm ci`: wipes node_modules and triggers
            // CI-grade lockfile enforcement (e.g. yarn berry's
            // `--immutable-cache` on top of `--immutable`). Implies
            // `--frozen-lockfile` via the install handler, but we keep
            // the explicit flag so a future `--ci` refactor cannot
            // silently downgrade vis ci to a mutating install.
            argv: ["--ci", "--frozen-lockfile"],
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
