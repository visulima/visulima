import process from "node:process";

import React from "react";

import { Text } from "../../../src/components/index";
import { render } from "../../../src/ink/index";

const app = render(<Text>Hello</Text>, { debug: true });

app.unmount();
await app.waitUntilExit();
process.stdout.write("DONE");
