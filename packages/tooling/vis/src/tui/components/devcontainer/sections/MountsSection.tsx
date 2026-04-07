import { Box, Text } from "@visulima/tui";
import React from "react";

import type { DevcontainerConfig, MountEntry } from "../types";

interface MountsSectionProps {
    readonly addingMount: boolean;
    readonly config: DevcontainerConfig;
    readonly fieldIndex: number;
    readonly mountPhase: "source" | "target" | "type";
    readonly mountSource: string;
    readonly mountTarget: string;
    readonly mountType: "bind" | "tmpfs" | "volume";
}

const formatMount = (mount: MountEntry | string): string => {
    if (typeof mount === "string") {
        return mount;
    }

    return `[${mount.type}] ${mount.source} \u2192 ${mount.target}`;
};

const MountsSection = ({ addingMount, config, fieldIndex, mountPhase, mountSource, mountTarget, mountType }: MountsSectionProps): React.JSX.Element => {
    const mounts = config.mounts ?? [];

    return (
        <Box flexDirection="column" paddingX={1}>
            <Box flexShrink={0} marginBottom={1}>
                <Text bold color="cyan">Volume Mounts</Text>
                <Text dimColor> ({mounts.length} mounts)</Text>
            </Box>
            {mounts.length > 0 && (
                <Box flexDirection="column" marginBottom={1}>
                    {mounts.map((mount, index) => {
                        const isSelected = index === fieldIndex;

                        return (
                            <Box flexShrink={0} key={`mount-${String(index)}`}>
                                <Text color={isSelected ? "cyan" : undefined} inverse={isSelected} wrap="truncate">
                                    {isSelected ? " \u276f " : "   "}
                                    {formatMount(mount)}
                                </Text>
                            </Box>
                        );
                    })}
                </Box>
            )}
            {/* Add row */}
            {!addingMount && (
                <Box flexShrink={0}>
                    <Text
                        color={fieldIndex === mounts.length ? "cyan" : "gray"}
                        inverse={fieldIndex === mounts.length}
                    >
                        {"   "}+ Add mount...
                    </Text>
                </Box>
            )}
            {/* Interactive add form */}
            {addingMount && (
                <Box borderColor="cyan" borderStyle="single" flexDirection="column" marginTop={1} paddingX={1}>
                    <Box flexShrink={0} marginBottom={1}>
                        <Text bold color="cyan">New Mount</Text>
                    </Box>
                    <Box flexShrink={0}>
                        <Box width={12}>
                            <Text bold={mountPhase === "source"} color={mountPhase === "source" ? "cyan" : "white"}>
                                {mountPhase === "source" ? "\u276f " : "  "}Source:
                            </Text>
                        </Box>
                        <Text color={mountSource ? "yellow" : "gray"}>
                            {mountSource || (mountPhase === "source" ? "_" : "(type source, Enter to continue)")}
                        </Text>
                    </Box>
                    <Box flexShrink={0}>
                        <Box width={12}>
                            <Text bold={mountPhase === "target"} color={mountPhase === "target" ? "cyan" : "white"}>
                                {mountPhase === "target" ? "\u276f " : "  "}Target:
                            </Text>
                        </Box>
                        <Text color={mountTarget ? "yellow" : "gray"}>
                            {mountTarget || (mountPhase === "target" ? "_" : "/container/path")}
                        </Text>
                    </Box>
                    <Box flexShrink={0}>
                        <Box width={12}>
                            <Text bold={mountPhase === "type"} color={mountPhase === "type" ? "cyan" : "white"}>
                                {mountPhase === "type" ? "\u276f " : "  "}Type:
                            </Text>
                        </Box>
                        {mountPhase === "type" ? (
                            <Text>
                                <Text bold={mountType === "volume"} color={mountType === "volume" ? "cyan" : "gray"}>[1] volume</Text>
                                {"  "}
                                <Text bold={mountType === "bind"} color={mountType === "bind" ? "cyan" : "gray"}>[2] bind</Text>
                                {"  "}
                                <Text bold={mountType === "tmpfs"} color={mountType === "tmpfs" ? "cyan" : "gray"}>[3] tmpfs</Text>
                            </Text>
                        ) : (
                            <Text color="gray">{mountType}</Text>
                        )}
                    </Box>
                    <Box flexShrink={0} marginTop={1}>
                        <Text dimColor wrap="truncate">
                            {mountPhase === "type"
                                ? "1/2/3 select type, Enter confirm, Esc cancel"
                                : "Type text, Enter next step, Esc cancel"}
                        </Text>
                    </Box>
                </Box>
            )}
            {mounts.length === 0 && !addingMount && (
                <Box marginTop={1}>
                    <Text dimColor>
                        Tip: Use volume mounts for node_modules and caches to improve performance.
                    </Text>
                </Box>
            )}
            <Box flexShrink={0} marginTop={1}>
                <Text dimColor wrap="truncate">
                    <Text bold color="white">a</Text>/<Text bold color="white">Enter</Text> add mount  <Text bold color="white">d</Text> remove  <Text bold color="white">{"\u2191\u2193"}</Text> navigate
                </Text>
            </Box>
        </Box>
    );
};

export default MountsSection;
