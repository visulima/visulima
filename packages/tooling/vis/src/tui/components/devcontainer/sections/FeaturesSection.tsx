import { Box, Text, useWindowSize } from "@visulima/tui";
import React, { useMemo } from "react";

import { filterFeatures } from "../catalogs/filters";
import type { DevcontainerConfig } from "../types";

interface FeaturesSectionProps {
    readonly config: DevcontainerConfig;
    readonly fieldIndex: number;
    readonly searchText: string;
}

const FeaturesSection = ({ config, fieldIndex, searchText }: FeaturesSectionProps): React.JSX.Element => {
    const { rows } = useWindowSize();
    const enabledFeatures = useMemo(() => new Set(Object.keys(config.features ?? {})), [config.features]);
    const filtered = useMemo(() => filterFeatures(searchText), [searchText]);

    // Viewport scrolling: reserve rows for header(2) + search(2) + footer(2) + chrome(~6)
    const maxVisible = Math.max(1, rows - 12);
    const scrollOffset = useMemo(() => {
        if (fieldIndex < 0) {
            return 0;
        }

        // Keep selected item centered when possible
        const half = Math.floor(maxVisible / 2);
        const start = Math.max(0, fieldIndex - half);
        const maxStart = Math.max(0, filtered.length - maxVisible);

        return Math.min(start, maxStart);
    }, [fieldIndex, maxVisible, filtered.length]);

    const visible = filtered.slice(scrollOffset, scrollOffset + maxVisible);
    const hasMore = scrollOffset + maxVisible < filtered.length;

    return (
        <Box flexDirection="column" overflow="hidden" paddingX={1}>
            <Box flexShrink={0} marginBottom={1}>
                <Text bold color="cyan">Dev Container Features</Text>
                <Text dimColor> ({enabledFeatures.size} selected)</Text>
            </Box>
            {searchText && (
                <Box flexShrink={0} marginBottom={1}>
                    <Text dimColor>
                        Filter: <Text color="yellow">{searchText}</Text> ({filtered.length} results)
                    </Text>
                </Box>
            )}
            {scrollOffset > 0 && (
                <Box flexShrink={0}>
                    <Text dimColor> {"\u2191"} {scrollOffset} more above</Text>
                </Box>
            )}
            {visible.map((feature, visibleIdx) => {
                const actualIndex = scrollOffset + visibleIdx;
                const isSelected = actualIndex === fieldIndex;
                const isEnabled = enabledFeatures.has(feature.id);

                return (
                    <Box flexShrink={0} key={feature.id}>
                        <Text color={isSelected ? "cyan" : undefined} inverse={isSelected} wrap="truncate">
                            {isEnabled ? " [x] " : " [ ] "}
                            {feature.name} - {feature.description}
                        </Text>
                    </Box>
                );
            })}
            {hasMore && (
                <Box flexShrink={0}>
                    <Text dimColor> {"\u2193"} {filtered.length - scrollOffset - maxVisible} more below</Text>
                </Box>
            )}
            {filtered.length === 0 && (
                <Text dimColor> No features match the search.</Text>
            )}
            <Box flexShrink={0} marginTop={1}>
                <Text dimColor wrap="truncate">
                    <Text bold color="white">Space</Text> toggle  <Text bold color="white">/</Text> search  <Text bold color="white">{"\u2191\u2193"}</Text> navigate  <Text bold color="white">Esc</Text> clear search
                </Text>
            </Box>
        </Box>
    );
};

export default FeaturesSection;
