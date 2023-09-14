#!/usr/bin/env node

const { exit } = require("node:process");

const { Command } = require("commander");

const { generateCommand } = require("@visulima/openapi/cli/commander");
const { listCommand } = require("../dist/framework/cli/commander");

// eslint-disable-next-line no-underscore-dangle
const package_ = require("../package.json");

const program = new Command();

program.name("@visulima/api-platform").description("CLI for the visulima api-platform").version(package_.version);

listCommand(program, "framework:list");

generateCommand(program, "openapi:generate");

program.parse(process.argv);

if (process.argv.slice(2).length === 0) {
    program.help();
    exit(1);
}
