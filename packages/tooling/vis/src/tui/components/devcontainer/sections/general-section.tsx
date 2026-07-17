import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { TextInput } from "@visulima/tui-components/text-input";
import React from "react";

import type { DevcontainerConfig } from "../types";

const FIELDS = ["name", "image", "workspaceFolder", "workspaceMount", "remoteUser", "containerUser", "shutdownAction"] as const;

const FIELD_LABELS: Record<(typeof FIELDS)[number], string> = {
    containerUser: "Container User",
    image: "Image",
    name: "Name",
    remoteUser: "Remote User",
    shutdownAction: "Shutdown Action",
    workspaceFolder: "Workspace Folder",
    workspaceMount: "Workspace Mount",
};

const FIELD_PLACEHOLDERS: Record<(typeof FIELDS)[number], string> = {
    containerUser: "root",
    image: "mcr.microsoft.com/devcontainers/javascript-node:22",
    name: "My Dev Container",
    remoteUser: "node",
    shutdownAction: "none | stopContainer",
    workspaceFolder: "/workspaces/${localWorkspaceFolderBasename}",
    workspaceMount: "source=${localWorkspaceFolder},target=...,type=bind",
};

const BOOLEAN_FIELDS = ["privileged", "overrideCommand"] as const;

const BOOLEAN_LABELS: Record<(typeof BOOLEAN_FIELDS)[number], string> = {
    overrideCommand: "Override Command",
    privileged: "Privileged",
};

const ALL_FIELD_COUNT = FIELDS.length + BOOLEAN_FIELDS.length;

interface GeneralSectionProps {
    readonly config: DevcontainerConfig;
    readonly fieldEditing: boolean;
    readonly fieldIndex: number;
    readonly onUpdate: (partial: Partial<DevcontainerConfig>) => void;
}

const GeneralSection = ({ config, fieldEditing, fieldIndex, onUpdate }: GeneralSectionProps): React.JSX.Element => (
    <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
            <Text bold color="cyan">
                General Configuration
            </Text>
        </Box>
        {FIELDS.map((field, index) => {
            const isSelected = index === fieldIndex;
            const value = (config[field] as string) ?? "";

            return (
                <Box key={field} marginBottom={1}>
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
                                defaultValue={value}
                                onChange={(newValue: string) => {
                                    onUpdate({ [field]: newValue });
                                }}
                                placeholder={FIELD_PLACEHOLDERS[field]}
                            />
                            )
                            : (
                            <Text color={value ? "white" : "gray"}>{value || FIELD_PLACEHOLDERS[field]}</Text>
                            )}
                    </Box>
                </Box>
            );
        })}
        {BOOLEAN_FIELDS.map((field, boolIndex) => {
            const absoluteIndex = FIELDS.length + boolIndex;
            const isSelected = absoluteIndex === fieldIndex;
            const value = config[field] ?? false;

            return (
                <Box key={field} marginBottom={boolIndex < BOOLEAN_FIELDS.length - 1 ? 1 : 0}>
                    <Box width={20}>
                        <Text bold={isSelected} color={isSelected ? "cyan" : "white"}>
                            {isSelected ? "\u276F " : "  "}
                            {BOOLEAN_LABELS[field]}
:
                        </Text>
                    </Box>
                    <Box flexGrow={1}>
                        <Text color={value ? "green" : "gray"}>
                            {value ? "yes" : "no"}
                            {isSelected && <Text dimColor> (Space to toggle)</Text>}
                        </Text>
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
                    Space
                </Text>
{" "}
                toggle
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

export const GENERAL_FIELD_COUNT: number = ALL_FIELD_COUNT;
export const GENERAL_BOOLEAN_FIELDS: ReadonlyArray<"privileged" | "overrideCommand"> = BOOLEAN_FIELDS;

export default GeneralSection;
