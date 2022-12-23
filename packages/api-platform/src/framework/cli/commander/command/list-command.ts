// eslint-disable-next-line import/no-extraneous-dependencies
import { Command } from "commander";
import { exit } from "node:process";

import command from "../../command/list/list-command";

const listCommand = (
    program: Command,
    commandName: string = "list",
    description: string = "List all available API routes; Supported frameworks are next, express, koa, hapi and fastify",
) => {
    program
        .command(commandName)
        .description(description)
        .option("--framework <framework>", "Framework to use, choose from next, express, koa, hapi and fastify")
        .option("-p, --path [path]", "...")
        .option("--group [type]", "Groups routes. Supported: path, tag")
        .option("--include-path [path]", "Includes only routes which contain a given path element. (comma-separated values)", [])
        .option("--exclude-path [path]", "Excludes routes which contain a given path element. (comma-separated values)", [])
        .option("-v, --verbose", "Verbose output.", false)
        .action((options) => {
            try {
                command(options.framework as "express" | "koa" | "hapi" | "fastify" | "next", options.path, {
                    verbose: options.verbose as boolean | undefined,
                    group: options.group as string | undefined,
                    includePaths: options.includePath as string[] | undefined,
                    excludePaths: options.excludePaths as string[] | undefined,
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
