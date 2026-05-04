import { Box, ScrollBar, Text } from "@visulima/tui";
import React, { useMemo } from "react";

import { filterFeatures } from "../catalogs/filters";
import type { DevcontainerConfig } from "../types";

interface FeaturesSectionProps {
    readonly config: DevcontainerConfig;
    readonly fieldIndex: number;
    readonly scrollOffset: number;
    readonly searchText: string;
    readonly viewportHeight: number;
}

const FeaturesSection = ({ config, fieldIndex, scrollOffset, searchText, viewportHeight }: FeaturesSectionProps): React.JSX.Element => {
    const enabledFeatures = useMemo(() => new Set(Object.keys(config.features ?? {})), [config.features]);
    const filtered = useMemo(() => filterFeatures(searchText), [searchText]);

    const contentHeight = filtered.length;
    const showScrollbar = contentHeight > viewportHeight && viewportHeight > 0;

    return (
        <Box flexDirection="column" flexGrow={1}>
            {/* Header */}
            <Box flexShrink={0} gap={1} paddingX={1}>
                <Text bold color="cyan">
                    {enabledFeatures.size} selected
                </Text>
                {searchText && (
                    <Text dimColor>
                        — filter: <Text color="yellow">{searchText}</Text> ({filtered.length} results)
                    </Text>
                )}
            </Box>

            {/* List with scrollbar */}
            <Box flexDirection="row" flexGrow={1} overflow="hidden">
                <Box flexDirection="column" flexGrow={1} overflow="hidden" paddingLeft={1}>
                    <Box flexDirection="column" marginTop={-scrollOffset}>
                        {filtered.map((feature, index) => {
                            const isSelected = index === fieldIndex;
                            const isEnabled = enabledFeatures.has(feature.id);

                            return (
                                <Box flexShrink={0} height={1} key={feature.id}>
                                    <Text>{isSelected ? ">" : " "}</Text>
                                    <Text color={isEnabled ? "white" : "gray"}> {isEnabled ? "\u2611" : "\u2610"} </Text>
                                    <Box flexGrow={1}>
                                        <Text bold={isSelected} inverse={isSelected} wrap="truncate">
                                            {feature.name}
                                            <Text dimColor> -{feature.description}</Text>
                                        </Text>
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
                {showScrollbar && (
                    <Box flexShrink={0} marginLeft={1} marginRight={1}>
                        <ScrollBar contentHeight={contentHeight} placement="inset" scrollOffset={scrollOffset} style="block" viewportHeight={viewportHeight} />
                    </Box>
                )}
            </Box>

            {filtered.length === 0 && (
                <Box paddingX={1}>
                    <Text dimColor>No features match the search.</Text>
                </Box>
            )}
        </Box>
    );
};

export default FeaturesSection;
