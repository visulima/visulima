#!/usr/bin/env node

const { exit } = require("node:process");
// eslint-disable-next-line import/no-extraneous-dependencies
const { Command } = require("commander");

const { generateCommand, initCommand } = require("../dist/cli/commander");

// eslint-disable-next-line no-underscore-dangle
const package_ = require("../package.json");

const program = new Command();

program.name("@visulima/jsdoc-open-api").description("CLI to generate OpenAPI (Swagger) documentation from JSDoc's").version(package_.version);

initCommand(program);
generateCommand(program);

program.parse(process.argv);

if (process.argv.slice(2).length === 0) {
    program.help();
    exit(1);
}
