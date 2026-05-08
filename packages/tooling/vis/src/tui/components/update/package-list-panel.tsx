import { Box } from "@visulima/tui/components/box";
import { ScrollBar } from "@visulima/tui/components/scroll-bar";
import { Tab } from "@visulima/tui/components/tab";
import { Tabs } from "@visulima/tui/components/tabs";
import { Text } from "@visulima/tui/components/text";

import { scoreColor } from "../../../security/socket-security";
import type { OutdatedEntry } from "../../../util/catalog";
import { useMeasuredHeight } from "../../use-measured-height";
import type { FilterType } from "./update-store";

// ── Helpers ─────────────────────────────────────────────────────────────

const UPDATE_TYPE_COLORS: Record<string, string> = {
    major: "red",
    minor: "yellow",
    patch: "green",
};

const FILTER_TABS: ReadonlyArray<{ id: FilterType; label: string }> = [
    { id: "all", label: "All" },
    { id: "major", label: "Major" },
    { id: "minor", label: "Minor" },
    { id: "patch", label: "Patch" },
    { id: "security", label: "Security" },
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
    const scoreText = entry.socketReport ? `${String(Math.round(entry.socketReport.score.overall * 100))}%` : "";
    const scoreColorName = entry.socketReport ? scoreColor(entry.socketReport.score.overall) : ("gray" as const);

    return (
        <Box flexShrink={0} height={1}>
            <Text>{isSelected ? ">" : " "}</Text>
            <Text color={checked ? "white" : "gray"}>
{" "}
{checkbox}
{" "}
            </Text>
            {hasSecurity || hasSocketAlerts
                ? (
                <Text color={isAcknowledged ? "gray" : "red"}>{isAcknowledged ? "\u2713 " : "\u26A0 "}</Text>
                )
                : (
                <Text>{"  "}</Text>
                )}
            <Box flexGrow={1}>
                <Text bold={isSelected} inverse={isSelected} wrap="truncate">
                    {entry.packageName}
                    {isAcknowledged ? " [ack]" : ""}
                </Text>
            </Box>
            {scoreText && (
<Text color={scoreColorName}>
{" "}
{scoreText}
</Text>
            )}
            <Text dimColor>
{" "}
{entry.currentRange}
            </Text>
            <Text dimColor>
{" "}
{"\u2192"}
{" "}
            </Text>
            <Text>
{entry.newRange}
{" "}
            </Text>
            <Text bold color={typeColor}>
                {entry.updateType}
            </Text>
        </Box>
    );
};

interface CatalogHeaderProps {
    count: number;
    name: string;
}

const CatalogHeader = ({ count, name }: CatalogHeaderProps): React.JSX.Element => (
    <Box flexShrink={0} height={1} marginTop={1}>
        <Text dimColor>
{"\u25BC"}
{" "}
        </Text>
        <Text bold color="white">
            {name.toUpperCase()}
        </Text>
        <Text dimColor>
{" "}
(
{count}
)
        </Text>
    </Box>
);

// ── Main Component ──────────────────────────────────────────────────────

interface PackageListPanelProps {
    checkedEntries: Set<string>;
    entries: OutdatedEntry[];
    filterActive: boolean;
    filteredOutCount: number;
    filterText: string;
    filterType: FilterType;
    focused: boolean;
    groupedByCatalog: Map<string, OutdatedEntry[]>;
    isDryRun: boolean;

    /**
     * Reports the actual measured content-row height. The parent uses
     * it for scroll math (max offset, scroll-into-view); the JS estimate
     * passed via `viewportHeight` is only the initial fallback before
     * measurement lands. See DoctorListPanel for the same pattern.
     */
    onViewportHeightChange?: (height: number) => void;
    scrollOffset: number;
    selectedIndex: number;
    totalCatalogEntries: number;
    totalChecked: number;
    totalEntries: number;
    viewportHeight: number;
}

const PackageListPanel = ({
    checkedEntries,
    entries,
    filterActive,
    filteredOutCount,
    filterText,
    filterType,
    focused,
    groupedByCatalog,
    isDryRun,
    onViewportHeightChange,
    scrollOffset,
    selectedIndex,
    totalCatalogEntries,
    totalChecked,
    totalEntries,
    viewportHeight,
}: PackageListPanelProps): React.JSX.Element => {
    const borderColor = focused ? "white" : "gray";

    // Measure the actual rendered content-row height — the JS estimate
    // doesn't account for the conditional "filtered out" notice or for
    // wrapping/padding rounding, so the scrollbar would visibly mismatch
    // the visible list area without this.
    const { measuredHeight: measuredViewportHeight, ref: contentRowRef } = useMeasuredHeight(viewportHeight, onViewportHeightChange);

    let majors = 0;
    let minors = 0;
    let patches = 0;
    let secCount = 0;

    for (const e of entries) {
        if (e.updateType === "major") {
            majors++;
        } else if (e.updateType === "minor") {
            minors++;
        } else {
            patches++;
        }

        if ((e.vulnerabilities && e.vulnerabilities.length > 0) || (e.socketReport && e.socketReport.alerts.length > 0)) {
            secCount++;
        }
    }

    const summaryParts: string[] = [];

    if (majors > 0) {
        summaryParts.push(`${majors} major`);
    }

    if (minors > 0) {
        summaryParts.push(`${minors} minor`);
    }

    if (patches > 0) {
        summaryParts.push(`${patches} patch`);
    }

    if (secCount > 0) {
        summaryParts.push(`${secCount} vulnerable`);
    }

    const summaryText = summaryParts.length > 0 ? ` (${summaryParts.join(", ")})` : "";
    let checkedCount = 0;

    for (const e of entries) {
        if (checkedEntries.has(e.packageName)) {
            checkedCount++;
        }
    }

    // Build flat row list
    const rows: React.JSX.Element[] = [];
    let flatIndex = 0;

    for (const [catalogName, catalogEntries] of groupedByCatalog) {
        rows.push(<CatalogHeader count={catalogEntries.length} key={`hdr-${catalogName}`} name={catalogName} />);

        for (const entry of catalogEntries) {
            const currentFlatIndex = flatIndex;

            rows.push(
                <PackageRow
                    checked={checkedEntries.has(entry.packageName)}
                    entry={entry}
                    isSelected={currentFlatIndex === selectedIndex}
                    key={entry.packageName}
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

    const showScrollbar = contentHeight > measuredViewportHeight && measuredViewportHeight > 0;

    return (
        <Box borderColor={borderColor} borderStyle="single" flexDirection="column" flexGrow={1}>
            {/* Header */}
            <Box flexShrink={0} gap={1} paddingX={1}>
                <Text bold inverse>
                    {" VIS "}
                </Text>
                <Text wrap="truncate">
                    {totalEntries}
                    {totalChecked > 0 ? `/${totalChecked}` : ""}
{" "}
outdated
{summaryText}
                    {totalCatalogEntries > totalChecked ? ` · ${totalCatalogEntries - totalChecked} dupes` : ""}
                </Text>
                {!isDryRun && checkedCount > 0 && (
<Text dimColor>
{" "}
—
{checkedCount}
{" "}
selected
</Text>
                )}
            </Box>

            {/* Filter tabs — below header */}
            <Box flexShrink={0} paddingX={1} paddingY={1}>
                <Tabs
                    isFocused={focused}
                    keyMap={{ next: [], previous: [], useNumbers: false, useTab: false }}
                    onChange={() => {}}
                    showIndex={false}
                    value={filterType}
                >
                    {FILTER_TABS.map(({ id, label }) => (
                        <Tab key={id} name={id}>
                            {label}
                        </Tab>
                    ))}
                </Tabs>
            </Box>

            {/* Text filter input */}
            {filterActive && (
                <Box flexShrink={0} paddingX={1}>
                    <Text bold color="white">
                        {"/ "}
                    </Text>
                    <Text>{filterText}</Text>
                    <Text inverse> </Text>
                </Box>
            )}

            {/* Filtered-out packages note */}
            {filteredOutCount > 0 && (
                <Box flexShrink={0} paddingX={1}>
                    <Text color="yellow">
                        {"\u26A0"}
{" "}
{filteredOutCount}
{" "}
package
{filteredOutCount === 1 ? "" : "s"}
{" "}
filtered out by target constraint — press
{" "}
                        <Text bold color="white">
                            f
                        </Text>
{" "}
                        to view
                    </Text>
                </Box>
            )}

            {/* Package list with scrollbar — key forces remount on filter change to clear stale content */}
            <Box flexDirection="row" flexGrow={1} key={`list-${filterType}-${filterText}`} overflow="hidden" ref={contentRowRef}>
                <Box flexDirection="column" flexGrow={1} overflow="hidden" paddingLeft={1}>
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
                            viewportHeight={measuredViewportHeight}
                        />
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default PackageListPanel;
