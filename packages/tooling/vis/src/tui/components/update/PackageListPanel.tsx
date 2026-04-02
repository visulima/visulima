import { Box, Text } from "@visulima/tui";

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
    const checkbox = checked ? "\u2611" : "\u2610";

    return (
        <Box height={1} flexShrink={0}>
            <Text>{isSelected ? ">" : " "}</Text>
            <Text color={checked ? "white" : "gray"}> {checkbox} </Text>
            {hasSecurity ? <Text color="red">{"\u26A0 "}</Text> : <Text>{"  "}</Text>}
            <Box flexGrow={1}>
                <Text bold={isSelected} inverse={isSelected} wrap="truncate">
                    {entry.packageName}
                </Text>
            </Box>
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

            {/* Package list — simple offset-based scrolling */}
            <Box flexDirection="column" flexGrow={1} overflow="hidden" paddingX={1}>
                <Box flexDirection="column" marginTop={-scrollOffset}>
                    {rows}
                </Box>
            </Box>

            {/* Filter type bar */}
            <Box paddingX={1} gap={1} flexShrink={0}>
                {FILTER_LABELS.map((f) => (
                    <Box key={f.key}>
                        <Text color={filterType === f.key ? "white" : "gray"} bold={filterType === f.key}>
                            {f.shortcut}:{f.label.toUpperCase()}
                        </Text>
                    </Box>
                ))}
            </Box>

            {/* Text filter bar */}
            {filterActive && (
                <Box borderBottom={false} borderColor="gray" borderLeft={false} borderRight={false} borderStyle="single" borderTop flexShrink={0} paddingX={1}>
                    <Text color="white" bold>{"/ "}</Text>
                    <Text>{filterText}</Text>
                    <Text inverse>{" "}</Text>
                </Box>
            )}
        </Box>
    );
};

export default PackageListPanel;
