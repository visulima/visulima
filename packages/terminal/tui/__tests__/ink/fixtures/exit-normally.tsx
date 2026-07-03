import React from "react";

import { Text } from "../../../src/components/index";
import { render } from "../../../src/ink/index";

const { waitUntilExit } = render(<Text>Hello World</Text>);

await waitUntilExit();
console.log("exited");
