/* eslint-disable vitest/require-hook -- standalone fixture script executed by node-pty, not a test file */
import process from "node:process";

import React from "react";

import { render, Text } from "../../../src/ink/index.js";

const app = render(<Text>Hello</Text>, { debug: true });

app.unmount();
await app.waitUntilExit();
process.stdout.write("DONE");
