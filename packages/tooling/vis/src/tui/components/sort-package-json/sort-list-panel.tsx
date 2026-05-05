import { Box, ScrollBar, Text } from "@visulima/tui";

import type { FilterType, SortFileEntry, SortFileStatus } from "./sort-package-json-store";

const STATUS_COLORS: Record<SortFileStatus, string> = {
    error: "red",
    rewritten: "yellow",
    unchanged: "green",
    "would-rewrite": "yellow",
};

const STATUS_LABELS: Record<SortFileStatus, string> = {
    error: "ERROR",
    rewritten: "REWROTE",
    unchanged: "SORTED",
    "would-rewrite": "REWRITE",
};

type GroupKey = "errors" | "rewrites" | "sorted";

const GROUP_KEY_FOR_STATUS: Record<SortFileStatus, GroupKey> = {
    error: "errors",
    rewritten: "rewrites",
    unchanged: "sorted",
    "would-rewrite": "rewrites",
};

const GROUP_LABELS: Record<GroupKey, string> = {
    errors: "Errors",
    rewrites: "Rewrites",
    sorted: "Sorted",
};

const FILTER_DEFINITIONS: { count: (counts: GroupCounts) => number; key: FilterType; label: string; shortcut: string }[] = [
    { count: (c) => c.errors + c.rewrites + c.sorted, key: "all", label: "All", shortcut: "1" },
    { count: (c) => c.rewrites, key: "rewritten", label: "Rewrites", shortcut: "2" },
    { count: (c) => c.errors, key: "errors", label: "Errors", shortcut: "3" },
    { count: (c) => c.sorted, key: "unchanged", label: "Sorted", shortcut: "4" },
];

export interface GroupCounts {
    errors: number;
    rewrites: number;
    sorted: number;
}

export const computeGroupCounts = (entries: SortFileEntry[]): GroupCounts => {
    const counts: GroupCounts = { errors: 0, rewrites: 0, sorted: 0 };

    for (const entry of entries) {
        counts[GROUP_KEY_FOR_STATUS[entry.status]]++;
    }

    return counts;
};

interface EntryRowProps {
    entry: SortFileEntry;
    isSelected: boolean;
}

const EntryRow = ({ entry, isSelected }: EntryRowProps): React.JSX.Element => {
    const statusColor = STATUS_COLORS[entry.status];
    const statusLabel = STATUS_LABELS[entry.status];

    return (
        <Box flexShrink={0} height={1}>
            <Text>{isSelected ? ">" : " "}</Text>
            <Text> </Text>
            <Text bold color={statusColor}>
                {`[${statusLabel}]`.padEnd(10)}
            </Text>
            <Text> </Text>
            <Box flexGrow={1}>
                <Text bold={isSelected} inverse={isSelected} wrap="truncate">
                    {entry.relativePath}
                </Text>
            </Box>
            {entry.status !== "error" && entry.diff.length > 0 && (
                <Text dimColor>{` ${String(entry.diff.length)} key${entry.diff.length === 1 ? "" : "s"}`}</Text>
            )}
        </Box>
    );
};

interface SectionHeaderProps {
    color: string;
    count: number;
    label: string;
}

const SectionHeader = ({ color, count, label }: SectionHeaderProps): React.JSX.Element => (
    <Box flexShrink={0} height={1}>
        <Text bold color={color}>
            {`${label} (${String(count)})`}
        </Text>
    </Box>
);

interface SortListPanelProps {
    counts: GroupCounts;
    entries: SortFileEntry[];
    filterType: FilterType;
    focused: boolean;
    selectedIndex: number;
    totalEntries: number;
    viewportHeight: number;
}

type RenderRow
    = | { color: string; count: number; kind: "header"; label: string }
        | { entry: SortFileEntry; entryIndex: number; kind: "entry" }
        | { kind: "spacer" };

const SortListPanel = ({ counts, entries, filterType, focused, selectedIndex, totalEntries, viewportHeight }: SortListPanelProps): React.JSX.Element => {
    const borderColor = focused ? "white" : "gray";

    // Group counts on the **visible** entries — used for section headers in
    // the "All" view, which only show statuses that are actually present.
    const visibleCounts = computeGroupCounts(entries);

    // Headers are only useful when at least two of the three groups are
    // present — a single-status list reads better without dividers.
    const groupsPresent = (visibleCounts.errors > 0 ? 1 : 0) + (visibleCounts.rewrites > 0 ? 1 : 0) + (visibleCounts.sorted > 0 ? 1 : 0);
    const showHeaders = filterType === "all" && groupsPresent > 1;

    const renderRows: RenderRow[] = [];
    let lastGroup: GroupKey | undefined;

    for (const [entryIndex, entry] of entries.entries()) {
        const group = GROUP_KEY_FOR_STATUS[entry.status];

        if (showHeaders && group !== lastGroup) {
            if (lastGroup !== undefined) {
                renderRows.push({ kind: "spacer" });
            }

            renderRows.push({
                color: group === "errors" ? "red" : group === "rewrites" ? "yellow" : "green",
                count: visibleCounts[group],
                kind: "header",
                label: GROUP_LABELS[group],
            });
            lastGroup = group;
        }

        renderRows.push({ entry, entryIndex, kind: "entry" });
    }

    // Map the selected entry index back to its row position so the scroll
    // offset accounts for any inserted headers above it.
    const selectedRowIndex = renderRows.findIndex((row) => row.kind === "entry" && row.entryIndex === selectedIndex);
    const hasSelectedRow = selectedRowIndex !== -1;

    const contentHeight = renderRows.length;
    const maxScroll = Math.max(0, contentHeight - viewportHeight);
    let scrollOffset = 0;

    if (hasSelectedRow && viewportHeight > 0) {
        scrollOffset = Math.min(maxScroll, Math.max(0, selectedRowIndex - viewportHeight + 1));
    }

    const showScrollbar = contentHeight > viewportHeight && viewportHeight > 0;

    return (
        <Box borderColor={borderColor} borderStyle="single" flexDirection="column" flexGrow={1}>
            <Box flexShrink={0} gap={1} paddingX={1}>
                <Text bold inverse>
                    {" VIS SORT "}
                </Text>
                <Text wrap="truncate">
                    {totalEntries}
{" "}
file
{totalEntries === 1 ? "" : "s"}
                </Text>
            </Box>

            <Box flexShrink={0} gap={1} paddingX={1} paddingY={1}>
                {FILTER_DEFINITIONS.map((f) => {
                    const isActive = filterType === f.key;
                    const tabCount = f.count(counts);

                    return (
                        <Box key={f.key}>
                            <Text dimColor={!isActive}>[</Text>
                            <Text bold={isActive} color={isActive ? "cyan" : "gray"}>
                                {f.shortcut}
                            </Text>
                            <Text dimColor={!isActive}>]</Text>
                            <Text color={isActive ? "white" : "gray"}>
{" "}
{f.label}
                            </Text>
                            <Text dimColor>
{" "}
(
{tabCount}
)
                            </Text>
                        </Box>
                    );
                })}
            </Box>

            <Box flexDirection="row" flexGrow={1} overflow="hidden">
                <Box flexDirection="column" flexGrow={1} overflow="hidden" paddingLeft={1}>
                    <Box flexDirection="column" marginTop={-scrollOffset}>
                        {renderRows.map((row, index) => {
                            if (row.kind === "spacer") {
                                return <Box flexShrink={0} height={1} key={`s-${String(index)}`} />;
                            }

                            if (row.kind === "header") {
                                return <SectionHeader color={row.color} count={row.count} key={`h-${row.label}`} label={row.label} />;
                            }

                            return <EntryRow entry={row.entry} isSelected={row.entryIndex === selectedIndex} key={row.entry.filePath} />;
                        })}
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

export default SortListPanel;
