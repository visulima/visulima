// The full `vis` CLI: cerebro construction, all 60+ command registrations, and
// the plugin lifecycle. Split out of `bin.ts` so the entry can stay a thin
// dispatcher — lightweight commands (notably `vis x`) skip importing this whole
// module graph (the dominant ~180ms of vis's cold-start). Only the heavy,
// orchestration path loads it, via a dynamic import in `bin.ts`.
import { createCerebro } from "@visulima/cerebro";
import { errorHandlerPlugin } from "@visulima/cerebro/plugins/error-handler";
import { readJsonSync } from "@visulima/fs";
import { findMonorepoRootSync } from "@visulima/package";
import { join } from "@visulima/path";

import { runAndExit } from "./cli-run";
import { isBareMigrateInvocation } from "./commands/migrate/detect-bare";
import { runMigrateInteractive } from "./commands/migrate/interactive";
import { setTerminalTitle } from "./io/terminal";
import configLoaderPlugin from "./plugins/config-loader";
import postCommandPlugin from "./plugins/post-command";
import securityEnforcementPlugin from "./plugins/security-enforcement";
import registerCommands from "./register-commands";
import { parseEarlyCaCert } from "./util/ca-cert";
import getPackageVersion from "./util/package-version";
import { startUpgradeCheck } from "./util/upgrade-check";

/**
 * Construct and run the full vis CLI. Invoked from `bin.ts` for every command
 * except the lean fast-paths (e.g. `vis x`). The universal early setup that
 * must run before ANY command (heap tuning, --no-color, version env, compile
 * cache) lives in `bin.ts`; the heavier, non-fast-path setup (CA cert, monorepo
 * root discovery, the background upgrade check) lives here.
 */

export const runCli = async (): Promise<void> => {
    // Honor --ca-cert before any TLS handshake fires. NODE_EXTRA_CA_CERTS is
    // read once on the first `tls.createSecureContext` call (lazy, not at
    // require time). A user-set NODE_EXTRA_CA_CERTS takes precedence.
    const earlyCaCert = parseEarlyCaCert(process.argv);

    if (earlyCaCert !== undefined && !process.env["NODE_EXTRA_CA_CERTS"]) {
        process.env["NODE_EXTRA_CA_CERTS"] = earlyCaCert;
    }

    // Set terminal title to the project name and stash the resolved root on an
    // env var so `config-loader.ts` doesn't walk the tree a second time.
    try {
        const rootDir = findMonorepoRootSync(process.cwd()).path;

        process.env["VIS_MONOREPO_ROOT"] = rootDir;

        const rootPkg = readJsonSync(join(rootDir, "package.json")) as { name?: string };

        if (rootPkg.name) {
            setTerminalTitle(rootPkg.name);
        }
    } catch {
        // No workspace root or package.json found — skip
    }

    // Start background upgrade check immediately (non-blocking)
    const upgradeCheckCallback = startUpgradeCheck(getPackageVersion(), process.argv[2] ?? "");

    const cli = createCerebro("vis", {
        packageName: "vis",
        packageVersion: getPackageVersion(),
    });

    // Enhanced error handling
    const isDebug = process.argv.includes("--debug") || Boolean(process.env["DEBUG"]);

    cli.addPlugin(
        errorHandlerPlugin({
            detailed: isDebug,
            exitOnError: false,
        }),
    );

    // Global --cwd option available to all commands
    cli.addGlobalOption({
        description: "Override workspace root directory",
        name: "cwd",
        type: String,
    });

    // Surfaced for `--help` and consumed by `resolveRuntime`.
    cli.addGlobalOption({
        description: "Target JS runtime: node (default) or bun. Overrides VIS_RUNTIME and config; falls back to lockfile detection.",
        name: "runtime",
        type: String,
    });

    cli.addGlobalOption({
        description: "Path to a vis config file (overrides discovery)",
        name: "config",
        type: String,
    });

    // Surfaced for `vis --help`; the env-var plumbing is applied in bin.ts.
    cli.addGlobalOption({
        description: "Path to a CA bundle (PEM) to trust for HTTPS — for corporate proxies. Equivalent to NODE_EXTRA_CA_CERTS.",
        name: "ca-cert",
        type: String,
    });

    // Plugins
    cli.addPlugin(configLoaderPlugin);
    cli.addPlugin(securityEnforcementPlugin);

    registerCommands(cli);

    // Post-command: upgrade notice + tips
    cli.addPlugin(postCommandPlugin(upgradeCheckCallback));

    if (isBareMigrateInvocation(process.argv.slice(2))) {
        const { loadVisConfig } = await import("./config/config");
        const workspaceRoot = process.env["VIS_MONOREPO_ROOT"] || process.cwd();

        let visConfig: Awaited<ReturnType<typeof loadVisConfig>> | undefined;

        try {
            visConfig = await loadVisConfig(workspaceRoot);
        } catch {
            visConfig = undefined;
        }

        try {
            await runMigrateInteractive({
                logger: {
                    info: (message: string) => {
                        process.stdout.write(`${message}\n`);
                    },
                    warn: (message: string) => {
                        process.stderr.write(`${message}\n`);
                    },
                },
                visConfig,
                workspaceRoot,
            });
        } catch (error) {
            process.stderr.write(`${(error as Error).message}\n`);
            process.exitCode = 1;
        }

        return;
    }

    await runAndExit(cli);
};
