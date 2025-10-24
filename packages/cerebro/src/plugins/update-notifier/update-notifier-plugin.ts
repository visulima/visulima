import { boxen } from "@visulima/boxen";
import { dim, green, reset, yellow } from "@visulima/colorize";
// eslint-disable-next-line import/no-extraneous-dependencies
import { isCI } from "ci-info";

import type { Plugin } from "../../@types/plugin";
import type { UpdateNotifierOptions } from "./has-new-version";

export type UpdateNotifierPluginOptions = Partial<Omit<UpdateNotifierOptions, "debug | pkg">>;

/**
 * Create an update notifier plugin that checks for package updates
 * @param options Update notifier configuration options
 * @returns Plugin instance
 */
export const updateNotifierPlugin = (options: UpdateNotifierPluginOptions = {}): Plugin => {
    return {
        beforeCommand: async (toolbox) => {
            const { logger, runtime } = toolbox;
            const packageName = runtime.getPackageName();
            const packageVersion = runtime.getPackageVersion();

            if (!packageName || !packageVersion) {
                logger.debug("Update notifier: package name or version not provided, skipping...");

                return;
            }

            const updateNotifierOptions: UpdateNotifierOptions = {
                alwaysRun: false,
                debug: process.env.CEREBRO_OUTPUT_LEVEL === "256",
                distTag: "latest",
                pkg: {
                    name: packageName,
                    version: packageVersion,
                },
                updateCheckInterval: 1000 * 60 * 60 * 24,
                ...options,
            };

            const shouldCheck
                = updateNotifierOptions.alwaysRun
                    || !(process.env.NO_UPDATE_NOTIFIER || process.env.NODE_ENV === "test" || toolbox.argv.includes("--no-update-notifier") || isCI);

            if (!shouldCheck) {
                logger.debug("Update notifier: skipping check (disabled by environment or flags)");

                return;
            }

            logger.raw("Checking for updates...");

            try {
                const hasNewVersion = await import("../update-notifier/has-new-version").then((m) => m.default);
                const updateAvailable = await hasNewVersion(updateNotifierOptions);

                if (updateAvailable) {
                    const template = `Update available ${dim(packageVersion.toString())}${reset(" → ")}${green(updateAvailable)}`;

                    logger.error(
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
                logger.debug("Update notifier: failed to check for updates", error as Error);
            }
        },
        description: "Checks for package updates and notifies users",
        name: "update-notifier",

        version: "1.0.0",
    };
};
