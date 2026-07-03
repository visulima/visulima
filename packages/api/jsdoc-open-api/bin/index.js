#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { argv, exit } from "node:process";
import { fileURLToPath } from "node:url";

// eslint-disable-next-line import/no-extraneous-dependencies -- commander is an optional CLI dependency; the bin only runs when a consumer has installed it
import { Command } from "commander";

// eslint-disable-next-line antfu/no-import-dist -- bin entry point loads the built ESM dist after build
import { generateCommand, initCommand } from "../dist/cli/commander/index.js";

const { version } = JSON.parse(readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"));

const program = new Command();

program.name("@visulima/jsdoc-open-api").description("CLI to generate OpenAPI (Swagger) documentation from JSDoc's").version(version);

initCommand(program);
generateCommand(program);

program.parse(argv);

if (argv.slice(2).length === 0) {
    program.help();
    exit(1);
}
