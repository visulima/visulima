import React from "react";

import { Text } from "../../../src/components/index";
import { useAnimation } from "../../../src/ink/hooks/use-animation";
import { useApp } from "../../../src/ink/hooks/use-app";
import { render } from "../../../src/ink/index";

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
