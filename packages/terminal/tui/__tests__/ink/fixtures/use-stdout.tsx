import React, { useEffect } from "react";

import { Text } from "../../../src/components/index";
import { useStdout } from "../../../src/ink/hooks/use-stdout";
import { render } from "../../../src/ink/index";

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
