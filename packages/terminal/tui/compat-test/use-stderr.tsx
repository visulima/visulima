import React from "react";
import {
    render,
    Box,
    Text,
    Static,
    Newline,
    Spacer,
    useInput,
    useApp,
    useWindowSize,
    useFocus,
    useFocusManager,
    useStdout,
    useStderr,
    useStdin,
} from "@visulima/tui/react";

function Example() {
    const { write } = useStderr();

    React.useEffect(() => {
        const timer = setInterval(() => {
            write("Hello from Ink to stderr\n");
        }, 1000);

        return () => {
            clearInterval(timer);
        };
    }, []);

    return <Text>Hello World</Text>;
}

render(<Example />);
