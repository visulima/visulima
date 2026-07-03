// eslint-disable-next-line import/no-extraneous-dependencies
import { isCI } from "ci-info";

import type { Plugin } from "../../types/plugin";
import { getEnv } from "../../util/general/runtime-process";
import type { UpdateNotifierOptions } from "./has-new-version";

type UpdateNotifierPluginOptions = Partial<Omit<UpdateNotifierOptions, "debug" | "fs" | "pkg">>;

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Create an update notifier plugin that checks for package updates.
 * @param options Update notifier configuration options.
 * @returns Plugin instance.
 */
const updateNotifierPlugin = (options: UpdateNotifierPluginOptions = {}): Plugin => {
    return {
        beforeCommand: async (toolbox) => {
            const { fs, logger, runtime } = toolbox;
            const packageName = runtime.getPackageName();
            const packageVersion = runtime.getPackageVersion();

            if (!packageName || !packageVersion) {
                logger.debug("Update notifier: package name or version not provided, skipping...");

                return;
            }

            const env = getEnv();

            const updateNotifierOptions: UpdateNotifierOptions = {
                alwaysRun: false,
                debug: env.CEREBRO_OUTPUT_LEVEL === "256",
                distTag: "latest",
                // Consume the injectable filesystem adapter so the update cache
                // works under MCP / sandboxed runtimes instead of reaching for
                // sync `node:fs` directly.
                fs,
                pkg: {
                    name: packageName,
                    version: packageVersion,
                },
                timeout: DEFAULT_TIMEOUT_MS,
                updateCheckInterval: 1000 * 60 * 60 * 24,
                ...options,
            };

            const shouldCheck
                = Boolean(updateNotifierOptions.alwaysRun)
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- intentional boolean coercion for truthy check
                    || !(env.NO_UPDATE_NOTIFIER || env.NODE_ENV === "test" || toolbox.argv.includes("--no-update-notifier") || isCI);

            if (!shouldCheck) {
                logger.debug("Update notifier: skipping check (disabled by environment or flags)");

                return;
            }

            // No more "Checking for updates..." noise on every run — that
            // polluted scriptable stdout. The request is timeout-bounded (see
            // get-distribution-version) so it can't hang the command, and the
            // result box now goes to logger.log (not logger.error) so it isn't
            // mistaken for a failure or captured by stderr-only consumers.
            try {
                const hasNewVersion = await import("./has-new-version").then((m) => m.default);
                const updateAvailable = await hasNewVersion(updateNotifierOptions);

                if (updateAvailable) {
                    // Lazy load heavy dependencies only when update is available
                    const [{ boxen }, { dim, green, reset, yellow }] = await Promise.all([import("@visulima/boxen"), import("@visulima/colorize")]);

                    const template = `Update available ${dim(packageVersion)}${reset(" → ")}${green(updateAvailable)}`;

                    logger.log(
                        boxen(template, {
                            borderColor: (border: string) => yellow(border),
                            borderStyle: "round",
                            margin: 1,
                            padding: 1,
                            textAlignment: "center",
                        }),
                    );
                }
            } catch (error) {
                logger.debug("Update notifier: failed to check for updates", error);
            }
        },
        description: "Checks for package updates and notifies users",
        name: "update-notifier",
        version: "1.0.0",
    };
};

export type { UpdateNotifierPluginOptions };
export { updateNotifierPlugin };
