// eslint-disable-next-line unicorn/prefer-module
const { Command } = require("commander");
// eslint-disable-next-line unicorn/prefer-module
const { exit } = require("node:process");

// eslint-disable-next-line unicorn/prefer-module
const { listCommand } = require("../dist/next/cli");

// eslint-disable-next-line unicorn/prefer-module,no-underscore-dangle
const package_ = require("../package.json");

const program = new Command();

program.name("@visulima/api-platform").description("CLI for the visulima api-platform").version(package_.version);

program
    .command("list")
    .description("List all available API routes")
    .option("-p, --path [path]", "...", "")
    .option("--group [type]", "Groups routes. Supported: path, tag")
    .option("--include-path [path]", "Includes only routes which contain a given path element. (comma-separated values)")
    .option("--exclude-path [path]", "Excludes routes which contain a given path element. (comma-separated values)")
    .option("-v, --verbose", "Verbose output.")
    .action((options) => {
        try {
            listCommand(options.path, {
                verbose: options.verbose,
                group: options.group,
                includePaths: options.includePath,
                excludePaths: options.excludePaths,
            });
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);
            exit(1);
        }
    });

// eslint-disable-next-line no-undef
program.parse(process.argv);

// eslint-disable-next-line no-undef
if (process.argv.slice(2).length === 0) {
    program.help();
    exit(1);
}
