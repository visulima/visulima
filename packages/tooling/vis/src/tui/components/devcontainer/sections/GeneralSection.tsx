import { Box, Text, TextInput } from "@visulima/tui";
import React from "react";

import type { DevcontainerConfig } from "../types";

const FIELDS = ["name", "image", "workspaceFolder", "remoteUser"] as const;

const FIELD_LABELS: Record<(typeof FIELDS)[number], string> = {
    image: "Image",
    name: "Name",
    remoteUser: "Remote User",
    workspaceFolder: "Workspace Folder",
};

const FIELD_PLACEHOLDERS: Record<(typeof FIELDS)[number], string> = {
    image: "mcr.microsoft.com/devcontainers/javascript-node:22",
    name: "My Dev Container",
    remoteUser: "node",
    workspaceFolder: "/workspaces/${localWorkspaceFolderBasename}",
};

interface GeneralSectionProps {
    readonly config: DevcontainerConfig;
    readonly fieldEditing: boolean;
    readonly fieldIndex: number;
    readonly onUpdate: (partial: Partial<DevcontainerConfig>) => void;
}

const GeneralSection = ({ config, fieldEditing, fieldIndex, onUpdate }: GeneralSectionProps): React.JSX.Element => (
    <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
            <Text bold color="cyan">General Configuration</Text>
        </Box>
        {FIELDS.map((field, index) => {
            const isSelected = index === fieldIndex;
            const value = (config[field] as string) ?? "";

            return (
                <Box key={field} marginBottom={index < FIELDS.length - 1 ? 1 : 0}>
                    <Box width={20}>
                        <Text bold={isSelected} color={isSelected ? "cyan" : "white"}>
                            {isSelected ? "\u276f " : "  "}
                            {FIELD_LABELS[field]}:
                        </Text>
                    </Box>
                    <Box flexGrow={1}>
                        {isSelected && fieldEditing ? (
                            <TextInput
                                defaultValue={value}
                                onChange={(newValue: string) => {
                                    onUpdate({ [field]: newValue });
                                }}
                                placeholder={FIELD_PLACEHOLDERS[field]}
                            />
                        ) : (
                            <Text color={value ? "white" : "gray"}>
                                {value || FIELD_PLACEHOLDERS[field]}
                            </Text>
                        )}
                    </Box>
                </Box>
            );
        })}
        <Box marginTop={1}>
            <Text dimColor>
                <Text bold color="white">Enter</Text> edit field
                {"  "}
                <Text bold color="white">{"\u2191\u2193"}</Text> navigate
                {"  "}
                <Text bold color="white">Esc</Text> stop editing
            </Text>
        </Box>
    </Box>
);

export const GENERAL_FIELD_COUNT: number = FIELDS.length;

export default GeneralSection;
