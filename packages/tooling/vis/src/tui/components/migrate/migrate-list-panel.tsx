import { Box } from "@visulima/tui/components/box";
import { ScrollBar } from "@visulima/tui/components/scroll-bar";
import { Text } from "@visulima/tui/components/text";
import React from "react";

import type { MigrateItem } from "./migrate-store";

interface MigrationRowProps {
    checked: boolean;
    isSelected: boolean;
    item: MigrateItem;
}

const MigrationRow = ({ checked, isSelected, item }: MigrationRowProps): React.JSX.Element => {
    const checkbox = checked ? "☑" : "☐";
    const previewCount = item.preview.length;

    return (
        <Box flexShrink={0} height={1}>
            <Text>{isSelected ? ">" : " "}</Text>
            <Text color={checked ? "white" : "gray"}>
{" "}
{checkbox}
{" "}
            </Text>
            <Box flexGrow={1}>
                <Text bold={isSelected} inverse={isSelected} wrap="truncate">
                    {item.entry.title}
                </Text>
            </Box>
            <Text dimColor>
                {" "}
                {previewCount}
{" "}
change
{previewCount === 1 ? "" : "s"}
{" "}
            </Text>
        </Box>
    );
};

interface MigrateListPanelProps {
    checkedItems: Set<string>;
    focused: boolean;
    isDryRun: boolean;
    items: MigrateItem[];
    scrollOffset: number;
    selectedIndex: number;
    viewportHeight: number;
}

const MigrateListPanel = ({
    checkedItems,
    focused,
    isDryRun,
    items,
    scrollOffset,
    selectedIndex,
    viewportHeight,
}: MigrateListPanelProps): React.JSX.Element => {
    const borderColor = focused ? "white" : "gray";
    const checkedCount = items.filter((item) => checkedItems.has(item.entry.id)).length;

    const rows: React.JSX.Element[] = items.map((item, index) => (
        <MigrationRow checked={checkedItems.has(item.entry.id)} isSelected={index === selectedIndex} item={item} key={item.entry.id} />
    ));

    const contentHeight = items.length;
    const showScrollbar = contentHeight > viewportHeight && viewportHeight > 0;

    return (
        <Box borderColor={borderColor} borderStyle="single" flexDirection="column" flexGrow={1}>
            <Box flexShrink={0} gap={1} paddingX={1}>
                <Text bold inverse>
                    {" MIGRATE "}
                </Text>
                <Text wrap="truncate">
{items.length}
{" "}
applicable
                </Text>
                {checkedCount > 0 && (
                    <Text dimColor>
                        {" — "}
                        {checkedCount}
                        {" selected"}
                    </Text>
                )}
                {isDryRun && <Text color="yellow">{" (dry-run)"}</Text>}
            </Box>

            <Box flexDirection="row" flexGrow={1} overflow="hidden">
                <Box flexDirection="column" flexGrow={1} overflow="hidden" paddingLeft={1}>
                    <Box flexDirection="column" marginTop={-scrollOffset}>
                        {rows}
                    </Box>
                </Box>
                {showScrollbar && (
                    <Box flexShrink={0} marginLeft={1} marginRight={1}>
                        <ScrollBar contentHeight={contentHeight} placement="inset" scrollOffset={scrollOffset} style="block" viewportHeight={viewportHeight} />
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default MigrateListPanel;
