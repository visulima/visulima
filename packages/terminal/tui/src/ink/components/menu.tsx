/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LiteralUnion } from "type-fest";

import useFocus from "../hooks/use-focus";
import useInput from "../hooks/use-input";
import Box from "./box";
import Text from "./text";

export type MenuItem = {
    /**
     * Optional hotkey rendered on the right side of the row (e.g. `"Ctrl+S"`).
     */
    readonly hotkey?: string;

    /**
     * Optional icon rendered before the label.
     */
    readonly icon?: ReactNode;

    /**
     * Identifier returned by `onSelect`.
     */
    readonly id: string;

    /**
     * When true, renders the item dimmed and skips it during navigation.
     */
    readonly isDisabled?: boolean;

    /**
     * Human-readable label.
     */
    readonly label: ReactNode;
};

export type MenuSection = {
    readonly id: string;
    readonly items: ReadonlyArray<MenuItem>;
    readonly title?: string;
};

export type Props = {
    /**
     * Accent color for the focused item.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Auto-focus the menu on mount.
     */
    readonly autoFocus?: boolean;

    /**
     * Render a border around the menu.
     * @default true
     */
    readonly bordered?: boolean;

    /**
     * Flat list of items. Ignored if `sections` is provided.
     */
    readonly items?: ReadonlyArray<MenuItem>;

    /**
     * Called with the item id when the user presses Enter.
     */
    readonly onSelect: (id: string) => void;

    /**
     * Grouped items. Takes precedence over `items`.
     */
    readonly sections?: ReadonlyArray<MenuSection>;

    /**
     * Optional title rendered at the top of the menu.
     */
    readonly title?: string;
};

type FlatRow =
    | { readonly item: MenuItem; readonly kind: "item"; readonly sectionId: string | undefined }
    | { readonly kind: "section-header"; readonly sectionId: string; readonly title: string };

const flatten = (items: ReadonlyArray<MenuItem> | undefined, sections: ReadonlyArray<MenuSection> | undefined): ReadonlyArray<FlatRow> => {
    if (sections && sections.length > 0) {
        const rows: FlatRow[] = [];

        for (const section of sections) {
            if (section.title !== undefined) {
                rows.push({ kind: "section-header", sectionId: section.id, title: section.title });
            }

            for (const item of section.items) {
                rows.push({ item, kind: "item", sectionId: section.id });
            }
        }

        return rows;
    }

    return (items ?? []).map((item) => ({ item, kind: "item", sectionId: undefined }) as const);
};

const findNextIndex = (rows: ReadonlyArray<FlatRow>, from: number, direction: 1 | -1): number => {
    const total = rows.length;

    if (total === 0) {
        return from;
    }

    for (let step = 1; step <= total; step += 1) {
        const candidate = (from + direction * step + total * step) % total;
        const row = rows[candidate];

        if (row?.kind === "item" && !row.item.isDisabled) {
            return candidate;
        }
    }

    return from;
};

const firstEnabledIndex = (rows: ReadonlyArray<FlatRow>): number => {
    for (const [index, row] of rows.entries()) {
        if (row.kind === "item" && !row.item.isDisabled) {
            return index;
        }
    }

    return 0;
};

/**
 * Dropdown / context menu with optional sections and disabled items.
 * Keyboard: ↑/↓ (or j/k) to navigate, Enter to select, Esc to cancel.
 * @returns A `ReactElement` rendering the menu, optionally wrapped in a
 * rounded border when `bordered` is true.
 */
export default function Menu({ accentColor = "blue", autoFocus = false, bordered = true, items, onSelect, sections, title }: Props): ReactElement {
    const { isFocused } = useFocus({ autoFocus });
    const rows = useMemo(() => flatten(items, sections), [items, sections]);
    const initialIndex = useMemo(() => firstEnabledIndex(rows), [rows]);
    const [focusedIndex, setFocusedIndex] = useState(initialIndex);
    const focusedIndexRef = useRef(focusedIndex);

    focusedIndexRef.current = focusedIndex;

    // Re-clamp focus when the set of rows changes underneath us — otherwise a
    // stale index can land on a removed/disabled row and Enter hits nothing.
    useEffect(() => {
        const { current } = focusedIndexRef;
        const row = rows[current];
        const stillValid = row?.kind === "item" && !row.item.isDisabled;

        // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- re-clamp on row prop changes; not an event response
        if (!stillValid) {
            const next = firstEnabledIndex(rows);

            // eslint-disable-next-line react-x/set-state-in-effect, react-you-might-not-need-an-effect/no-derived-state -- focusedIndex is also driven by keystrokes via ref; cannot be derived during render
            setFocusedIndex(next);
            focusedIndexRef.current = next;
        }
    }, [rows]);

    useInput(
        useCallback(
            (input, key) => {
                if (!isFocused) {
                    return;
                }

                if (key.downArrow || input === "j") {
                    setFocusedIndex(findNextIndex(rows, focusedIndexRef.current, 1));
                } else if (key.upArrow || input === "k") {
                    setFocusedIndex(findNextIndex(rows, focusedIndexRef.current, -1));
                } else if (key.return) {
                    const row = rows[focusedIndexRef.current];

                    if (row?.kind === "item" && !row.item.isDisabled) {
                        onSelect(row.item.id);
                    }
                }
            },
            [isFocused, rows, onSelect],
        ),
        { isActive: isFocused },
    );

    const content = (
        <Box flexDirection="column">
            {title === undefined ? undefined : (
                <Box marginBottom={1}>
                    <Text bold color={accentColor}>
                        {title}
                    </Text>
                </Box>
            )}
            {rows.map((row, index) => {
                if (row.kind === "section-header") {
                    return (
                        <Box key={`header:${row.sectionId}`} marginTop={index === 0 ? 0 : 1}>
                            <Text dimColor>{row.title.toUpperCase()}</Text>
                        </Box>
                    );
                }

                const { item } = row;
                const isRowFocused = isFocused && index === focusedIndex;
                const color = isRowFocused ? accentColor : undefined;

                return (
                    <Box key={`item:${item.id}`}>
                        <Text color={color} dimColor={item.isDisabled}>
                            {isRowFocused ? "▸ " : "  "}
                        </Text>
                        {item.icon === undefined ? undefined : (
                            <Text color={color} dimColor={item.isDisabled}>
                                {item.icon}{" "}
                            </Text>
                        )}
                        <Box flexGrow={1} flexShrink={1} minWidth={0}>
                            <Text bold={isRowFocused} color={color} dimColor={item.isDisabled} wrap="truncate-end">
                                {item.label}
                            </Text>
                        </Box>
                        {item.hotkey === undefined ? undefined : (
                            <Box flexShrink={0}>
                                <Text dimColor> {item.hotkey}</Text>
                            </Box>
                        )}
                    </Box>
                );
            })}
        </Box>
    );

    if (!bordered) {
        return content;
    }

    return (
        <Box borderColor={isFocused ? accentColor : undefined} borderStyle="round" paddingX={1}>
            {content}
        </Box>
    );
}
