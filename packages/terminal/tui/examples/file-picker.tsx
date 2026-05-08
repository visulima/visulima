import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { FilePicker } from "@visulima/tui/components/file-picker";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import React, { useState } from "react";

const App = () => {
    const { exit } = useApp();
    const [selectedPath, setSelectedPath] = useState<string | undefined>();

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                FilePicker demo
            </Text>
            <FilePicker
                limit={15}
                onCancel={() => {
                    exit();
                }}
                onSelect={(entry) => {
                    setSelectedPath(entry.path);
                }}
                showSize
            />
            {selectedPath && (
                <Text>
                    Selected:
{" "}
                    <Text bold color="green">
                        {selectedPath}
                    </Text>
                </Text>
            )}
            <Text dimColor>↑/↓ = navigate · enter = open/select · backspace = back · esc = quit</Text>
        </Box>
    );
};

render(<App />);
