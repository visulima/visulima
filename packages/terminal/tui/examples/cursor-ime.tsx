import { getStringWidth as stringWidth } from "@visulima/string";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { render, useCursor, useInput } from "@visulima/tui/react";
import React, { useState } from "react";

const App = () => {
    const [text, setText] = useState("");
    const { setCursorPosition } = useCursor();

    useInput((input, key) => {
        if (key.backspace || key.delete) {
            setText((previous) => previous.slice(0, -1));

            return;
        }

        if (!key.ctrl && !key.meta && input) {
            setText((previous) => previous + input);
        }
    });

    // Use stringWidth for correct cursor position with wide characters (Korean, CJK, emoji)
    const prompt = "> ";

    setCursorPosition({ x: stringWidth(prompt + text), y: 1 });

    return (
        <Box flexDirection="column">
            <Text>Type Korean (Ctrl+C to exit):</Text>
            <Text>
                {prompt}
                {text}
            </Text>
        </Box>
    );
};

render(<App />);
