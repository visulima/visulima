import React from "react";

import { Text } from "../../../src/components/index";
import { useStdin } from "../../../src/ink/hooks/use-stdin";
import { render } from "../../../src/ink/index";

const App = () => {
    const { isRawModeSupported } = useStdin();

    return <Text>{isRawModeSupported ? "ready" : "ready-stdin-not-tty"}</Text>;
};

const { waitUntilExit } = render(<App />);

await waitUntilExit();
console.log("exited");
