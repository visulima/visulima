// eslint-disable-next-line unicorn/prefer-module,import/no-extraneous-dependencies
const { Command } = require("commander");
// eslint-disable-next-line unicorn/prefer-module
const { exit } = require("node:process");
// eslint-disable-next-line unicorn/prefer-module,import/no-unresolved
const { initCommand, generateCommand } = require("@visulima/jsdoc-open-api/cli/commander");

// eslint-disable-next-line unicorn/prefer-module
const { listCommand } = require("../dist/framework/cli/commander");

// eslint-disable-next-line unicorn/prefer-module,no-underscore-dangle
const package_ = require("../package.json");

const program = new Command();

program.name("@visulima/api-platform").description("CLI for the visulima api-platform").version(package_.version);

listCommand(program, "framework:list");

initCommand(program, "swagger:init");
generateCommand(program, "swagger:generate");

// eslint-disable-next-line no-undef
program.parse(process.argv);

// eslint-disable-next-line no-undef
if (process.argv.slice(2).length === 0) {
    program.help();
    exit(1);
}
