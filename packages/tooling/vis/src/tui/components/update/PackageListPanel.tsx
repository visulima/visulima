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
    const checkbox = checked ? "\u2611" : "\u2610"; // ☑ or ☐

    return (
        <Box>
            <Text>{isSelected ? ">" : " "}</Text>
            <Text color={checked ? "cyan" : "gray"}> {checkbox} </Text>
            {hasSecurity && <Text color="red">{"\u26A0"} </Text>}
            {!hasSecurity && <Text>{"  "}</Text>}
            <Box flexGrow={1}>
                <Text bold={isSelected} inverse={isSelected}>
                    {entry.packageName}
                </Text>
            </Box>
            <Box width={14} justifyContent="flex-end">
                <Text dimColor>{entry.currentRange}</Text>
            </Box>
            <Text dimColor> {"\u2192"} </Text>
            <Box width={14}>
                <Text>{entry.newRange}</Text>
            </Box>
            <Box width={7} justifyContent="flex-end">
                <Text color={typeColor} bold>
                    {entry.updateType}
                </Text>
            </Box>
        </Box>
    );
};

interface CatalogHeaderProps {
    count: number;
    name: string;
}

const CatalogHeader = ({ count, name }: CatalogHeaderProps): React.JSX.Element => {
    return (
        <Box marginTop={1}>
            <Text color="cyan" bold>
                {"\u25BC"} {name}
            </Text>
            <Text dimColor> ({count} package{count !== 1 ? "s" : ""})</Text>
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
    selectedIndex,
    totalEntries,
}: PackageListPanelProps): React.JSX.Element => {
    const borderColor = focused ? "cyan" : "gray";

    // Count by type for header summary
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

    // Build flat row list with catalog headers interleaved
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
            <Box paddingX={1} gap={1}>
                <Text bold inverse color="cyan">
                    {" VIS "}
                </Text>
                <Text>
                    {totalEntries} outdated{summaryText}
                </Text>
                {!isDryRun && checkedCount > 0 && (
                    <Text dimColor> \u2014 {checkedCount} selected</Text>
                )}
            </Box>

            {/* Package list */}
            <Box flexDirection="column" flexGrow={1} overflow="hidden" paddingX={1}>
                {rows}
            </Box>

            {/* Filter type bar */}
            <Box paddingX={1} gap={1} flexShrink={0}>
                {FILTER_LABELS.map((f) => (
                    <Box key={f.key}>
                        <Text color={filterType === f.key ? "cyan" : "gray"} bold={filterType === f.key}>
                            {f.shortcut}:{f.label}
                        </Text>
                    </Box>
                ))}
            </Box>

            {/* Text filter bar */}
            {filterActive && (
                <Box paddingX={1} borderStyle="single" borderColor="yellow" borderTop borderBottom={false} borderLeft={false} borderRight={false} flexShrink={0}>
                    <Text color="yellow">{"/  "}</Text>
                    <Text>{filterText}</Text>
                    <Text inverse>{" "}</Text>
                </Box>
            )}
        </Box>
    );
};

export default PackageListPanel;
