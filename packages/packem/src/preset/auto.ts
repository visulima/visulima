import { bold, cyan, gray } from "@visulima/colorize";
import { collectSync } from "@visulima/fs";
import { join } from "pathe";
import type { NormalizedPackageJson } from "read-pkg";

import logger from "../logger";
import type { BuildPreset } from "../types";
import warn from "../utils/warn";
import inferEntries from "./utils/infer-entries";
import overwriteWithPublishConfig from "./utils/overwrite-with-publish-config";

const autoPreset: BuildPreset = {
    hooks: {
        "build:prepare": function (context) {
            // Disable auto if entries already provided of pkg not available
            if (!context.pkg || context.options.entries.length > 0) {
                return;
            }

            const sourceFiles = collectSync(join(context.options.rootDir, "src"), { extensions: [], includeDirs: false, includeSymlinks: false });

            // eslint-disable-next-line @typescript-eslint/naming-convention
            let package_ = { ...context.pkg } as NormalizedPackageJson;

            if (package_.publishConfig) {
                package_ = overwriteWithPublishConfig(package_);
            }

            const result = inferEntries(package_, sourceFiles, context.options.rootDir);

            // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
            for (const message of result.warnings) {
                warn(context, message);
            }

            context.options.entries.push(...result.entries);

            if (result.cjs) {
                context.options.rollup.emitCJS = true;
            }

            if (result.dts) {
                context.options.declaration = result.dts;
            }

            if (context.options.entries.length === 0) {
                warn(context, "No entries detected. Please provide entries manually.");
            } else {
                logger.info(
                    "Automatically detected entries:",
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                    cyan(context.options.entries.map((buildEntry) => bold(buildEntry.input.replace(`${context.options.rootDir}/`, "").replace(/\/$/, "/*"))).join(", ")),
                    gray(
                        ["esm", result.cjs && "cjs", result.dts && "dts"]
                            .filter(Boolean)
                            .map((tag) => `[${tag}]`)
                            .join(" "),
                    ),
                );
            }
        },
    },
};

export default autoPreset;
