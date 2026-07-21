/**
 * layout-components.tsx — Card, Heading, Paragraph, Kbd, Tag, Breadcrumb, LoadingIndicator
 *
 * Run: node --import @oxc-node/core/register examples/layout-components.tsx
 */
import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import { Breadcrumb } from "@visulima/tui-kit/breadcrumb";
import { Card } from "@visulima/tui-kit/card";
import { Heading } from "@visulima/tui-kit/heading";
import { Kbd } from "@visulima/tui-kit/kbd";
import { LoadingIndicator } from "@visulima/tui-kit/loading-indicator";
import { Paragraph } from "@visulima/tui-kit/paragraph";
import { Tag } from "@visulima/tui-kit/tag";
import React from "react";

const App = () => {
    const { exit } = useApp();

    useInput((_input, key) => {
        if (key.escape) {
            exit();
        }
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Heading>Layout components</Heading>
            <Heading level={3}>Cards, tags, keys</Heading>
            <Breadcrumb items={[{ label: "Home" }, { label: "Docs" }, { label: "Components" }, { label: "Layout" }]} />
            <Card
                headerRight={(
                    <Tag icon="✨" variant="solid">
                        new
                    </Tag>
                  )}
                subtitle="A bordered container with title and optional footer"
                title="Card component"
                width={60}
            >
                <Paragraph>
                    Cards group related content. They accept a title, subtitle, right-aligned header content, and a footer. Press
{" "}
<Kbd>Esc</Kbd>
{" "}
to quit.
                </Paragraph>
                <Box gap={1}>
                    <Tag color="green">stable</Tag>
                    <Tag color="yellow" variant="outline">
                        beta
                    </Tag>
                    <Tag color="magenta" variant="subtle">
                        preview
                    </Tag>
                </Box>
            </Card>
            <Box gap={2}>
                <LoadingIndicator color="cyan">Fetching…</LoadingIndicator>
                <LoadingIndicator color="yellow" type="bouncingBar">
                    Indexing…
                </LoadingIndicator>
            </Box>
            <Box gap={1}>
                <Text>Shortcuts: </Text>
                <Kbd>Ctrl</Kbd>
                <Text dimColor>+</Text>
                <Kbd>S</Kbd>
                <Text dimColor> / </Text>
                <Kbd variant="outline">Esc</Kbd>
            </Box>
        </Box>
    );
};

render(<App />);
