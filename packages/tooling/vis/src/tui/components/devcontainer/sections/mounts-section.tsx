import { Box, Text } from "@visulima/tui";
import React from "react";

import type { PackageManager } from "../catalogs/mount-suggestions";
import type { DevcontainerConfig, MountEntry } from "../types";

interface MountsSectionProps {
    readonly addingMount: boolean;
    readonly config: DevcontainerConfig;
    readonly detectedPm: PackageManager | null;
    readonly fieldIndex: number;
    readonly mountPhase: "source" | "target" | "type";
    readonly mountSource: string;
    readonly mountTarget: string;
    readonly mountType: "bind" | "tmpfs" | "volume";
    readonly suggestedMounts: MountEntry[];
}

const formatMount = (mount: MountEntry | string): string => {
    if (typeof mount === "string") {
        return mount;
    }

    return `[${mount.type}] ${mount.source} \u2192 ${mount.target}`;
};

const MountsSection = ({
    addingMount,
    config,
    detectedPm,
    fieldIndex,
    mountPhase,
    mountSource,
    mountTarget,
    mountType,
    suggestedMounts,
}: MountsSectionProps): React.JSX.Element => {
    const mounts = config.mounts ?? [];

    return (
        <Box flexDirection="column" paddingX={1}>
            <Box flexShrink={0} gap={1} paddingX={1}>
                <Text bold color="cyan">
                    {mounts.length}
{" "}
mounts
                </Text>
                {detectedPm && (
                    <Text dimColor>
                        — detected:
{" "}
<Text color="white">{detectedPm}</Text>
                    </Text>
                )}
            </Box>

            {/* Suggested mounts banner */}
            {suggestedMounts.length > 0 && !addingMount && (
                <Box borderColor="yellow" borderStyle="single" flexDirection="column" marginBottom={1} marginTop={1} paddingX={1}>
                    <Box flexShrink={0}>
                        <Text bold color="yellow">
                            Suggested mounts
                        </Text>
                        <Text dimColor>
                            {" "}
                            — press
{" "}
                            <Text bold color="white">
                                A
                            </Text>
{" "}
                            to add all
                        </Text>
                    </Box>
                    {suggestedMounts.map((mount, index) => (
                        <Box flexShrink={0} key={`suggestion-${String(index)}`}>
                            <Text dimColor wrap="truncate">
                                {"  + "}
                                {formatMount(mount)}
                            </Text>
                        </Box>
                    ))}
                </Box>
            )}

            {/* Current mounts */}
            {mounts.length > 0 && (
                <Box flexDirection="column" marginBottom={1}>
                    {mounts.map((mount, index) => {
                        const isSelected = index === fieldIndex;

                        return (
                            <Box flexShrink={0} height={1} key={`mount-${String(index)}`}>
                                <Text>{isSelected ? ">" : " "}</Text>
                                <Box flexGrow={1}>
                                    <Text bold={isSelected} inverse={isSelected} wrap="truncate">
                                        {" "}
                                        {formatMount(mount)}
                                    </Text>
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            )}

            {/* Add row */}
            {!addingMount && (
                <Box flexShrink={0}>
                    <Text color={fieldIndex === mounts.length ? "cyan" : "gray"} inverse={fieldIndex === mounts.length}>
                        {"   "}
+ Add mount...
                    </Text>
                </Box>
            )}

            {/* Interactive add form */}
            {addingMount && (
                <Box borderColor="cyan" borderStyle="single" flexDirection="column" marginTop={1} paddingX={1}>
                    <Box flexShrink={0} marginBottom={1}>
                        <Text bold color="cyan">
                            New Mount
                        </Text>
                    </Box>
                    <Box flexShrink={0}>
                        <Box width={12}>
                            <Text bold={mountPhase === "source"} color={mountPhase === "source" ? "cyan" : "white"}>
                                {mountPhase === "source" ? "\u276F " : "  "}
                                Source:
                            </Text>
                        </Box>
                        <Text color={mountSource ? "yellow" : "gray"}>
                            {mountSource || (mountPhase === "source" ? "_" : "(type source, Enter to continue)")}
                        </Text>
                    </Box>
                    <Box flexShrink={0}>
                        <Box width={12}>
                            <Text bold={mountPhase === "target"} color={mountPhase === "target" ? "cyan" : "white"}>
                                {mountPhase === "target" ? "\u276F " : "  "}
                                Target:
                            </Text>
                        </Box>
                        <Text color={mountTarget ? "yellow" : "gray"}>{mountTarget || (mountPhase === "target" ? "_" : "/container/path")}</Text>
                    </Box>
                    <Box flexShrink={0}>
                        <Box width={12}>
                            <Text bold={mountPhase === "type"} color={mountPhase === "type" ? "cyan" : "white"}>
                                {mountPhase === "type" ? "\u276F " : "  "}
                                Type:
                            </Text>
                        </Box>
                        {mountPhase === "type"
                            ? (
                            <Text>
                                <Text bold={mountType === "volume"} color={mountType === "volume" ? "cyan" : "gray"}>
                                    [1] volume
                                </Text>
                                {"  "}
                                <Text bold={mountType === "bind"} color={mountType === "bind" ? "cyan" : "gray"}>
                                    [2] bind
                                </Text>
                                {"  "}
                                <Text bold={mountType === "tmpfs"} color={mountType === "tmpfs" ? "cyan" : "gray"}>
                                    [3] tmpfs
                                </Text>
                            </Text>
                            )
                            : (
                            <Text color="gray">{mountType}</Text>
                            )}
                    </Box>
                    <Box flexShrink={0} marginTop={1}>
                        <Text dimColor wrap="truncate">
                            {mountPhase === "type" ? "1/2/3 select type, Enter confirm, Esc cancel" : "Type text, Enter next step, Esc cancel"}
                        </Text>
                    </Box>
                </Box>
            )}

            {mounts.length === 0 && !addingMount && suggestedMounts.length === 0 && (
                <Box marginTop={1}>
                    <Text dimColor>Tip: Use volume mounts for node_modules and caches to improve performance.</Text>
                </Box>
            )}
        </Box>
    );
};

export default MountsSection;
