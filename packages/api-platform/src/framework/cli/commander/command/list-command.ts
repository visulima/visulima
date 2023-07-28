import type { Command } from "commander";
import { exit } from "node:process";

import command from "../../command/list/list-command";

const listCommand = (
    program: Command,
    commandName = "list",
    description = "List all available API routes; Supported frameworks are next, express, koa, hapi and fastify",
): void => {
    program
        .command(commandName)
        .description(description)
        .option("--framework <framework>", "Framework to use, choose from next, express, koa, hapi and fastify")
        .option("-p, --path [path]", "...")
        .option("--group [type]", "Groups routes. Supported: path, tag")
        .option("--include-path [path]", "Includes only routes which contain a given path element. (comma-separated values)", [])
        .option("--exclude-path [path]", "Excludes routes which contain a given path element. (comma-separated values)", [])
        .option("-v, --verbose", "Verbose output.", false)
        .action(async (options) => {
            try {
                await command(options.framework as "express" | "fastify" | "hapi" | "koa" | "next", options.path as string, {
                    excludePaths: options.excludePaths as string[] | undefined,
                    group: options.group as string | undefined,
                    includePaths: options.includePath as string[] | undefined,
                    verbose: options.verbose as boolean | undefined,
                });
            } catch (error: any) {
                // eslint-disable-next-line no-console
                console.log();
                // eslint-disable-next-line no-console
                console.error(error);
                exit(1);
            }
        });
};

export default listCommand;
