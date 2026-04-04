import { Box, ScrollBar, Text } from "@visulima/tui";

import type { OutdatedEntry } from "../../../catalog";
import type { FilterType } from "./UpdateStore";

// ── Helpers ─────────────────────────────────────────────────────────────

const UPDATE_TYPE_COLORS: Record<string, string> = {
    major: "red",
    minor: "yellow",
    patch: "green",
};

const FILTER_LABELS: { key: FilterType; label: string; shortcut: string }[] = [
    { key: "all", label: "All", shortcut: "1" },
    { key: "major", label: "Major", shortcut: "2" },
    { key: "minor", label: "Minor", shortcut: "3" },
    { key: "patch", label: "Patch", shortcut: "4" },
    { key: "security", label: "Security", shortcut: "5" },
];

// ── Sub-components ──────────────────────────────────────────────────────

interface PackageRowProps {
    checked: boolean;
    entry: OutdatedEntry;
    isSelected: boolean;
}

const PackageRow = ({ checked, entry, isSelected }: PackageRowProps): React.JSX.Element => {
    const typeColor = UPDATE_TYPE_COLORS[entry.updateType] ?? "white";
    const hasSecurity = entry.vulnerabilities && entry.vulnerabilities.length > 0;
    const hasSocketAlerts = entry.socketReport && entry.socketReport.alerts.length > 0;
    const isAcknowledged = Boolean(entry.acceptedRisk);
    const checkbox = checked ? "\u2611" : "\u2610";

    // Socket.dev score badge
    const scoreText = entry.socketReport
        ? `${String(Math.round(entry.socketReport.score.overall * 100))}%`
        : "";
    const scoreColor = entry.socketReport
        ? entry.socketReport.score.overall >= 0.6 ? "green" : entry.socketReport.score.overall >= 0.4 ? "yellow" : "red"
        : "gray";

    return (
        <Box height={1} flexShrink={0}>
            <Text>{isSelected ? ">" : " "}</Text>
            <Text color={checked ? "white" : "gray"}> {checkbox} </Text>
            {hasSecurity || hasSocketAlerts ? <Text color={isAcknowledged ? "gray" : "red"}>{isAcknowledged ? "\u2713 " : "\u26A0 "}</Text> : <Text>{"  "}</Text>}
            <Box flexGrow={1}>
                <Text bold={isSelected} inverse={isSelected} wrap="truncate">
                    {entry.packageName}{isAcknowledged ? " [ack]" : ""}
                </Text>
            </Box>
            {scoreText && <Text color={scoreColor}> {scoreText}</Text>}
            <Text dimColor> {entry.currentRange}</Text>
            <Text dimColor> {"\u2192"} </Text>
            <Text>{entry.newRange} </Text>
            <Text color={typeColor} bold>{entry.updateType}</Text>
        </Box>
    );
};

interface CatalogHeaderProps {
    count: number;
    name: string;
}

const CatalogHeader = ({ count, name }: CatalogHeaderProps): React.JSX.Element => {
    return (
        <Box height={1} flexShrink={0} marginTop={1}>
            <Text dimColor>{"\u25BC"} </Text>
            <Text bold color="white">
                {name.toUpperCase()}
            </Text>
            <Text dimColor> ({count})</Text>
        </Box>
    );
};

// ── Main Component ──────────────────────────────────────────────────────

interface PackageListPanelProps {
    checkedEntries: Set<string>;
    entries: OutdatedEntry[];
    filterActive: boolean;
    filterText: string;
    filterType: FilterType;
    focused: boolean;
    groupedByCatalog: Map<string, OutdatedEntry[]>;
    isDryRun: boolean;
    scrollOffset: number;
    selectedIndex: number;
    totalEntries: number;
    viewportHeight: number;
}

const PackageListPanel = ({
    checkedEntries,
    entries,
    filterActive,
    filterText,
    filterType,
    focused,
    groupedByCatalog,
    isDryRun,
    scrollOffset,
    selectedIndex,
    totalEntries,
    viewportHeight,
}: PackageListPanelProps): React.JSX.Element => {
    const borderColor = focused ? "white" : "gray";

    const majors = entries.filter((e) => e.updateType === "major").length;
    const minors = entries.filter((e) => e.updateType === "minor").length;
    const patches = entries.filter((e) => e.updateType === "patch").length;
    const secCount = entries.filter((e) => e.vulnerabilities && e.vulnerabilities.length > 0).length;

    const summaryParts: string[] = [];

    if (majors > 0) summaryParts.push(`${majors} major`);
    if (minors > 0) summaryParts.push(`${minors} minor`);
    if (patches > 0) summaryParts.push(`${patches} patch`);
    if (secCount > 0) summaryParts.push(`${secCount} vulnerable`);

    const summaryText = summaryParts.length > 0 ? ` (${summaryParts.join(", ")})` : "";
    const checkedCount = checkedEntries.size;

    // Build flat row list
    const rows: React.JSX.Element[] = [];
    let flatIndex = 0;

    for (const [catalogName, catalogEntries] of groupedByCatalog) {
        rows.push(
            <CatalogHeader key={`hdr-${catalogName}`} count={catalogEntries.length} name={catalogName} />,
        );

        for (const entry of catalogEntries) {
            const currentFlatIndex = flatIndex;

            rows.push(
                <PackageRow
                    key={entry.packageName}
                    checked={checkedEntries.has(entry.packageName)}
                    entry={entry}
                    isSelected={currentFlatIndex === selectedIndex}
                />,
            );
            flatIndex++;
        }
    }

    // Total content height: each catalog header = 2 rows, each package = 1 row
    let contentHeight = 0;

    for (const [, catalogEntries] of groupedByCatalog) {
        contentHeight += 2 + catalogEntries.length;
    }

    const showScrollbar = contentHeight > viewportHeight && viewportHeight > 0;

    return (
        <Box borderColor={borderColor} borderStyle="single" flexDirection="column" flexGrow={1}>
            {/* Header */}
            <Box flexShrink={0} paddingX={1} gap={1}>
                <Text bold inverse>
                    {" VIS "}
                </Text>
                <Text wrap="truncate">
                    {totalEntries} outdated{summaryText}
                </Text>
                {!isDryRun && checkedCount > 0 && (
                    <Text dimColor> — {checkedCount} selected</Text>
                )}
            </Box>

            {/* Filter type bar — below header */}
            <Box flexShrink={0} paddingX={1} paddingY={1} gap={1}>
                {FILTER_LABELS.map((f) => {
                    const isActive = filterType === f.key;

                    return (
                        <Box key={f.key}>
                            <Text dimColor={!isActive}>[</Text>
                            <Text color={isActive ? "cyan" : "gray"} bold={isActive}>{f.shortcut}</Text>
                            <Text dimColor={!isActive}>]</Text>
                            <Text color={isActive ? "white" : "gray"}> {f.label}</Text>
                        </Box>
                    );
                })}
            </Box>

            {/* Text filter input */}
            {filterActive && (
                <Box flexShrink={0} paddingX={1}>
                    <Text color="white" bold>{"/ "}</Text>
                    <Text>{filterText}</Text>
                    <Text inverse>{" "}</Text>
                </Box>
            )}

            {/* Package list with scrollbar */}
            <Box flexDirection="row" flexGrow={1} overflow="hidden">
                <Box flexDirection="column" flexGrow={1} paddingLeft={1} overflow="hidden">
                    <Box flexDirection="column" marginTop={-scrollOffset}>
                        {rows}
                    </Box>
                </Box>
                {showScrollbar && (
                    <Box flexShrink={0} marginLeft={1} marginRight={1}>
                        <ScrollBar
                            contentHeight={contentHeight}
                            placement="inset"
                            scrollOffset={scrollOffset}
                            style="block"
                            viewportHeight={viewportHeight}
                        />
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default PackageListPanel;
