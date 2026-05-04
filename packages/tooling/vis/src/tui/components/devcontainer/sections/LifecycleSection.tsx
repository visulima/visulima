import { Box, Text, TextInput } from "@visulima/tui";
import React from "react";

import type { DevcontainerConfig } from "../types";

const HOOKS = ["postCreateCommand", "postStartCommand", "postAttachCommand", "onCreateCommand"] as const;

type LifecycleHook = (typeof HOOKS)[number];

const HOOK_LABELS: Record<LifecycleHook, string> = {
    onCreateCommand: "On Create",
    postAttachCommand: "Post Attach",
    postCreateCommand: "Post Create",
    postStartCommand: "Post Start",
};

const HOOK_DESCRIPTIONS: Record<LifecycleHook, string> = {
    onCreateCommand: "Runs once when the container is first created",
    postAttachCommand: "Runs each time the IDE attaches",
    postCreateCommand: "Runs after the container is created and workspace mounted",
    postStartCommand: "Runs each time the container starts",
};

interface LifecycleSectionProps {
    readonly config: DevcontainerConfig;
    readonly fieldEditing: boolean;
    readonly fieldIndex: number;
    readonly onSetCommand: (hook: LifecycleHook, command: string) => void;
}

const LifecycleSection = ({ config, fieldEditing, fieldIndex, onSetCommand }: LifecycleSectionProps): React.JSX.Element => (
    <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
            <Text bold color="cyan">
                Lifecycle Commands
            </Text>
        </Box>
        {HOOKS.map((hook, index) => {
            const isSelected = index === fieldIndex;
            const value = config[hook];
            const displayValue = Array.isArray(value) ? value.join(" && ") : (value ?? "");

            return (
                <Box flexDirection="column" key={hook} marginBottom={1}>
                    <Box>
                        <Text bold={isSelected} color={isSelected ? "cyan" : "white"}>
                            {isSelected ? "\u276F " : "  "}
                            {HOOK_LABELS[hook]}
                        </Text>
                    </Box>
                    <Box paddingLeft={4}>
                        <Text dimColor>{HOOK_DESCRIPTIONS[hook]}</Text>
                    </Box>
                    <Box paddingLeft={4}>
                        {isSelected && fieldEditing
                            ? (
                            <TextInput
                                defaultValue={displayValue}
                                onChange={(newValue: string) => {
                                    onSetCommand(hook, newValue);
                                }}
                                placeholder="e.g. npm install"
                            />
                            )
                            : (
                            <Text color={displayValue ? "green" : "gray"}>{displayValue || "(not set)"}</Text>
                            )}
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
                edit command
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

export const LIFECYCLE_FIELD_COUNT: number = HOOKS.length;

export default LifecycleSection;
