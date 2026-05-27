import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Cursor } from "@visulima/tui/components/cursor";
import { Text } from "@visulima/tui/components/text";
import { useInput } from "@visulima/tui/hooks/use-input";
import React, { useState } from "react";

type Mode = "insert" | "normal";

const VimModeInput = () => {
    const [mode, setMode] = useState<Mode>("normal");
    const [value, setValue] = useState("");
    const prompt = "> ";

    useInput((input, key) => {
        if (mode === "normal") {
            if (input === "i") {
                setMode("insert");

                return;
            }

            if (input === "a") {
                setMode("insert");

                return;
            }

            if (input === "x") {
                setValue((previousValue) => previousValue.slice(0, -1));
            }

            return;
        }

        // Insert mode
        if (key.escape) {
            setMode("normal");

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
            <Text>Vim-mode input — block cursor in NORMAL, bar in INSERT.</Text>
            <Text>i/a → insert · Esc → normal · x → delete char · Ctrl+C → exit</Text>
            <Box flexDirection="row">
                <Text>[{mode === "normal" ? "N" : "I"}] </Text>
                <Text>{prompt}</Text>
                <Text>{value}</Text>
                <Cursor shape={mode === "normal" ? "block" : "bar"} />
            </Box>
        </Box>
    );
};

render(<VimModeInput />);
