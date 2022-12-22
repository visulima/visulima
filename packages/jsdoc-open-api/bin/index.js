#!/usr/bin/env node
// eslint-disable-next-line unicorn/prefer-module
const { exit } = require("node:process");
// eslint-disable-next-line unicorn/prefer-module,import/no-extraneous-dependencies
const { Command } = require("commander");

// eslint-disable-next-line unicorn/prefer-module
const { initCommand, generateCommand } = require("../dist/cli/commander");

// eslint-disable-next-line unicorn/prefer-module,no-underscore-dangle
const package_ = require("../package.json");

const program = new Command();

program.name("@visulima/jsdoc-open-api").description("CLI to generate OpenAPI (Swagger) documentation from JSDoc's").version(package_.version);

initCommand(program);
generateCommand(program);

// eslint-disable-next-line no-undef
program.parse(process.argv);

// eslint-disable-next-line no-undef
if (process.argv.slice(2).length === 0) {
    program.help();
    exit(1);
}
