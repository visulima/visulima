import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import React from "react";

import type { DevcontainerConfig } from "../types";

interface EnvironmentSectionProps {
    readonly config: DevcontainerConfig;
    readonly fieldIndex: number;
}

/**
 * Renders the environment-variable list for the devcontainer editor.
 *
 * Layout:
 * - `fieldIndex 0..containerCount-1`  → containerEnv entries.
 * - `fieldIndex containerCount`       → "+ Add container env..." row.
 * - `fieldIndex containerCount+1..`   → remoteEnv entries.
 * - `fieldIndex last`                 → "+ Add remote env..." row.
 */
const EnvironmentSection = ({ config, fieldIndex }: EnvironmentSectionProps): React.JSX.Element => {
    const containerEnv = config.containerEnv ?? {};
    const remoteEnv = config.remoteEnv ?? {};
    const containerKeys = Object.keys(containerEnv);
    const remoteKeys = Object.keys(remoteEnv);

    // Boundaries
    const containerAddIndex = containerKeys.length;
    const remoteStart = containerKeys.length + 1;
    const remoteAddIndex = remoteStart + remoteKeys.length;

    const isInContainerSection = fieldIndex <= containerAddIndex;
    const isInRemoteSection = fieldIndex > containerAddIndex;

    return (
        <Box flexDirection="column" paddingX={1}>
            {/* Container Environment */}
            <Box borderColor={isInContainerSection ? "cyan" : "gray"} borderStyle="single" flexDirection="column" paddingX={1} paddingY={0}>
                <Box flexShrink={0} marginBottom={containerKeys.length > 0 ? 1 : 0}>
                    <Text bold color={isInContainerSection ? "cyan" : "white"}>
                        containerEnv
                    </Text>
                    <Text dimColor> — baked into the container image</Text>
                </Box>
                {containerKeys.map((key, index) => {
                    const isSelected = index === fieldIndex;

                    return (
                        <Box flexShrink={0} key={key}>
                            <Text color={isSelected ? "cyan" : undefined} inverse={isSelected} wrap="truncate">
                                {isSelected ? " \u276F " : "   "}
                                <Text bold>{key}</Text>
                                <Text dimColor> = </Text>
                                <Text>{containerEnv[key]}</Text>
                            </Text>
                        </Box>
                    );
                })}
                <Box flexShrink={0} marginTop={containerKeys.length > 0 ? 1 : 0}>
                    <Text color={fieldIndex === containerAddIndex ? "cyan" : "gray"} inverse={fieldIndex === containerAddIndex}>
                        {"   "}
+ Add variable...
                    </Text>
                </Box>
            </Box>

            {/* Remote Environment */}
            <Box borderColor={isInRemoteSection ? "cyan" : "gray"} borderStyle="single" flexDirection="column" marginTop={1} paddingX={1} paddingY={0}>
                <Box flexShrink={0} marginBottom={remoteKeys.length > 0 ? 1 : 0}>
                    <Text bold color={isInRemoteSection ? "cyan" : "white"}>
                        remoteEnv
                    </Text>
                    <Text dimColor> — set at runtime by the IDE</Text>
                </Box>
                {remoteKeys.map((key, remoteIdx) => {
                    const actualIndex = remoteStart + remoteIdx;
                    const isSelected = actualIndex === fieldIndex;

                    return (
                        <Box flexShrink={0} key={key}>
                            <Text color={isSelected ? "cyan" : undefined} inverse={isSelected} wrap="truncate">
                                {isSelected ? " \u276F " : "   "}
                                <Text bold>{key}</Text>
                                <Text dimColor> = </Text>
                                <Text>{remoteEnv[key]}</Text>
                            </Text>
                        </Box>
                    );
                })}
                <Box flexShrink={0} marginTop={remoteKeys.length > 0 ? 1 : 0}>
                    <Text color={fieldIndex === remoteAddIndex ? "cyan" : "gray"} inverse={fieldIndex === remoteAddIndex}>
                        {"   "}
+ Add variable...
                    </Text>
                </Box>
            </Box>

            <Box flexShrink={0} marginTop={1}>
                <Text dimColor wrap="truncate">
                    <Text bold color="white">
                        a
                    </Text>
                    /
                    <Text bold color="white">
                        Enter
                    </Text>
{" "}
                    add on + row
{" "}
                    <Text bold color="white">
                        d
                    </Text>
{" "}
                    remove
{" "}
                    <Text bold color="white">
                        {"\u2191\u2193"}
                    </Text>
{" "}
                    navigate
                </Text>
            </Box>
        </Box>
    );
};

export const getEnvFieldCount = (config: DevcontainerConfig): number => {
    const containerCount = Object.keys(config.containerEnv ?? {}).length;
    const remoteCount = Object.keys(config.remoteEnv ?? {}).length;

    // containerEnv entries + add row + remoteEnv entries + add row
    return containerCount + 1 + remoteCount + 1;
};

export default EnvironmentSection;
