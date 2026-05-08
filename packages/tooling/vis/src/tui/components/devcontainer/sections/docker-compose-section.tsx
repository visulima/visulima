import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { TextInput } from "@visulima/tui/components/text-input";
import React from "react";

import type { DevcontainerConfig } from "../types";

const FIELDS = ["dockerComposeFile", "service"] as const;

type ComposeField = (typeof FIELDS)[number];

const FIELD_LABELS: Record<ComposeField, string> = {
    dockerComposeFile: "Compose File",
    service: "Service",
};

const FIELD_PLACEHOLDERS: Record<ComposeField, string> = {
    dockerComposeFile: "docker-compose.yml",
    service: "app",
};

const FIELD_DESCRIPTIONS: Record<ComposeField, string> = {
    dockerComposeFile: "Path to Docker Compose file (relative to .devcontainer/)",
    service: "Which service in the compose file to connect the IDE to",
};

interface DockerComposeSectionProps {
    readonly config: DevcontainerConfig;
    readonly fieldEditing: boolean;
    readonly fieldIndex: number;
    readonly onUpdate: (partial: Partial<DevcontainerConfig>) => void;
}

const DockerComposeSection = ({ config, fieldEditing, fieldIndex, onUpdate }: DockerComposeSectionProps): React.JSX.Element => {
    const hasCompose = Boolean(config.dockerComposeFile);
    const hasImage = Boolean(config.image || config.build);

    return (
        <Box flexDirection="column" paddingX={1}>
            <Box marginBottom={1}>
                <Text bold color="cyan">
                    Docker Compose Integration
                </Text>
            </Box>
            {hasImage && hasCompose && (
                <Box marginBottom={1}>
                    <Text color="yellow">Note: When using Docker Compose, the image/build settings in General are ignored.</Text>
                </Box>
            )}
            {FIELDS.map((field, index) => {
                const isSelected = index === fieldIndex;
                const value = (config[field] as string) ?? "";
                const displayValue = Array.isArray(config[field]) ? (config[field] as string[]).join(", ") : value;

                return (
                    <Box flexDirection="column" key={field} marginBottom={1}>
                        <Box>
                            <Box width={20}>
                                <Text bold={isSelected} color={isSelected ? "cyan" : "white"}>
                                    {isSelected ? "\u276F " : "  "}
                                    {FIELD_LABELS[field]}
:
                                </Text>
                            </Box>
                            <Box flexGrow={1}>
                                {isSelected && fieldEditing
                                    ? (
                                    <TextInput
                                        defaultValue={displayValue}
                                        onChange={(newValue: string) => {
                                            onUpdate({ [field]: newValue || undefined });
                                        }}
                                        placeholder={FIELD_PLACEHOLDERS[field]}
                                    />
                                    )
                                    : (
                                    <Text color={displayValue ? "white" : "gray"}>{displayValue || FIELD_PLACEHOLDERS[field]}</Text>
                                    )}
                            </Box>
                        </Box>
                        <Box paddingLeft={4}>
                            <Text dimColor>{FIELD_DESCRIPTIONS[field]}</Text>
                        </Box>
                    </Box>
                );
            })}
            <Box marginTop={1}>
                <Text dimColor>
                    <Text bold color="white">
                        Enter
                    </Text>
{" "}
                    edit field
                    {"  "}
                    <Text bold color="white">
                        {"\u2191\u2193"}
                    </Text>
{" "}
                    navigate
                    {"  "}
                    <Text bold color="white">
                        Esc
                    </Text>
{" "}
                    stop editing
                </Text>
            </Box>
        </Box>
    );
};

export const COMPOSE_FIELD_COUNT: number = FIELDS.length;

export default DockerComposeSection;
