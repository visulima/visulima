import { Box, Spinner, Text, useWindowSize } from "@visulima/tui";
import React from "react";

export interface CheckProgressProps {
    readonly current: number;
    readonly total: number;
}

export default function CheckProgressApp({ current, total }: CheckProgressProps): React.ReactElement {
    const { columns: termColumns } = useWindowSize();
    const cols = termColumns || 80;
    const percent = total > 0 ? current / total : 0;
    const pctText = `${String(Math.round(percent * 100))}%`;

    // Reserve: 2 padding + percentage text (~5)
    const barWidth = Math.max(10, cols - 4);
    const filled = Math.round(barWidth * percent);
    const empty = barWidth - filled;

    return (
        <Box flexDirection="column" paddingX={1}>
            <Box>
                <Spinner type="dots" />
                <Text>
                    {" "}
                    Checking
                    {" "}
                    {String(total)}
                    {' '}
                    catalog dependencies
                    {" "}
                </Text>
                <Text dimColor>
                    {String(current)}
                    /
                    {String(total)}
                </Text>
            </Box>
            <Box>
                <Text color="cyan">{"\u2501".repeat(filled)}</Text>
                <Text dimColor>{"\u2500".repeat(empty)}</Text>
                <Text>
                    {' '}
                    {pctText}
                </Text>
            </Box>
        </Box>
    );
}
