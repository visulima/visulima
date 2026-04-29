import { Box, ScrollBar, Spinner, Tab, Tabs, Text } from "@visulima/tui";
import React from "react";

import type { SectionId } from "../../../commands/doctor/sections";
import { useMeasuredHeight } from "../../use-measured-height";
import type { FilterType, SectionStatus } from "./DoctorStore";
import { FILTER_TABS } from "./DoctorStore";
import type { DoctorFinding, FindingSeverity } from "./findings";
import { SECTION_LABELS } from "./findings";

const SEVERITY_COLORS: Record<FindingSeverity, string> = {
    error: "red",
    warn: "yellow",
};

const SEVERITY_GLYPH: Record<FindingSeverity, string> = {
    error: "✖",
    warn: "⚠",
};

interface FindingRowProps {
    finding: DoctorFinding;
    isSelected: boolean;
}

const hasAcceptedRisk = (finding: DoctorFinding): boolean => {
    if (finding.kind === "outdated" || finding.kind === "vulnerability" || finding.kind === "socket") {
        return Boolean(finding.entry.acceptedRisk);
    }

    return false;
};

const FindingRow = ({ finding, isSelected }: FindingRowProps): React.JSX.Element => {
    const sevColor = SEVERITY_COLORS[finding.severity];
    const acked = hasAcceptedRisk(finding);

    return (
        <Box flexShrink={0} height={1}>
            <Text>{isSelected ? ">" : " "}</Text>
            <Text color={sevColor}>
                {" "}
                {SEVERITY_GLYPH[finding.severity]}
                {" "}
            </Text>
            <Box flexGrow={1}>
                <Text bold={isSelected} inverse={isSelected} wrap="truncate">
                    {finding.title}
                </Text>
            </Box>
            {acked
                ? (
                    <Text color="cyan">
                        {" ack"}
                    </Text>
                )
                : null}
            {finding.subtitle
                ? (
                    <Text dimColor wrap="truncate">
                        {" "}
                        {finding.subtitle}
                    </Text>
                )
                : null}
        </Box>
    );
};

interface SectionHeaderProps {
    count: number;
    section: SectionId;
}

const SectionHeader = ({ count, section }: SectionHeaderProps): React.JSX.Element => (
    <Box flexShrink={0} height={1} marginTop={1}>
        <Text dimColor>
            ▼
            {" "}
        </Text>
        <Text bold color="white">
            {SECTION_LABELS[section].toUpperCase()}
        </Text>
        <Text dimColor>
            {" ("}
            {count}
            )
        </Text>
    </Box>
);

interface TabLabelProps {
    count: number;
    label: string;
    overallStatus?: "done" | "running";
    status?: SectionStatus;
}

const TabLabel = ({ count, label, overallStatus, status }: TabLabelProps): React.JSX.Element => {
    const showSpinner = status === "running" || overallStatus === "running";

    // Tabs wraps each Tab's children inside <Text>, so the label must be
    // a Text-only tree. <Spinner> renders Text, so it's safe to nest.
    return (
        <Text>
            {label}
            {showSpinner
                ? (
                    <Text>
                        {" "}
                        <Spinner type="dots" />
                    </Text>
                )
                : null}
            {status === "error"
                ? (
                    <Text bold color="red">
                        {" ✖"}
                    </Text>
                )
                : (
                    <Text dimColor>
                        {" ("}
                        {String(count)}
                        )
                    </Text>
                )}
        </Text>
    );
};

interface DoctorListPanelProps {
    elapsedMs: number;
    entries: ReadonlyArray<DoctorFinding>;
    filterActive: boolean;
    filterText: string;
    filterType: FilterType;
    focused: boolean;
    fromCache?: boolean;
    grouped: ReadonlyMap<SectionId, ReadonlyArray<DoctorFinding>>;

    /**
     * Reports the measured content-row height so the parent can use it
     * for scroll math (maxScrollOffset, scrollToIndex). The JS estimate
     * passed via `viewportHeight` is only used as the initial value
     * before measurement completes.
     */
    onViewportHeightChange?: (height: number) => void;
    scrollOffset: number;
    sectionCounts: Readonly<Record<FilterType, number>>;
    sectionMessage: Readonly<Partial<Record<SectionId, string>>>;
    sectionStatus: Readonly<Record<SectionId, SectionStatus>>;
    selectedIndex: number;
    severityFilter: FindingSeverity | undefined;
    totalAll: number;
    viewportHeight: number;
}

const DoctorListPanel = ({
    elapsedMs,
    entries,
    filterActive,
    filterText,
    filterType,
    focused,
    fromCache = false,
    grouped,
    onViewportHeightChange,
    scrollOffset,
    sectionCounts,
    sectionMessage,
    sectionStatus,
    selectedIndex,
    severityFilter,
    totalAll,
    viewportHeight,
}: DoctorListPanelProps): React.JSX.Element => {
    const borderColor = focused ? "white" : "gray";

    // Measure the actual rendered content-row height so the scrollbar
    // tracks the visible area exactly. The JS-computed `viewportHeight`
    // estimate (border + header + tabs + activity + filter) can drift
    // when Yoga wraps or rounds padding differently than expected.
    const { measuredHeight: measuredViewportHeight, ref: contentRowRef } = useMeasuredHeight(viewportHeight, onViewportHeightChange);

    let errors = 0;
    let warns = 0;

    for (const finding of entries) {
        if (finding.severity === "error") {
            errors += 1;
        } else if (finding.severity === "warn") {
            warns += 1;
        }
    }

    const summaryParts: string[] = [];

    if (errors > 0) {
        summaryParts.push(`${String(errors)} error${errors === 1 ? "" : "s"}`);
    }

    if (warns > 0) {
        summaryParts.push(`${String(warns)} warn${warns === 1 ? "" : "s"}`);
    }

    const summary = summaryParts.length > 0 ? ` (${summaryParts.join(", ")})` : "";
    const elapsedSeconds = (elapsedMs / 1000).toFixed(1);

    const rows: React.JSX.Element[] = [];

    for (const [section, items] of grouped) {
        rows.push(<SectionHeader count={items.length} key={`hdr-${section}`} section={section} />);

        for (const item of items) {
            const flatIndex = entries.indexOf(item);

            rows.push(
                <FindingRow
                    finding={item}
                    isSelected={flatIndex === selectedIndex}
                    key={item.id}
                />,
            );
        }
    }

    let contentHeight = 0;

    for (const [, items] of grouped) {
        contentHeight += 2 + items.length;
    }

    const showScrollbar = contentHeight > measuredViewportHeight && measuredViewportHeight > 0;

    return (
        <Box borderColor={borderColor} borderStyle="single" flexDirection="column" flexGrow={1}>
            <Box flexShrink={0} gap={1} paddingX={1}>
                <Text bold inverse>
                    {" DOCTOR "}
                </Text>
                <Text wrap="truncate">
                    {entries.length}
                    {entries.length === totalAll ? "" : `/${String(totalAll)}`}
                    {" finding"}
                    {entries.length === 1 ? "" : "s"}
                    {summary}
                </Text>
                {severityFilter
                    ? (
                        <Text bold color={SEVERITY_COLORS[severityFilter]} inverse>
                            {` ${severityFilter.toUpperCase()} ONLY `}
                        </Text>
                    )
                    : null}
                {fromCache
                    ? (
                        <Text bold color="cyan" inverse>
                            {" CACHED "}
                        </Text>
                    )
                    : null}
                <Text dimColor>
                    {" · "}
                    {elapsedSeconds}
                    s
                </Text>
            </Box>

            <Box flexShrink={0} paddingX={1} paddingY={1}>
                <Tabs
                    isFocused={focused}
                    keyMap={{ next: [], previous: [], useNumbers: false, useTab: false }}
                    onChange={() => {}}
                    showIndex={false}
                    value={filterType}
                >
                    {FILTER_TABS.map(({ id, label }) => {
                        const isAll = id === "all";
                        const status = isAll ? undefined : sectionStatus[id as SectionId];
                        const overallStatus: "done" | "running" | undefined = isAll
                            ? Object.values(sectionStatus).some((s) => s === "running")
                                ? "running"
                                : "done"
                            : undefined;

                        return (
                            <Tab key={id} name={id}>
                                <TabLabel
                                    count={sectionCounts[id]}
                                    label={label}
                                    overallStatus={overallStatus}
                                    status={status}
                                />
                            </Tab>
                        );
                    })}
                </Tabs>
            </Box>

            {(() => {
                const running = (Object.keys(sectionStatus) as SectionId[])
                    .filter((id) => sectionStatus[id] === "running" && sectionMessage[id])
                    .map((id) => sectionMessage[id] as string);

                if (running.length === 0) {
                    return null;
                }

                return (
                    <Box flexShrink={0} paddingX={1}>
                        <Text dimColor wrap="truncate">
                            <Spinner type="dots" />
                            {" "}
                            {running.join(" · ")}
                        </Text>
                    </Box>
                );
            })()}

            {filterActive && (
                <Box flexShrink={0} paddingX={1}>
                    <Text bold color="white">
                        {"/ "}
                    </Text>
                    <Text>{filterText}</Text>
                    <Text inverse> </Text>
                </Box>
            )}

            <Box flexDirection="row" flexGrow={1} key={`list-${filterType}-${filterText}`} overflow="hidden" ref={contentRowRef}>
                <Box flexDirection="column" flexGrow={1} overflow="hidden" paddingLeft={1}>
                    <Box flexDirection="column" marginTop={-scrollOffset}>
                        {rows.length > 0
                            ? rows
                            : (
                                <Box marginTop={1}>
                                    <Text dimColor>No findings match the current filter.</Text>
                                </Box>
                            )}
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

export default DoctorListPanel;
