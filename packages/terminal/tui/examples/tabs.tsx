/* eslint-disable @typescript-eslint/no-confusing-void-expression */
// @ts-nocheck

/**
 * tabs.tsx - &lt;Tab> / &lt;Tabs> component demo
 *
 * Controls:
 *   Left/Right  switch tab
 *   q / Esc     quit
 *
 * Run: node --import @oxc-node/core/register examples/tabs.tsx
 */

import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Tab } from "@visulima/tui/components/tab";
import { Tabs } from "@visulima/tui/components/tabs";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import React, { useState } from "react";

const App = () => {
    const { exit } = useApp();
    const [activeTab, setActiveTab] = useState("dashboard");

    useInput((input, key) => {
        if (key.escape || input === "q") {
            exit();
        }
    });

    return (
        <Box flexDirection="column" gap={1}>
            <Text bold color="cyan">
                Tabs demo
            </Text>
            <Text dim>Left/Right to switch tabs - q to quit</Text>

            <Box borderColor="blue" borderStyle="round" flexDirection="column" paddingX={2} paddingY={1}>
                <Tabs colors={{ activeTab: { backgroundColor: "black", color: "cyan" } }} onChange={(name) => setActiveTab(name)}>
                    <Tab name="dashboard">Dashboard</Tab>
                    <Tab name="logs">Logs</Tab>
                    <Tab name="settings">Settings</Tab>
                </Tabs>

                <Box marginTop={1}>
                    {activeTab === "dashboard" && (
                        <Box flexDirection="column">
                            <Text bold>Dashboard</Text>
                            <Text>CPU: 42% | Memory: 1.2 GB / 4 GB</Text>
                            <Text>Uptime: 3d 14h 22m</Text>
                        </Box>
                    )}
                    {activeTab === "logs" && (
                        <Box flexDirection="column">
                            <Text bold>Recent Logs</Text>
                            <Text color="green">[INFO] Server started on port 3000</Text>
                            <Text color="yellow">[WARN] Slow query detected (2.3s)</Text>
                            <Text color="green">[INFO] Health check passed</Text>
                        </Box>
                    )}
                    {activeTab === "settings" && (
                        <Box flexDirection="column">
                            <Text bold>Settings</Text>
                            <Text>Theme: dark</Text>
                            <Text>Notifications: enabled</Text>
                            <Text>Auto-refresh: 5s</Text>
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
};

render(<App />);
