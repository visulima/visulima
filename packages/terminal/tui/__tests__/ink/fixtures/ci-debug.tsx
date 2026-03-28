/* eslint-disable vitest/require-hook -- standalone fixture script executed by node-pty, not a test file */
import React from "react";

import { render, Text } from "../../../src/ink/index";

render(<Text>Hello</Text>, { debug: true });
