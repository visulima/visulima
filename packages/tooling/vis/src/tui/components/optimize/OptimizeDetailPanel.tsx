import type { ScrollViewRef } from "@visulima/tui";
import { Box, ScrollView, Text } from "@visulima/tui";

import { CATEGORY_COLORS, CATEGORY_DESCRIPTIONS } from "./constants";
import type { OptimizeEntry } from "./OptimizeStore";

interface OptimizeDetailPanelProps {
    entry: OptimizeEntry | null;
    focused: boolean;
    scrollRef?: React.RefObject<ScrollViewRef | null>;
}

const OptimizeDetailPanel = ({ entry, focused, scrollRef }: OptimizeDetailPanelProps): React.JSX.Element => {
    const borderColor = focused ? "white" : "gray";

    if (!entry) {
        return (
            <Box alignItems="center" borderColor="gray" borderStyle="single" flexDirection="column" flexGrow={1} justifyContent="center">
                <Text dimColor>No entry selected</Text>
            </Box>
        );
    }

    const categoryColor = CATEGORY_COLORS[entry.category] ?? "gray";

    return (
        <Box borderColor={borderColor} borderStyle="single" flexDirection="column" flexGrow={1}>
            <Box flexShrink={0} paddingTop={1} paddingX={2}>
                <Text bold color="white">
                    {entry.packageName}
                </Text>
            </Box>

            <ScrollView flexGrow={1} flexShrink={1} paddingX={2} ref={scrollRef} scrollbar scrollbarColor="gray">
                <Text />

                <Box>
                    <Box width={14}>
                        <Text dimColor>Category:</Text>
                    </Box>
                    <Text bold color={categoryColor}>
                        {entry.category}
                    </Text>
                </Box>
                <Box>
                    <Box width={14}>
                        <Text dimColor>Replace with:</Text>
                    </Box>
                    <Text>{entry.replacement}</Text>
                </Box>
                {entry.overrideSpec && (
                    <Box>
                        <Box width={14}>
                            <Text dimColor>Override:</Text>
                        </Box>
                        <Text color="cyan">{entry.overrideSpec}</Text>
                    </Box>
                )}
                <Box>
                    <Box width={14}>
                        <Text dimColor>Codemod:</Text>
                    </Box>
                    <Text color={entry.hasCodemod ? "green" : "gray"}>{entry.hasCodemod ? "available \u2699" : "not available"}</Text>
                </Box>

                <Box flexDirection="column" marginTop={1}>
                    <Text dimColor>{"\u2500\u2500 "}</Text>
                    <Text bold color="white">
                        DESCRIPTION
                    </Text>
                    <Box marginTop={1} paddingLeft={2}>
                        <Text>{CATEGORY_DESCRIPTIONS[entry.category] ?? ""}</Text>
                    </Box>
                </Box>

                {entry.category === "native" && (
                    <Box flexDirection="column" marginTop={1}>
                        <Text dimColor>{"\u2500\u2500 "}</Text>
                        <Text bold color="green">
                            ACTION
                        </Text>
                        <Box flexDirection="column" marginTop={1} paddingLeft={2}>
                            {entry.hasCodemod
                                ? (
                                    <>
                                        <Text color="green">
                                            {"\u2713"}
                                            {' '}
                                            Codemod will rewrite imports to use native API.
                                        </Text>
                                        <Text dimColor> The package can then be removed from dependencies.</Text>
                                    </>
                                )
                                : (
                                    <>
                                        <Text color="yellow">
                                            {"\u2139"}
                                            {' '}
                                            No automated codemod available.
                                        </Text>
                                        <Text dimColor> Manual migration required — replace usage with native equivalent.</Text>
                                    </>
                                )}
                        </Box>
                    </Box>
                )}

                {entry.category === "socket" && (
                    <Box flexDirection="column" marginTop={1}>
                        <Text dimColor>{"\u2500\u2500 "}</Text>
                        <Text bold color="cyan">
                            ACTION
                        </Text>
                        <Box flexDirection="column" marginTop={1} paddingLeft={2}>
                            <Text color="cyan">
                                {"\u2713"}
                                {' '}
                                Override will redirect resolution to the hardened package.
                            </Text>
                            <Text dimColor> No source code changes needed — drop-in replacement.</Text>
                        </Box>
                    </Box>
                )}

                <Box flexDirection="column" marginTop={1}>
                    <Text dimColor>{"\u2500\u2500 "}</Text>
                    <Text bold color="white">
                        LINKS
                    </Text>
                    <Box flexDirection="column" marginTop={1} paddingLeft={2}>
                        <Text color="cyan" underline>
                            https://npmx.dev/
                            {entry.packageName}
                        </Text>
                    </Box>
                </Box>
            </ScrollView>
        </Box>
    );
};

export default OptimizeDetailPanel;
