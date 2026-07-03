import { Box } from "@visulima/tui/components/box";
import type { ScrollViewRef } from "@visulima/tui/components/scroll-view";
import { ScrollView } from "@visulima/tui/components/scroll-view";
import { Text } from "@visulima/tui/components/text";
import React from "react";

interface PreviewPanelProps {
    readonly focused: boolean;
    readonly hadComments: boolean;
    readonly jsonPreview: string;
    readonly mode: "create" | "edit";
    readonly scrollRef: React.RefObject<ScrollViewRef | null>;
}

const PreviewPanel = ({ focused, hadComments, jsonPreview, mode, scrollRef }: PreviewPanelProps): React.JSX.Element => (
    <Box borderColor={focused ? "cyan" : "gray"} borderStyle="single" flexDirection="column" flexGrow={1}>
        <Box flexShrink={0} paddingX={1}>
            <Text bold color={focused ? "cyan" : "white"}>
                Preview
            </Text>
            <Text dimColor>
{" "}
(
{mode === "create" ? "new" : "edit"}
)
            </Text>
        </Box>
        {hadComments && mode === "edit" && (
            <Box flexShrink={0} paddingX={1}>
                <Text color="yellow">Comments will not be preserved.</Text>
            </Box>
        )}
        <ScrollView flexGrow={1} ref={scrollRef} scrollbar scrollbarColor="gray">
            {jsonPreview.split("\n").map((line, index) => (
                <Text color="green" key={`line-${String(index)}`}>
                    {line}
                </Text>
            ))}
        </ScrollView>
    </Box>
);

export default PreviewPanel;
