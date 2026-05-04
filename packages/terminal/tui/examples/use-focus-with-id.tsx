/* eslint-disable @typescript-eslint/no-use-before-define, jsdoc/lines-before-block */
/**
 * use-focus-with-id example — port of the Ink use-focus-with-id example
 * Press 1/2/3 to focus by ID, Tab/Shift+Tab to cycle, Esc to quit.
 * Run: node --import @oxc-node/core/register examples/use-focus-with-id.tsx
 */
import { Box, Text } from "@visulima/tui";
import { render, useApp, useFocus, useFocusManager, useInput } from "@visulima/tui/react";
import React from "react";

const FocusWithId = () => {
    const { focus } = useFocusManager();
    const { exit } = useApp();

    useInput((input, key) => {
        if (input === "1") {
            focus("1");
        }

        if (input === "2") {
            focus("2");
        }

        if (input === "3") {
            focus("3");
        }

        if (key.escape) {
            exit();
        }
    });

    return (
        <Box flexDirection="column" padding={1}>
            <Box marginBottom={1}>
                <Text>Press 1/2/3 to focus by ID, Tab/Shift+Tab to cycle, Esc to quit.</Text>
            </Box>
            <Item id="1" label="Press 1 to focus" />
            <Item id="2" label="Press 2 to focus" />
            <Item id="3" label="Press 3 to focus" />
        </Box>
    );
};

const Item = ({ id, label }: { id: string; label: string }) => {
    const { isFocused } = useFocus({ id });

    return (
        <Text>
            {label}
{" "}
{isFocused ? <Text color="green">(focused)</Text> : ""}
        </Text>
    );
};

render(<FocusWithId />);
