/**
 * Unordered list component for Ink.
 *
 * Inspired by ink-ui UnorderedList by Vadim Demedes.
 * @see https://github.com/vadimdemedes/ink-ui
 *
 * MIT License
 * Copyright (c) Vadym Demedes (github.com/vadimdemedes)
 */
import type { ReactElement, ReactNode } from "react";

import Box from "./box";
import Text from "./text";

const DEFAULT_MARKERS: ReadonlyArray<string> = ["─", "◦", "▪"];

export type UnorderedListEntry = {
    /**
     * Content of the list entry. Can be a string or nested list.
     */
    readonly children?: ReadonlyArray<UnorderedListEntry>;

    /**
     * Display text for this item.
     */
    readonly label: ReactNode;
};

export type Props = {
    /**
     * Entries to render as a bullet list.
     */
    readonly items: ReadonlyArray<UnorderedListEntry>;

    /**
     * Custom bullet symbol(s). A string uses the same symbol at all depths.
     * An array cycles through symbols by nesting depth.
     */
    readonly marker?: ReadonlyArray<string> | string;
};

/**
 * Resolve the markers array from the prop value.
 */
const resolveMarkers = (marker: ReadonlyArray<string> | string | undefined): ReadonlyArray<string> => {
    if (typeof marker === "string") {
        return [marker];
    }

    if (Array.isArray(marker)) {
        return marker;
    }

    return DEFAULT_MARKERS;
};

/**
 * Render a list recursively at the given depth.
 */
const renderList = (items: ReadonlyArray<UnorderedListEntry>, markers: ReadonlyArray<string>, depth: number): ReactElement => {
    const resolvedMarker = markers[depth % markers.length] ?? "─";

    return (
        <Box flexDirection="column">
            {items.map((item, index) => (
                // eslint-disable-next-line react-x/no-array-index-key -- list entries have no unique key
                <Box gap={1} key={index}>
                    <Text dimColor>{resolvedMarker}</Text>
                    <Box flexDirection="column">
                        <Text>{item.label}</Text>
                        {item.children ? renderList(item.children, markers, depth + 1) : undefined}
                    </Box>
                </Box>
            ))}
        </Box>
    );
};

/**
 * Renders a bullet list with nesting support.
 */
export default function UnorderedList({ items, marker }: Props): ReactElement {
    const markers = resolveMarkers(marker);

    return renderList(items, markers, 0);
}

export { UnorderedList };
export type { Props as UnorderedListProps };
