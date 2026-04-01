import { Box, Text } from "@visulima/tui";

interface QuitDialogProps {
    countdown: number;
}

/**
 * Content for the quit confirmation dialog.
 * Rendered inside a Dialog component by VisTaskRunnerApp.
 */
const QuitDialog = ({ countdown }: QuitDialogProps): React.JSX.Element => {
    return (
        <Box flexDirection="column">
            {/* Header */}
            <Box gap={1}>
                <Text bold inverse color="cyan">{" VIS "}</Text>
                <Text bold color="cyan">Exiting in {countdown}...</Text>
            </Box>

            <Box marginTop={1} marginBottom={1}>
                <Text color="cyan" dimColor>{"\u2500".repeat(54)}</Text>
            </Box>

            <Box>
                <Text color="cyan">{" \u2022 "}</Text>
                <Text>
                    {"Press "}
                    <Text bold color="cyan">{" q "}</Text>
                    {" to exit or "}
                    <Text bold color="cyan">{" any key "}</Text>
                    {" to stay"}
                </Text>
            </Box>
            <Box paddingLeft={3}>
                <Text>and explore the results interactively.</Text>
            </Box>

            <Box marginTop={1} />

            <Box>
                <Text color="cyan">{" \u2022 "}</Text>
                <Text>Configure the TUI in the docs:</Text>
            </Box>
            <Box paddingLeft={3} marginTop={1}>
                <Text color="cyan" bold underline>https://visulima.com/packages/vis</Text>
            </Box>
        </Box>
    );
};

export default QuitDialog;
