import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { dim } from "@visulima/colorize";
import { join } from "@visulima/path";

import type { IgnoreTarget } from "../../util/ignore-file";
import { buildIgnorePatterns, IGNORE_FILENAMES, mergeIgnore } from "../../util/ignore-file";
import type { IgnoreOptions } from "./index";

const isIgnoreTarget = (value: string): value is IgnoreTarget => value === "docker" || value === "npm" || value === "slug" || value === "vercel";

const readExisting = async (fs: Toolbox["fs"], path: string): Promise<string> => {
    try {
        return await fs.readFile(path, "utf8");
    } catch {
        return "";
    }
};

/** `vis ignore` — generate/merge a build/publish ignore file (no duplicate entries). */
const execute: CommandExecute<Toolbox<Console, IgnoreOptions>> = async ({ fs, logger, options, process: runtimeProcess, workspaceRoot }) => {
    const cwd = workspaceRoot ?? runtimeProcess.cwd;
    const target = options.target ?? "docker";

    if (!isIgnoreTarget(target)) {
        throw new Error(`Invalid --target "${target}". Expected one of: docker, vercel, npm, slug.`);
    }

    const filename = IGNORE_FILENAMES[target];
    const path = join(cwd, filename);
    const existing = await readExisting(fs, path);
    const { added, content } = mergeIgnore(existing, buildIgnorePatterns(target));

    if (options.json) {
        process.stdout.write(`${JSON.stringify({ added, file: filename, target }, null, 2)}\n`);

        return;
    }

    if (options.write) {
        if (added.length === 0) {
            logger.info(`${filename} is already up to date (no new patterns).`);

            return;
        }

        await fs.writeFile(path, content);
        logger.info(`Added ${added.length} pattern(s) to ${filename}.`);

        return;
    }

    process.stdout.write(content.endsWith("\n") ? content : `${content}\n`);
    logger.info(dim(`(${added.length} new pattern(s); re-run with --write to save ${filename})`));
};

export default execute as CommandExecute<Toolbox>;
