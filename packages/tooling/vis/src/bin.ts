#!/usr/bin/env node

import { createCerebro } from "./cli";

const cli = createCerebro();

await cli.run();
