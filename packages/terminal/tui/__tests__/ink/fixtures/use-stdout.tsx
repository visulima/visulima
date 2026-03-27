import React, { useEffect } from "react";

import { render, Text, useStdout } from "../../../src/ink/index.js";

const WriteToStdout = () => {
    const { write } = useStdout();

    useEffect(() => {
        write("Hello from Ink to stdout\n");
    }, []);

    return <Text>Hello World</Text>;
};

const app = render(<WriteToStdout />);

await app.waitUntilExit();
console.log("exited");
