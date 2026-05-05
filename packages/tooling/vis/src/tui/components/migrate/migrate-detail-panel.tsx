import type { ScrollViewRef } from "@visulima/tui";
import { Box, ScrollView, Text } from "@visulima/tui";
import React from "react";

import type { MigrateItem } from "./migrate-store";

interface MigrateDetailPanelProps {
    focused: boolean;
    item: MigrateItem | null;
    scrollRef?: React.RefObject<ScrollViewRef | null>;
}

const colorForPreviewLine = (line: string): string | undefined => {
    if (line.startsWith("⚠")) {
        return "yellow";
    }

    if (line.startsWith("── ") || line.startsWith("[dry-run]")) {
        return undefined;
    }

    return undefined;
};

const MigrateDetailPanel = ({ focused, item, scrollRef }: MigrateDetailPanelProps): React.JSX.Element => {
    const borderColor = focused ? "white" : "gray";

    if (!item) {
        return (
            <Box alignItems="center" borderColor="gray" borderStyle="single" flexDirection="column" flexGrow={1} justifyContent="center">
                <Text dimColor>No migration selected</Text>
            </Box>
        );
    }

    return (
        <Box borderColor={borderColor} borderStyle="single" flexDirection="column" flexGrow={1}>
            <Box flexShrink={0} paddingTop={1} paddingX={2}>
                <Text bold color="white">
                    {item.entry.title}
                </Text>
            </Box>

            <Box flexShrink={0} paddingBottom={1} paddingX={2}>
                <Text dimColor>{item.entry.description}</Text>
            </Box>

            <ScrollView flexGrow={1} flexShrink={1} paddingX={2} ref={scrollRef} scrollbar scrollbarColor="gray" scrollbarStyle="block">
                <Box flexDirection="column">
                    <Text dimColor>── What will change ──</Text>
                    <Text />
                    {item.preview.length === 0 && <Text dimColor>(no preview available)</Text>}
                    {item.preview.map((line, index) => {
                        const color = colorForPreviewLine(line);

                        // Preserve blank spacer lines in the preview.
                        if (line === "") {
                            return <Text key={`blank-${String(index)}`} />;
                        }

                        return (
                            <Text color={color} key={`${String(index)}-${line.slice(0, 20)}`}>
                                {line}
                            </Text>
                        );
                    })}
                </Box>
            </ScrollView>
        </Box>
    );
};

export default MigrateDetailPanel;
