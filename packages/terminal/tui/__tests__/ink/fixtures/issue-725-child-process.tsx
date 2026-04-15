import React from "react";

import { render, Text, useStdin } from "../../../src/ink/index";

const App = () => {
    const { isRawModeSupported } = useStdin();

    return <Text>{isRawModeSupported ? "ready" : "ready-stdin-not-tty"}</Text>;
};

const { waitUntilExit } = render(<App />);

await waitUntilExit();
console.log("exited");
