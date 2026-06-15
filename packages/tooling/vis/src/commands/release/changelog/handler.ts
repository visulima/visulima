/**
 * `vis release changelog` — read-only render of the pending plan's
 * changelog entries. Useful for previewing GH-formatter output, or
 * piping rendered Markdown to `gh release create --notes-file -`.
 */

import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { releaseChangelog } from "../../../release/api";
import type { ReleaseChangelogOptions } from "./index";

const execute = async ({ logger, options, workspaceRoot }: Toolbox<Console, ReleaseChangelogOptions>): Promise<void> => {
    const cwd = workspaceRoot ?? process.cwd();
    const projects = options.filter ? options.filter.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

    const result = await releaseChangelog({
        channel: options.channel,
        cwd,
        projects,
    });

    if (options.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

        if (result.projectChangelogs.length === 0) {
            process.exitCode = 1;
        }

        return;
    }

    if (result.projectChangelogs.length === 0) {
        logger.info("No pending releases — no changelog entries to render.");
        process.exitCode = 1;

        return;
    }

    for (const entry of result.projectChangelogs) {
        logger.info(`# ${entry.package} → ${entry.file}`);
        logger.info("");
        logger.info(entry.content);
        logger.info("");
    }
};

export default execute as CommandExecute<Toolbox>;
