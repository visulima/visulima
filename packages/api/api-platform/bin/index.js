#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- CJS launcher loads the built dist via require() */

const { exit } = require("node:process");

const { Command } = require("commander");

const { generateCommand, initCommand } = require("@visulima/jsdoc-open-api/cli/commander");

const { listCommand } = require("../dist/framework/cli/index.cjs");

// eslint-disable-next-line no-underscore-dangle
const package_ = require("../package.json");

const program = new Command();

program.name("@visulima/api-platform").description("CLI for the visulima api-platform").version(package_.version);

listCommand(program, "framework:list");

initCommand(program, "swagger:init");
generateCommand(program, "swagger:generate");

program.parse(process.argv);

if (process.argv.slice(2).length === 0) {
    program.help();
    exit(1);
}
