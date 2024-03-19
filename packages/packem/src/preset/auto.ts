import { bold, cyan, gray } from "@visulima/colorize";
import { collectSync } from "@visulima/fs";
import { join } from "pathe";

import logger from "../logger";
import type { BuildPreset } from "../types";
import inferEntries from "./utils/infer-entries";

export const autoPreset: BuildPreset = {
    hooks: {
        "build:prepare": function (context) {
            // Disable auto if entries already provided of pkg not available
            if (!context.pkg || context.options.entries.length > 0) {
                return;
            }

            const sourceFiles = collectSync(join(context.options.rootDir, "src"), { includeDirs: false, includeSymlinks: false });

            const res = inferEntries(context.pkg, sourceFiles, context.options.rootDir);

            for (const message of res.warnings) {
                logger.warn(context, message);
            }

            context.options.entries.push(...res.entries);

            if (res.cjs) {
                context.options.rollup.emitCJS = true;
            }
            if (res.dts) {
                context.options.declaration = res.dts;
            }

            logger.info(
                "Automatically detected entries:",
                cyan(context.options.entries.map((e) => bold(e.input.replace(`${context.options.rootDir}/`, "").replace(/\/$/, "/*"))).join(", ")),
                gray(
                    ["esm", res.cjs && "cjs", res.dts && "dts"]
                        .filter(Boolean)
                        .map((tag) => `[${tag}]`)
                        .join(" "),
                ),
            );
        },
    },
};
