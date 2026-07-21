/**
 * Ordered list component for Ink.
 *
 * Inspired by ink-ui OrderedList by Vadim Demedes.
 * @see https://github.com/vadimdemedes/ink-ui
 *
 * MIT License
 * Copyright (c) Vadym Demedes (github.com/vadimdemedes)
 */
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import type { ReactElement, ReactNode } from "react";

export type OrderedListEntry = {
    /**
     * Nested sub-items, rendered as a sub-list with hierarchical numbering.
     */
    readonly children?: ReadonlyArray<OrderedListEntry>;

    /**
     * Display text for this item.
     */
    readonly label: ReactNode;
};

export type Props = {
    /**
     * Entries to render as a numbered list.
     */
    readonly items: ReadonlyArray<OrderedListEntry>;
};

/**
 * Render a numbered list recursively with a parent marker prefix.
 */
const renderList = (items: ReadonlyArray<OrderedListEntry>, parentMarker: string): ReactElement => {
    const maxWidth = String(items.length).length;

    return (
        <Box flexDirection="column">
            {items.map((item, index) => {
                const paddedNumber = `${String(index + 1).padStart(maxWidth)}.`;
                const marker = `${parentMarker}${paddedNumber}`;

                return (
                    // eslint-disable-next-line react-x/no-array-index-key -- list entries have no unique key
                    <Box gap={1} key={index}>
                        <Text dimColor>{marker}</Text>
                        <Box flexDirection="column">
                            <Text>{item.label}</Text>
                            {item.children ? renderList(item.children, marker) : undefined}
                        </Box>
                    </Box>
                );
            })}
        </Box>
    );
};

/**
 * Renders a numbered list with hierarchical nesting support.
 */
export default function OrderedList({ items }: Props): ReactElement {
    return renderList(items, "");
}

export { OrderedList };
export type { Props as OrderedListProps };
