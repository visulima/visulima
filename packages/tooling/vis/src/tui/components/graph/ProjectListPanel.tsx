import { Box, ScrollBar, Text } from "@visulima/tui";
import React from "react";

import type { GraphFilterType, GraphNode } from "./GraphStore";

// ── Filter bar labels ───────────────────────────────────────────────────

const FILTER_LABELS: { key: GraphFilterType; label: string; shortcut: string }[] = [
    { key: "all", label: "All", shortcut: "1" },
    { key: "app", label: "Apps", shortcut: "2" },
    { key: "lib", label: "Libs", shortcut: "3" },
];

// ── Sub-components ──────────────────────────────────────────────────────

interface ProjectRowProps {
    isSelected: boolean;
    node: GraphNode;
}

const ProjectRow = ({ isSelected, node }: ProjectRowProps): React.JSX.Element => {
    const isApp = node.type === "application";
    const typeColor = isApp ? "yellow" : "cyan";
    const typeLabel = isApp ? "app" : "lib";

    return (
        <Box flexShrink={0} height={1}>
            <Text>{isSelected ? "\u25B6" : " "} </Text>
            <Box flexGrow={1}>
                <Text bold={isSelected} inverse={isSelected} wrap="truncate">
                    {node.name}
                </Text>
            </Box>
            <Text color={typeColor}> {typeLabel}</Text>
            <Text dimColor>
                {" "}
                {"\u2192"}
                {node.deps.length} {"\u2190"}
                {node.reverseDeps.length}
            </Text>
        </Box>
    );
};

interface TypeHeaderProps {
    count: number;
    label: string;
}

const TypeHeader = ({ count, label }: TypeHeaderProps): React.JSX.Element => (
    <Box flexShrink={0} height={1} marginTop={1}>
        <Text dimColor>{"\u25BC"} </Text>
        <Text bold color="white">
            {label.toUpperCase()}
        </Text>
        <Text dimColor> ({count})</Text>
    </Box>
);

// ── Main Component ──────────────────────────────────────────────────────

interface ProjectListPanelProps {
    filterActive: boolean;
    filterText: string;
    filterType: GraphFilterType;
    focused: boolean;
    nodes: GraphNode[];
    scrollOffset: number;
    selectedIndex: number;
    stats: { apps: number; deps: number; libs: number; total: number };
    viewportHeight: number;
}

const ProjectListPanel = ({
    filterActive,
    filterText,
    filterType,
    focused,
    nodes,
    scrollOffset,
    selectedIndex,
    stats,
    viewportHeight,
}: ProjectListPanelProps): React.JSX.Element => {
    const borderColor = focused ? "white" : "gray";

    // Group by type
    const apps = nodes.filter((n) => n.type === "application");
    const libs = nodes.filter((n) => n.type !== "application");

    // Build flat row list
    const rows: React.JSX.Element[] = [];
    let flatIndex = 0;

    if (apps.length > 0) {
        rows.push(<TypeHeader count={apps.length} key="hdr-apps" label="Applications" />);

        for (const node of apps) {
            const currentIndex = flatIndex;

            rows.push(<ProjectRow isSelected={currentIndex === selectedIndex} key={node.name} node={node} />);
            flatIndex++;
        }
    }

    if (libs.length > 0) {
        rows.push(<TypeHeader count={libs.length} key="hdr-libs" label="Libraries" />);

        for (const node of libs) {
            const currentIndex = flatIndex;

            rows.push(<ProjectRow isSelected={currentIndex === selectedIndex} key={node.name} node={node} />);
            flatIndex++;
        }
    }

    // Calculate content height for scrollbar
    let contentHeight = 0;

    if (apps.length > 0) {
        contentHeight += 2 + apps.length;
    }

    if (libs.length > 0) {
        contentHeight += 2 + libs.length;
    }

    const showScrollbar = contentHeight > viewportHeight && viewportHeight > 0;

    return (
        <Box borderColor={borderColor} borderStyle="single" flexDirection="column" flexGrow={1}>
            {/* Header */}
            <Box flexShrink={0} gap={1} paddingX={1}>
                <Text bold inverse>
                    {" VIS "}
                </Text>
                <Text wrap="truncate">{stats.total} packages</Text>
                <Text dimColor>
                    ({stats.apps} apps, {stats.libs} libs, {stats.deps} deps)
                </Text>
            </Box>

            {/* Filter type bar */}
            <Box flexShrink={0} gap={1} paddingX={1} paddingY={1}>
                {FILTER_LABELS.map((f) => {
                    const isActive = filterType === f.key;

                    return (
                        <Box key={f.key}>
                            <Text dimColor={!isActive}>[</Text>
                            <Text bold={isActive} color={isActive ? "cyan" : "gray"}>
                                {f.shortcut}
                            </Text>
                            <Text dimColor={!isActive}>]</Text>
                            <Text color={isActive ? "white" : "gray"}> {f.label}</Text>
                        </Box>
                    );
                })}
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

            {/* Project list with scrollbar */}
            <Box flexDirection="row" flexGrow={1} overflow="hidden">
                <Box flexDirection="column" flexGrow={1} overflow="hidden" paddingLeft={1}>
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

export default ProjectListPanel;
