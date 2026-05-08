import React, { useEffect } from "react";

import { Static, Text } from "../../../src/components/index";
import { useApp } from "../../../src/ink/hooks/use-app";
import { render } from "../../../src/ink/index";

const Test = () => {
    const { exit } = useApp();

    useEffect(() => {
        exit(new Error("errored"));
    }, []);

    return (
        <>
            <Static items={["A", "B", "C"]}>{(item) => <Text key={item}>{item}</Text>}</Static>
            <Text>Dynamic</Text>
        </>
    );
};

const app = render(<Test />);

try {
    await app.waitUntilExit();
} catch (error: unknown) {
    console.log((error as Error).message);
}
