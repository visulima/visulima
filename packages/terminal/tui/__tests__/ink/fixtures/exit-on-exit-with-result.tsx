import React, { useEffect } from "react";

import { Text } from "../../../src/components/index";
import { useApp } from "../../../src/ink/hooks/use-app";
import { render } from "../../../src/ink/index";

const Test = () => {
    const { exit } = useApp();

    useEffect(() => {
        setTimeout(() => {
            exit("hello from ink");
        }, 500);
    });

    return <Text>Testing</Text>;
};

const app = render(<Test />);
const result = await app.waitUntilExit();

console.log(`result:${String(result)}`);
