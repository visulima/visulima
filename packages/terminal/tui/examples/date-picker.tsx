/**
 * date-picker.tsx — Calendar and DatePicker
 *
 * Controls:
 *   Enter           open DatePicker
 *   ← / → / ↑ / ↓  move calendar cursor (day)
 *   PageUp / PageDown   change month
 *   Enter (inside)  commit selection
 *   Esc             quit
 *
 * Run: node --import @oxc-node/core/register examples/date-picker.tsx
 */
import { Box, Calendar, DatePicker, render, Text, useApp, useInput } from "@visulima/tui";
import React, { useState } from "react";

const App = () => {
    const { exit } = useApp();
    const [selected, setSelected] = useState<Date | undefined>();

    useInput((_input, key) => {
        if (key.escape) {
            exit();
        }
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                Calendar (standalone)
            </Text>
            <Calendar autoFocus onChange={setSelected} />
            {selected && (
                <Text dimColor>
                    cursor:
                    {selected.toDateString()}
                </Text>
            )}
            <Text bold color="cyan">
                DatePicker (collapsed until focused)
            </Text>
            <DatePicker defaultValue={new Date()} onChange={setSelected} />
        </Box>
    );
};

render(<App />);
