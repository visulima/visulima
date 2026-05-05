import { Box, Spinner, Text, useWindowSize } from "@visulima/tui";
import React from "react";

export interface CheckProgressProps {
    readonly current: number;
    readonly total: number;
}

const CheckProgressApp = ({ current, total }: CheckProgressProps): React.ReactElement => {
    const { columns: termColumns } = useWindowSize();
    const cols = termColumns || 80;
    const percent = total > 0 ? Math.min(1, current / total) : 0;
    const pctText = `${String(Math.round(percent * 100)).padStart(3)}%`;
    const counter = `${String(current)}/${String(total)}`;

    // Reserve: 2 padding + 5 char percent + 1 separator
    const barWidth = Math.max(10, cols - 2 - pctText.length - 1);
    const filled = Math.round(barWidth * percent);
    const empty = barWidth - filled;

    return (
        <Box flexDirection="column" paddingX={1}>
            <Box>
                <Spinner type="dots" />
                <Text> Checking catalog dependencies </Text>
                <Text dimColor>{counter}</Text>
            </Box>
            <Box>
                <Text color="cyan">{"━".repeat(filled)}</Text>
                <Text dimColor>{"─".repeat(empty)}</Text>
                <Text dimColor>
{" "}
{pctText}
                </Text>
            </Box>
        </Box>
    );
};

export default CheckProgressApp;
