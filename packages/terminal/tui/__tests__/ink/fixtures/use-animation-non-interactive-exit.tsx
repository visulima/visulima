import React from "react";

import { render, Text, useAnimation, useApp } from "../../../src/ink/index";

function Spinner() {
    const { frame } = useAnimation({ interval: 8 });
    const { exit } = useApp();

    React.useEffect(() => {
        if (frame >= 3) {
            exit();
        }
    }, [exit, frame]);

    return <Text>{String(frame)}</Text>;
}

const { waitUntilExit } = render(<Spinner />);

await waitUntilExit();

console.log("exited");
