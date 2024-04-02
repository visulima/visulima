import { bold, cyan, gray } from "@visulima/colorize";
import { collectSync } from "@visulima/fs";
import { join } from "pathe";
import { minVersion } from "semver";

import type { Options as EsbuildOptions } from "../builder/rollup/plugins/esbuild/types";
import logger from "../logger";
import type { BuildPreset } from "../types";
import arrayify from "../utils/arrayify";
import inferEntries from "./utils/infer-entries";

const autoPreset: BuildPreset = {
    hooks: {
        "build:prepare": function (context) {
            // Disable auto if entries already provided of pkg not available
            if (!context.pkg || context.options.entries.length > 0) {
                return;
            }

            const sourceFiles = collectSync(join(context.options.rootDir, "src"), { includeDirs: false, includeSymlinks: false });

            const result = inferEntries(context.pkg, sourceFiles, context.options.rootDir);

            // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
            for (const message of result.warnings) {
                logger.warn(context, message);
            }

            context.options.entries.push(...result.entries);

            if (result.cjs) {
                context.options.rollup.emitCJS = true;
            }
            if (result.dts) {
                context.options.declaration = result.dts;
            }

            logger.info(
                "Automatically detected entries:",
                cyan(context.options.entries.map((e) => bold(e.input.replace(`${context.options.rootDir}/`, "").replace(/\/$/, "/*"))).join(", ")),
                gray(
                    ["esm", result.cjs && "cjs", result.dts && "dts"]
                        .filter(Boolean)
                        .map((tag) => `[${tag}]`)
                        .join(" "),
                ),
            );

            const esbuildTarget = arrayify<string>((context.options.rollup.esbuild as EsbuildOptions).target ?? []);

            if (!esbuildTarget.some((target) => target.startsWith("node")) && context.pkg.engines?.node) {
                const nodeTarget = minVersion(context.pkg.engines.node);

                if (nodeTarget) {
                    (context.options.rollup.esbuild as EsbuildOptions).target = [`node${nodeTarget.major}`, ...esbuildTarget];

                    logger.info("Automatically detected node target:", cyan(nodeTarget.version));
                }
            }
        },
    },
};

export default autoPreset;
