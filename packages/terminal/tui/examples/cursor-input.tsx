import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Cursor } from "@visulima/tui/components/cursor";
import { Text } from "@visulima/tui/components/text";
import { useInput } from "@visulima/tui/hooks/use-input";
import React, { useState } from "react";

const CursorTextInputExample = () => {
    const [value, setValue] = useState("");
    const prompt = "> ";

    useInput((input, key) => {
        if (key.escape) {
            setValue("");

            return;
        }

        if (key.backspace || key.delete) {
            setValue((previousValue) => previousValue.slice(0, -1));

            return;
        }

        if (!key.ctrl && !key.meta && !key.return && input && !input.includes("\n") && !input.includes("\r")) {
            setValue((previousValue) => previousValue + input);
        }
    });

    return (
        <Box flexDirection="column">
            <Text>Simple text input with declarative cursor (Esc clears, Ctrl+C exits)</Text>
            <Box flexDirection="row">
                <Text>{prompt}</Text>
                <Text>{value}</Text>
                <Cursor />
            </Box>
        </Box>
    );
};

render(<CursorTextInputExample />);
