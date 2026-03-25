import { createCerebro } from "@visulima/cerebro";
import { findMonorepoRootSync } from "@visulima/package";

import pkg from "../package.json";
import affectedCommand from "./commands/affected";
import checkCommand from "./commands/check";
import graphCommand from "./commands/graph";
import hookCommand from "./commands/hook";
import runCommand from "./commands/run";
import updateCommand from "./commands/update";
import { loadVisConfig } from "./config";

/**
 * Attempts to load and enable V8 compile cache for better performance.
 * Falls back to v8-compile-cache module if Node.js native compile cache is not available.
 */
try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports,global-require
    if (!require("node:module")?.enableCompileCache?.()) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports,global-require
        require("v8-compile-cache");
    }
} catch {
    // We don't have/need to care about v8-compile-cache failed
}

const cli = createCerebro("vis", {
    packageName: "vis",
    packageVersion: pkg.version,
});

// Load config once and inject into every command's toolbox
cli.addPlugin({
    /* eslint-disable no-param-reassign -- cerebro plugin pattern requires mutating toolbox */
    beforeCommand: async (toolbox) => {
        try {
            const workspaceRoot = findMonorepoRootSync(process.cwd()).path;

            toolbox.workspaceRoot = workspaceRoot;
            toolbox.visConfig = await loadVisConfig(workspaceRoot);
        } catch (error: unknown) {
            // findMonorepoRootSync failing is expected (e.g., running --help outside a workspace)
            if (error instanceof Error && !error.message.includes("monorepo root")) {
                toolbox.logger.warn(`Failed to load vis config: ${error.message}`);
            }

            toolbox.visConfig = {};
        }
    },
    /* eslint-enable no-param-reassign */
    name: "config-loader",
});

cli.addCommand(runCommand);
cli.addCommand(graphCommand);
cli.addCommand(affectedCommand);
cli.addCommand(hookCommand);
cli.addCommand(updateCommand);
cli.addCommand(checkCommand);

await cli.run();
