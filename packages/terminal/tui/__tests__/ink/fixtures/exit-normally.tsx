import React from "react";

import { render, Text } from "../../../src/ink/index";

const { waitUntilExit } = render(<Text>Hello World</Text>);

await waitUntilExit();
console.log("exited");
