#!/usr/bin/env node

import { exit, stderr } from "node:process";

import { run } from "./cli";

run().catch((error: unknown) => {
    stderr.write(`\nvis: ${error instanceof Error ? error.message : String(error)}\n`);
    exit(1);
});
