import type { ScrollViewRef } from "@visulima/tui";
import { Box, ScrollView, Text } from "@visulima/tui";

import type { SortFileEntry } from "./SortPackageJsonStore";

interface SortDetailPanelProps {
    checkMode: boolean;
    entry: SortFileEntry | null;
    focused: boolean;
    scrollRef?: React.RefObject<ScrollViewRef | null>;
}

const SortDetailPanel = ({ checkMode, entry, focused, scrollRef }: SortDetailPanelProps): React.JSX.Element => {
    const borderColor = focused ? "white" : "gray";

    if (!entry) {
        return (
            <Box alignItems="center" borderColor="gray" borderStyle="single" flexDirection="column" flexGrow={1} justifyContent="center">
                <Text dimColor>No entry selected</Text>
            </Box>
        );
    }

    return (
        <Box borderColor={borderColor} borderStyle="single" flexDirection="column" flexGrow={1}>
            <Box flexShrink={0} paddingTop={1} paddingX={2}>
                <Text bold color="white">
                    {entry.relativePath}
                </Text>
            </Box>

            <ScrollView flexGrow={1} flexShrink={1} paddingX={2} ref={scrollRef} scrollbar scrollbarColor="gray">
                <Text />

                <Box>
                    <Box width={10}>
                        <Text dimColor>Status:</Text>
                    </Box>
                    {entry.status === "error"
                        ? (
                        <Text bold color="red">
                            error
                        </Text>
                        )
                        : entry.status === "unchanged"
                            ? (
                        <Text bold color="green">
                            already sorted
                        </Text>
                            )
                            : entry.status === "rewritten"
                                ? (
                        <Text bold color="yellow">
                            rewritten
                        </Text>
                                )
                                : (
                        <Text bold color="yellow">
                            would rewrite (--check)
                        </Text>
                                )}
                </Box>

                <Box>
                    <Box width={10}>
                        <Text dimColor>Path:</Text>
                    </Box>
                    <Text>{entry.filePath}</Text>
                </Box>

                {entry.error
                    ? (
                    <>
                        <Box flexDirection="column" marginTop={1}>
                            <Text dimColor>{"── "}</Text>
                            <Text bold color="red">
                                ERROR
                            </Text>
                            <Box flexDirection="column" marginTop={1} paddingLeft={2}>
                                <Box>
                                    <Box width={10}>
                                        <Text dimColor>Step:</Text>
                                    </Box>
                                    <Text color="yellow">{entry.error.step}</Text>
                                </Box>
                                {entry.error.context && (
                                    <Box>
                                        <Box width={10}>
                                            <Text dimColor>Position:</Text>
                                        </Box>
                                        <Text>{`line ${String(entry.error.context.line)}, column ${String(entry.error.context.column)}`}</Text>
                                    </Box>
                                )}
                                <Box marginTop={1}>
                                    <Text color="red">{entry.error.message}</Text>
                                </Box>
                            </Box>
                        </Box>

                        {entry.error.context && entry.error.context.snippet.length > 0 && (
                            <Box flexDirection="column" marginTop={1}>
                                <Text dimColor>{"── "}</Text>
                                <Text bold color="white">
                                    SNIPPET
                                </Text>
                                <Box flexDirection="column" marginTop={1} paddingLeft={2}>
                                    {entry.error.context.snippet.map((row) => {
                                        const gutter = `${row.isErrorLine ? "❯" : " "} ${String(row.lineNumber).padStart(4)} `;

                                        return (
                                            <Box key={row.lineNumber}>
                                                <Text color={row.isErrorLine ? "red" : "gray"}>{gutter}</Text>
                                                <Text color={row.isErrorLine ? "white" : "gray"} wrap="truncate-end">
                                                    {row.content || " "}
                                                </Text>
                                            </Box>
                                        );
                                    })}
                                    {entry.error.context.column > 0 && (
                                        <Box>
                                            <Text color="red">{`${" ".repeat(7 + entry.error.context.column - 1)}↑`}</Text>
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        )}
                    </>
                    )
                    : (
                    <Box flexDirection="column" marginTop={1}>
                        <Text dimColor>{"── "}</Text>
                        <Text bold color="white">
                            KEY DIFF
                        </Text>
                        <Box flexDirection="column" marginTop={1} paddingLeft={2}>
                            {entry.diff.length === 0
                                ? (
                                <Text dimColor>No top-level keys moved (sub-key reorder only).</Text>
                                )
                                : (
                                    entry.diff.map((d) => {
                                        const delta = d.toIndex - d.fromIndex;
                                        const arrow = delta < 0 ? `↑ ${String(Math.abs(delta))}` : `↓ ${String(delta)}`;
                                        const arrowColor = delta < 0 ? "green" : "yellow";

                                        return (
                                        <Box key={d.key}>
                                            <Box width={28}>
                                                <Text wrap="truncate">{d.key}</Text>
                                            </Box>
                                            <Box width={10}>
                                                <Text dimColor>
                                                    {String(d.fromIndex)}
                                                    {" → "}
                                                    {String(d.toIndex)}
                                                </Text>
                                            </Box>
                                            <Text color={arrowColor}>{arrow}</Text>
                                        </Box>
                                        );
                                    })
                                )}
                        </Box>
                        {checkMode && entry.status === "would-rewrite" && (
                            <Box marginTop={1} paddingLeft={2}>
                                <Text dimColor>--check mode: no write performed.</Text>
                            </Box>
                        )}
                    </Box>
                    )}
            </ScrollView>
        </Box>
    );
};

export default SortDetailPanel;
