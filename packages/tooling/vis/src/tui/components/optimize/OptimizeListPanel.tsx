import { Box, ScrollBar, Text } from "@visulima/tui";

import type { FilterType, OptimizeEntry } from "./OptimizeStore";

const CATEGORY_COLORS: Record<string, string> = {
    "micro-utility": "gray",
    native: "green",
    preferred: "yellow",
    socket: "cyan",
};

const CATEGORY_LABELS: Record<string, string> = {
    "micro-utility": "MICRO",
    native: "NATIVE",
    preferred: "PREF",
    socket: "SOCKET",
};

const FILTER_LABELS: { key: FilterType; label: string; shortcut: string }[] = [
    { key: "all", label: "All", shortcut: "1" },
    { key: "native", label: "Native", shortcut: "2" },
    { key: "preferred", label: "Preferred", shortcut: "3" },
    { key: "micro-utility", label: "Micro", shortcut: "4" },
    { key: "socket", label: "Socket", shortcut: "5" },
];

interface EntryRowProps {
    checked: boolean;
    entry: OptimizeEntry;
    isSelected: boolean;
}

const EntryRow = ({ checked, entry, isSelected }: EntryRowProps): React.JSX.Element => {
    const catColor = CATEGORY_COLORS[entry.category] ?? "white";
    const catLabel = CATEGORY_LABELS[entry.category] ?? entry.category;
    const checkbox = checked ? "\u2611" : "\u2610";
    const codemodBadge = entry.hasCodemod ? "\u2699" : " ";

    return (
        <Box height={1} flexShrink={0}>
            <Text>{isSelected ? ">" : " "}</Text>
            <Text color={checked ? "white" : "gray"}> {checkbox} </Text>
            <Text color={catColor} bold>{`[${catLabel}]`.padEnd(9)}</Text>
            <Text> {codemodBadge} </Text>
            <Box flexGrow={1}>
                <Text bold={isSelected} inverse={isSelected} wrap="truncate">
                    {entry.packageName}
                </Text>
            </Box>
            <Text dimColor> → </Text>
            <Text wrap="truncate">{entry.replacement}</Text>
        </Box>
    );
};

interface OptimizeListPanelProps {
    checkedEntries: Set<string>;
    entries: OptimizeEntry[];
    filterActive: boolean;
    filterText: string;
    filterType: FilterType;
    focused: boolean;
    isDryRun: boolean;
    scrollOffset: number;
    selectedIndex: number;
    totalEntries: number;
    viewportHeight: number;
}

const OptimizeListPanel = ({
    checkedEntries,
    entries,
    filterActive,
    filterText,
    filterType,
    focused,
    isDryRun,
    scrollOffset,
    selectedIndex,
    totalEntries,
    viewportHeight,
}: OptimizeListPanelProps): React.JSX.Element => {
    const borderColor = focused ? "white" : "gray";

    let nativeCount = 0;
    let preferredCount = 0;
    let microCount = 0;
    let socketCount = 0;

    for (const e of entries) {
        if (e.category === "native") nativeCount++;
        else if (e.category === "preferred") preferredCount++;
        else if (e.category === "micro-utility") microCount++;
        else socketCount++;
    }

    const summaryParts: string[] = [];

    if (nativeCount > 0) summaryParts.push(`${nativeCount} native`);
    if (preferredCount > 0) summaryParts.push(`${preferredCount} preferred`);
    if (microCount > 0) summaryParts.push(`${microCount} micro`);
    if (socketCount > 0) summaryParts.push(`${socketCount} socket`);

    const summaryText = summaryParts.length > 0 ? ` (${summaryParts.join(", ")})` : "";
    const checkedCount = checkedEntries.size;

    const rows: React.JSX.Element[] = [];

    for (const [index, entry] of entries.entries()) {
        rows.push(
            <EntryRow key={entry.packageName} checked={checkedEntries.has(entry.packageName)} entry={entry} isSelected={index === selectedIndex} />,
        );
    }

    const contentHeight = entries.length;
    const showScrollbar = contentHeight > viewportHeight && viewportHeight > 0;

    return (
        <Box borderColor={borderColor} borderStyle="single" flexDirection="column" flexGrow={1}>
            <Box flexShrink={0} paddingX={1} gap={1}>
                <Text bold inverse>
                    {" VIS OPTIMIZE "}
                </Text>
                <Text wrap="truncate">
                    {totalEntries} optimizations{summaryText}
                </Text>
                {!isDryRun && checkedCount > 0 && <Text dimColor> — {checkedCount} selected</Text>}
            </Box>

            <Box flexShrink={0} paddingX={1} paddingY={1} gap={1}>
                {FILTER_LABELS.map((f) => {
                    const isActive = filterType === f.key;

                    return (
                        <Box key={f.key}>
                            <Text dimColor={!isActive}>[</Text>
                            <Text color={isActive ? "cyan" : "gray"} bold={isActive}>
                                {f.shortcut}
                            </Text>
                            <Text dimColor={!isActive}>]</Text>
                            <Text color={isActive ? "white" : "gray"}> {f.label}</Text>
                        </Box>
                    );
                })}
            </Box>

            {filterActive && (
                <Box flexShrink={0} paddingX={1}>
                    <Text color="white" bold>
                        {"/ "}
                    </Text>
                    <Text>{filterText}</Text>
                    <Text inverse>{" "}</Text>
                </Box>
            )}

            <Box flexDirection="row" flexGrow={1} overflow="hidden">
                <Box flexDirection="column" flexGrow={1} paddingLeft={1} overflow="hidden">
                    <Box flexDirection="column" marginTop={-scrollOffset}>
                        {rows}
                    </Box>
                </Box>
                {showScrollbar && (
                    <Box flexShrink={0} marginLeft={1} marginRight={1}>
                        <ScrollBar contentHeight={contentHeight} placement="inset" scrollOffset={scrollOffset} style="block" viewportHeight={viewportHeight} />
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default OptimizeListPanel;
