import type { ScrollViewRef } from "@visulima/tui";
import { Box, ScrollView, Text } from "@visulima/tui";
import React from "react";

import type { GraphNode } from "./GraphStore";

// ── Component ───────────────────────────────────────────────────────────

interface ProjectDetailPanelProps {
    focused: boolean;
    node: GraphNode | null;
    scrollRef?: React.RefObject<ScrollViewRef>;
}

const ProjectDetailPanel = ({ focused, node, scrollRef }: ProjectDetailPanelProps): React.JSX.Element => {
    const borderColor = focused ? "white" : "gray";

    if (!node) {
        return (
            <Box borderColor="gray" borderStyle="single" flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
                <Text dimColor>No project selected</Text>
            </Box>
        );
    }

    const isApp = node.type === "application";
    const typeColor = isApp ? "yellow" : "cyan";
    const typeLabel = isApp ? "Application" : "Library";

    return (
        <Box borderColor={borderColor} borderStyle="single" borderTopTitle={` ${node.name} `} borderTopRightTitle={` ${typeLabel} `} flexDirection="column" flexGrow={1}>
            <ScrollView ref={scrollRef} flexGrow={1} flexShrink={1} paddingX={2} scrollbar scrollbarColor="gray">
                {/* Dependencies section */}
                <Box flexDirection="column" marginTop={1}>
                    <Box>
                        <Text dimColor>{"\u2500\u2500 "}</Text>
                        <Text bold color="white">DEPENDS ON</Text>
                        <Text dimColor> ({node.deps.length})</Text>
                    </Box>
                    {node.deps.length === 0 ? (
                        <Box paddingLeft={2} marginTop={1}>
                            <Text dimColor>No dependencies</Text>
                        </Box>
                    ) : (
                        <Box flexDirection="column" marginTop={1}>
                            {node.deps.map((dep) => (
                                <Box key={dep.target} paddingLeft={2} gap={1}>
                                    <Text color="cyan">{"\u2192"}</Text>
                                    <Text>{dep.target}</Text>
                                    {dep.type !== "static" && <Text dimColor>({dep.type})</Text>}
                                </Box>
                            ))}
                        </Box>
                    )}
                </Box>

                {/* Reverse dependencies section */}
                <Box flexDirection="column" marginTop={1}>
                    <Box>
                        <Text dimColor>{"\u2500\u2500 "}</Text>
                        <Text bold color="white">REQUIRED BY</Text>
                        <Text dimColor> ({node.reverseDeps.length})</Text>
                    </Box>
                    {node.reverseDeps.length === 0 ? (
                        <Box paddingLeft={2} marginTop={1}>
                            <Text dimColor>No reverse dependencies</Text>
                        </Box>
                    ) : (
                        <Box flexDirection="column" marginTop={1}>
                            {node.reverseDeps.map((rdep) => (
                                <Box key={rdep} paddingLeft={2} gap={1}>
                                    <Text color="magenta">{"\u2190"}</Text>
                                    <Text>{rdep}</Text>
                                </Box>
                            ))}
                        </Box>
                    )}
                </Box>

                {/* Stats section */}
                <Box flexDirection="column" marginTop={1}>
                    <Box>
                        <Text dimColor>{"\u2500\u2500 "}</Text>
                        <Text bold color="white">INFO</Text>
                    </Box>
                    <Box marginTop={1} paddingLeft={2} flexDirection="column">
                        <Box>
                            <Box width={16}><Text dimColor>Type:</Text></Box>
                            <Text color={typeColor}>{typeLabel}</Text>
                        </Box>
                        <Box>
                            <Box width={16}><Text dimColor>Dependencies:</Text></Box>
                            <Text>{String(node.deps.length)}</Text>
                        </Box>
                        <Box>
                            <Box width={16}><Text dimColor>Required by:</Text></Box>
                            <Text>{String(node.reverseDeps.length)}</Text>
                        </Box>
                        <Box>
                            <Box width={16}><Text dimColor>Connectivity:</Text></Box>
                            <Text>{String(node.deps.length + node.reverseDeps.length)}</Text>
                        </Box>
                    </Box>
                </Box>
            </ScrollView>
        </Box>
    );
};

export default ProjectDetailPanel;
