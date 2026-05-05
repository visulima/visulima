import { Box, Text } from "@visulima/tui";
import React from "react";

import type { DevcontainerConfig } from "../types";

interface PortsSectionProps {
    readonly addingPort: boolean;
    readonly addPortValue: string;
    readonly config: DevcontainerConfig;
    readonly fieldIndex: number;
}

const PortsSection = ({ addingPort, addPortValue, config, fieldIndex }: PortsSectionProps): React.JSX.Element => {
    const ports = config.forwardPorts ?? [];

    // Last "field" is the "add new" row
    const isAddRowSelected = fieldIndex === ports.length;

    return (
        <Box flexDirection="column" paddingX={1}>
            <Box marginBottom={1}>
                <Text bold color="cyan">
                    Forwarded Ports
                </Text>
                <Text dimColor>
{" "}
(
{ports.length}
{" "}
ports)
                </Text>
            </Box>
            {ports.map((port, index) => {
                const isSelected = index === fieldIndex;

                return (
                    <Box key={`port-${String(port)}`}>
                        <Text color={isSelected ? "cyan" : undefined} inverse={isSelected}>
                            {"  "}
                            {String(port)}
                        </Text>
                    </Box>
                );
            })}
            <Box marginTop={ports.length > 0 ? 1 : 0}>
                <Text color={isAddRowSelected ? "cyan" : "gray"} inverse={isAddRowSelected}>
                    {"  "}
                    {isAddRowSelected && addingPort
                        ? (
                        <Text>
                            Enter port:
{" "}
<Text color="yellow">{addPortValue || "_"}</Text>
                        </Text>
                        )
                        : (
                            "+ Add port..."
                        )}
                </Text>
            </Box>
            <Box marginTop={1}>
                <Text dimColor>
                    <Text bold color="white">
                        Enter
                    </Text>
{" "}
                    {isAddRowSelected ? "type port number, Enter to confirm" : "select"}
                    {"  "}
                    <Text bold color="white">
                        d
                    </Text>
{" "}
                    remove selected
                    {"  "}
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

export default PortsSection;
