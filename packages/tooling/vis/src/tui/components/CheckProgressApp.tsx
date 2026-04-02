import React from "react";
import { Box, ProgressBar, Spinner, Text } from "@visulima/tui";

export interface CheckProgressProps {
    readonly current: number;
    readonly total: number;
}

export default function CheckProgressApp({ current, total }: CheckProgressProps): React.ReactElement {
    const percent = total > 0 ? current / total : 0;
    const pctText = `${String(Math.round(percent * 100))}%`;

    return (
        <Box flexDirection="column">
            <Box>
                <Spinner type="dots" />
                <Text>
                    {" "}
                    Checking {String(total)} catalog dependencies…
                    <Text dimColor>
                        {" "}
                        {String(current)}/{String(total)}
                    </Text>
                </Text>
            </Box>
            <Box>
                <ProgressBar color="cyan" percent={percent} right={6} />
                <Text dimColor> {pctText}</Text>
            </Box>
        </Box>
    );
}
