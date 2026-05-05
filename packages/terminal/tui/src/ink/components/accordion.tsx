/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement, ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import type { LiteralUnion } from "type-fest";

import useFocus from "../hooks/use-focus";
import useInput from "../hooks/use-input";
import Box from "./box";
import Text from "./text";

export type AccordionItem = {
    /**
     * Content rendered when the item is expanded.
     */
    readonly content: ReactNode;

    /**
     * Unique identifier.
     */
    readonly id: string;

    /**
     * Header label.
     */
    readonly title: ReactNode;
};

export type Props = {
    /**
     * Accent color for the focused header.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * When true, multiple panels can be open at once.
     * @default false
     */
    readonly allowMultiple?: boolean;

    /**
     * Auto-focus the first item on mount.
     */
    readonly autoFocus?: boolean;

    /**
     * Initially open item ids.
     */
    readonly defaultExpanded?: ReadonlyArray<string>;

    /**
     * Disable interaction.
     */
    readonly isDisabled?: boolean;

    /**
     * List of panels.
     */
    readonly items: ReadonlyArray<AccordionItem>;
};

/**
 * Keyboard-navigable accordion. Use arrow keys to move between panels and
 * Enter / Space to toggle.
 * @returns A `ReactElement` rendering the accordion column.
 */
export default function Accordion({
    accentColor = "blue",
    allowMultiple = false,
    autoFocus = false,
    defaultExpanded,
    isDisabled = false,
    items,
}: Props): ReactElement {
    const { isFocused } = useFocus({ autoFocus, isActive: !isDisabled });
    const [expanded, setExpanded] = useState<ReadonlyArray<string>>(() => {
        if (defaultExpanded === undefined || defaultExpanded.length === 0) {
            return [];
        }

        // When `allowMultiple` is false the accordion only ever shows one open
        // panel — clamp the seed so the initial render matches that contract.
        if (!allowMultiple) {
            return defaultExpanded.slice(0, 1);
        }

        return defaultExpanded;
    });
    const [focusedIndex, setFocusedIndex] = useState(0);
    const focusedIndexRef = useRef(focusedIndex);

    focusedIndexRef.current = focusedIndex;

    const toggle = useCallback(
        (id: string) => {
            setExpanded((previous) => {
                const isOpen = previous.includes(id);

                if (allowMultiple) {
                    return isOpen ? previous.filter((x) => x !== id) : [...previous, id];
                }

                return isOpen ? [] : [id];
            });
        },
        [allowMultiple],
    );

    useInput(
        useCallback(
            (input, key) => {
                if (!isFocused) {
                    return;
                }

                const total = items.length;

                if ((key.downArrow || input === "j") && focusedIndexRef.current < total - 1) {
                    setFocusedIndex(focusedIndexRef.current + 1);
                } else if ((key.upArrow || input === "k") && focusedIndexRef.current > 0) {
                    setFocusedIndex(focusedIndexRef.current - 1);
                } else if (key.return || input === " ") {
                    const target = items[focusedIndexRef.current];

                    if (target) {
                        toggle(target.id);
                    }
                }
            },
            [isFocused, items, toggle],
        ),
        { isActive: !isDisabled && isFocused },
    );

    return (
        <Box flexDirection="column">
            {items.map((item, index) => {
                const isOpen = expanded.includes(item.id);
                const isItemFocused = isFocused && index === focusedIndex;
                const color = isItemFocused ? accentColor : undefined;

                return (
                    <Box flexDirection="column" key={item.id}>
                        <Box>
                            <Text color={color} dimColor={isDisabled}>
                                {isItemFocused ? "▸ " : "  "}
                                {isOpen ? "▼ " : "▶ "}
                            </Text>
                            <Text bold={isItemFocused} color={color} dimColor={isDisabled}>
                                {item.title}
                            </Text>
                        </Box>
                        {isOpen ? (
                            <Box flexDirection="column" marginBottom={1} marginLeft={4}>
                                {item.content}
                            </Box>
                        ) : undefined}
                    </Box>
                );
            })}
        </Box>
    );
}
