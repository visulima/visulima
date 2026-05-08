/* eslint-disable react/function-component-definition */

/**
 * Select input component for Ink.
 *
 * Based on ink-select-input by Vadim Demedes.
 * @see https://github.com/vadimdemedes/ink-select-input
 *
 * MIT License
 * Copyright (c) Vadym Demedes (github.com/vadimdemedes)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in the
 * Software without restriction, including without limitation the rights to use, copy,
 * modify, merge, publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so, subject to the
 * following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import { isDeepStrictEqual } from "node:util";

import type { AnsiColors } from "@visulima/colorize";
import type { FC, ReactElement } from "react";
import { createElement, useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { LiteralUnion } from "type-fest";

import useInput from "../ink/hooks/use-input";
import useWindowSize from "../ink/hooks/use-window-size";
import Box from "./box";
import type { Props as IndicatorProps } from "./select-input-indicator";
import SelectInputIndicator from "./select-input-indicator";
import type { Props as ItemProps } from "./select-input-item";
import SelectInputItem from "./select-input-item";
import Text from "./text";

export type Item<V> = {
    /**
     * Called automatically when this item is selected (via Enter or number key).
     * Fires after `onSelect`. Useful for defining per-item behavior inline.
     */
    readonly action?: () => void;
    readonly key?: string;
    readonly label: string;
    readonly value: V;
};

export type SeparatorItem = {
    /**
     * Marks this entry as a non-focusable separator line.
     */
    readonly isSeparator: true;
    readonly key?: string;

    /**
     * Custom separator text. Defaults to `"───"`.
     */
    readonly label?: string;
};

export type SelectInputEntry<V> = Item<V> | SeparatorItem;

/**
 * Type guard: returns `true` if the entry is a separator.
 */
const isSeparator = <V,>(entry: SelectInputEntry<V>): entry is SeparatorItem => "isSeparator" in entry && entry.isSeparator;

export type Props<V> = {
    /**
     * Color used for the selected item and indicator.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Color used for unselected items.
     */
    readonly defaultColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Controlled selected index. When provided, the component becomes controlled
     * and `initialIndex` is ignored. Update this value in the `onHighlight` callback
     * to track selection externally. If the index points to a separator, the nearest
     * selectable item is highlighted instead.
     */
    readonly index?: number;

    /**
     * Custom component to override the default indicator component.
     */
    readonly indicatorComponent?: FC<IndicatorProps>;

    /**
     * Index of initially-selected item in `items` array.
     * Ignored when `index` is provided.
     * When omitted (`undefined`), no item is highlighted until the user presses a key.
     * If the index points to a separator, the nearest selectable item is used.
     */
    readonly initialIndex?: number;

    /**
     * Whether the input is focused. Useful for when there are multiple
     * inputs on the screen and you need to control which one captures input.
     * @default true
     */
    readonly isFocused?: boolean;

    /**
     * Custom component to override the default item component.
     */
    readonly itemComponent?: FC<ItemProps>;

    // eslint-disable-next-line jsdoc/informative-docs -- "items" is the clearest name for this prop
    /** @default [] */
    readonly items?: ReadonlyArray<SelectInputEntry<V>>;

    /**
     * Number of visible items. Useful if the list is long and you want
     * to limit the display with a scrolling window.
     */
    readonly limit?: number;

    /**
     * Called when the user highlights a new item via arrow keys or `j`/`k`.
     * The second argument is the index of the highlighted item in the visible list.
     */
    readonly onHighlight?: (item: Item<V>, index: number) => void;

    /**
     * Called when the user selects an item via Enter or a number key (1-9).
     */
    readonly onSelect?: (item: Item<V>) => void;

    /**
     * Whether to reset the selection when items change.
     * Set to `false` to preserve the current selection across item updates.
     * @default true
     */
    readonly resetOnItemsChange?: boolean;
};

const EMPTY_ITEMS: ReadonlyArray<never> = [];
const NUMBER_KEY_PATTERN = /^[1-9]$/;
const NO_SELECTION = -1;
const DEFAULT_SEPARATOR_LABEL = "───";
const SEPARATOR_SENTINEL: unique symbol = Symbol("separator");

type SelectionState = {
    readonly rotateIndex: number;
    /** -1 means no item is highlighted. */
    readonly selectedIndex: number;
};

// eslint-disable-next-line @stylistic/operator-linebreak
type SelectionAction =
    | { readonly hasInitialSelection: boolean; readonly initialIndex: number; readonly type: "reset" }
    | { readonly rotateIndex: number; readonly selectedIndex: number; readonly type: "navigate" }
    | { readonly selectedIndex: number; readonly type: "set" };

const selectionReducer = (state: SelectionState, action: SelectionAction): SelectionState => {
    switch (action.type) {
        case "navigate": {
            return { rotateIndex: action.rotateIndex, selectedIndex: action.selectedIndex };
        }

        case "reset": {
            return {
                rotateIndex: 0,
                selectedIndex: action.hasInitialSelection ? action.initialIndex : NO_SELECTION,
            };
        }

        case "set": {
            return { rotateIndex: action.selectedIndex, selectedIndex: action.selectedIndex };
        }

        default: {
            return state;
        }
    }
};

/**
 * Rotate an array by a given offset, wrapping elements around.
 */
const rotateArray = <T,>(array: ReadonlyArray<T>, offset: number): T[] => {
    const { length } = array;

    if (length === 0) {
        return [];
    }

    // Normalize offset to a positive value within array bounds
    const normalizedOffset = ((offset % length) + length) % length;

    return [...array.slice(normalizedOffset), ...array.slice(0, normalizedOffset)];
};

/**
 * Return the windowed slice of items that should be rendered.
 */
const getVisibleItems = <V,>(
    items: ReadonlyArray<SelectInputEntry<V>>,
    hasLimit: boolean,
    currentRotateIndex: number,
    limit: number,
): ReadonlyArray<SelectInputEntry<V>> => {
    if (hasLimit) {
        return rotateArray(items, currentRotateIndex).slice(0, limit);
    }

    return items;
};

/**
 * Find the next non-separator index in the given direction, wrapping around.
 * Returns NO_SELECTION if all entries are separators.
 */
const findNextSelectableIndex = <V,>(entries: ReadonlyArray<SelectInputEntry<V>>, fromIndex: number, direction: -1 | 1): number => {
    const { length } = entries;

    for (let step = 0; step < length; step += 1) {
        // Double-modulo idiom handles negative intermediate values correctly
        const candidate = (((fromIndex + (step + 1) * direction) % length) + length) % length;

        if (!isSeparator(entries[candidate] as SelectInputEntry<V>)) {
            return candidate;
        }
    }

    return NO_SELECTION;
};

/**
 * Resolve a requested index to the nearest selectable (non-separator) entry.
 * If the target itself is selectable, returns it unchanged.
 * If it's a separator, scans forward for the nearest selectable.
 * Returns NO_SELECTION if all entries are separators.
 */
const resolveSelectableIndex = <V,>(entries: ReadonlyArray<SelectInputEntry<V>>, targetIndex: number): number => {
    if (targetIndex < 0 || targetIndex >= entries.length) {
        return NO_SELECTION;
    }

    const entry = entries[targetIndex];

    if (entry && !isSeparator(entry)) {
        return targetIndex;
    }

    // Scan forward from the target to find the nearest selectable
    return findNextSelectableIndex(entries, targetIndex - 1, 1);
};

/**
 * A select input component for terminal UIs.
 *
 * Renders a list of items with an indicator showing the currently highlighted item.
 * Users can navigate with arrow keys or `j`/`k`, select with Enter, or jump to an
 * item by pressing a number key (1-9).
 */
export default function SelectInput<V>({
    accentColor = "blue",
    defaultColor,
    index,
    indicatorComponent = SelectInputIndicator,
    initialIndex,
    isFocused = true,
    itemComponent = SelectInputItem,
    items = EMPTY_ITEMS,
    limit: customLimit,
    onHighlight,
    onSelect,
    resetOnItemsChange = true,
}: Props<V>): ReactElement {
    const { rows: terminalRows } = useWindowSize();

    // Auto-limit: when no explicit limit is set and items exceed terminal height,
    // cap to terminal rows so the list doesn't overflow the screen.
    const effectiveLimit = typeof customLimit === "number" ? customLimit : terminalRows;
    const hasLimit = items.length > effectiveLimit;
    const limit = hasLimit ? Math.min(effectiveLimit, items.length) : items.length;
    const lastIndex = limit - 1;

    const hasInitialSelection = typeof index === "number" || typeof initialIndex === "number";
    // eslint-disable-next-line @stylistic/no-extra-parens
    const rawInitial = typeof index === "number" ? index : (initialIndex ?? NO_SELECTION);
    // Clamp and skip separators for the initial selection
    const resolvedInitial = rawInitial === NO_SELECTION ? NO_SELECTION : resolveSelectableIndex(items, Math.min(rawInitial, lastIndex));

    const [state, dispatch] = useReducer(selectionReducer, {
        rotateIndex: resolvedInitial > lastIndex ? lastIndex - resolvedInitial : 0,
        selectedIndex: resolvedInitial,
    });

    const hasInitialSelectionRef = useRef(hasInitialSelection);
    const resolvedInitialRef = useRef(resolvedInitial);
    const stateRef = useRef(state);

    stateRef.current = state;
    const onSelectRef = useRef(onSelect);

    onSelectRef.current = onSelect;
    const previousItems = useRef(items);

    // Extract values for comparison, treating separators as a stable sentinel (Symbol avoids value collisions)
    const itemValues = useMemo(
        () =>
            // eslint-disable-next-line sonarjs/function-return-type -- legitimate union return: separator sentinel symbol vs entry value
            items.map((entry) => {
                if (isSeparator(entry)) {
                    return SEPARATOR_SENTINEL;
                }

                return entry.value;
            }),
        [items],
    );

    const previousItemValues = useRef(itemValues);

    hasInitialSelectionRef.current = hasInitialSelection;
    resolvedInitialRef.current = resolvedInitial;

    useEffect(() => {
        if (resetOnItemsChange && !isDeepStrictEqual(previousItemValues.current, itemValues)) {
            dispatch({
                hasInitialSelection: hasInitialSelectionRef.current,
                initialIndex: resolvedInitialRef.current,
                type: "reset",
            });
        }

        previousItemValues.current = itemValues;
        previousItems.current = items;
    }, [items, itemValues, resetOnItemsChange]);

    useEffect(() => {
        if (typeof index === "number") {
            // Clamp and skip separators for controlled index
            const safeIndex = resolveSelectableIndex(items, Math.min(index, lastIndex));

            dispatch({ selectedIndex: safeIndex === NO_SELECTION ? 0 : safeIndex, type: "set" });
        }
    }, [index, items, lastIndex]);

    const handleUpArrow = useCallback(
        (currentRotateIndex: number, currentSelectedIndex: number) => {
            const visibleItems = getVisibleItems(items, hasLimit, currentRotateIndex, limit);

            // First keypress when nothing is selected: find the last selectable item
            if (currentSelectedIndex === NO_SELECTION) {
                const activateIndex = findNextSelectableIndex(visibleItems, 0, -1);

                if (activateIndex === NO_SELECTION) {
                    return;
                }

                dispatch({ rotateIndex: currentRotateIndex, selectedIndex: activateIndex, type: "navigate" });

                if (typeof onHighlight === "function") {
                    onHighlight(visibleItems[activateIndex] as Item<V>, activateIndex);
                }

                return;
            }

            // Navigate up: when at first position, wrap to bottom (incrementing rotateIndex
            // shifts the window forward, bringing earlier items into view at the bottom)
            const currentLastIndex = (hasLimit ? limit : items.length) - 1;
            const atFirstIndex = currentSelectedIndex === 0;
            const rawNextIndex = atFirstIndex ? currentLastIndex : currentSelectedIndex - 1;
            const nextRotateIndex = atFirstIndex && hasLimit ? currentRotateIndex + 1 : currentRotateIndex;

            const nextVisibleItems = getVisibleItems(items, hasLimit, nextRotateIndex, limit);
            const nextSelectedIndex = isSeparator(nextVisibleItems[rawNextIndex] as SelectInputEntry<V>)
                ? findNextSelectableIndex(nextVisibleItems, rawNextIndex, -1)
                : rawNextIndex;

            if (nextSelectedIndex === NO_SELECTION) {
                return;
            }

            dispatch({ rotateIndex: nextRotateIndex, selectedIndex: nextSelectedIndex, type: "navigate" });

            if (typeof onHighlight === "function") {
                onHighlight(nextVisibleItems[nextSelectedIndex] as Item<V>, nextSelectedIndex);
            }
        },
        [hasLimit, limit, items, onHighlight],
    );

    const handleDownArrow = useCallback(
        (currentRotateIndex: number, currentSelectedIndex: number) => {
            const visibleItems = getVisibleItems(items, hasLimit, currentRotateIndex, limit);

            // First keypress when nothing is selected: find the first selectable item
            if (currentSelectedIndex === NO_SELECTION) {
                const activateIndex = findNextSelectableIndex(visibleItems, visibleItems.length - 1, 1);

                if (activateIndex === NO_SELECTION) {
                    return;
                }

                dispatch({ rotateIndex: currentRotateIndex, selectedIndex: activateIndex, type: "navigate" });

                if (typeof onHighlight === "function") {
                    onHighlight(visibleItems[activateIndex] as Item<V>, activateIndex);
                }

                return;
            }

            // Navigate down: when at last position, wrap to top (decrementing rotateIndex
            // shifts the window backward, bringing later items into view at the top)
            const currentLastIndex = (hasLimit ? limit : items.length) - 1;
            const atLastIndex = currentSelectedIndex === currentLastIndex;
            const rawNextIndex = atLastIndex ? 0 : currentSelectedIndex + 1;
            const nextRotateIndex = atLastIndex && hasLimit ? currentRotateIndex - 1 : currentRotateIndex;

            const nextVisibleItems = getVisibleItems(items, hasLimit, nextRotateIndex, limit);
            const nextSelectedIndex = isSeparator(nextVisibleItems[rawNextIndex] as SelectInputEntry<V>)
                ? findNextSelectableIndex(nextVisibleItems, rawNextIndex, 1)
                : rawNextIndex;

            if (nextSelectedIndex === NO_SELECTION) {
                return;
            }

            dispatch({ rotateIndex: nextRotateIndex, selectedIndex: nextSelectedIndex, type: "navigate" });

            if (typeof onHighlight === "function") {
                onHighlight(nextVisibleItems[nextSelectedIndex] as Item<V>, nextSelectedIndex);
            }
        },
        [hasLimit, limit, items, onHighlight],
    );

    useInput(
        useCallback(
            (input: string, key) => {
                const { rotateIndex, selectedIndex } = stateRef.current;

                if (input === "k" || key.upArrow) {
                    handleUpArrow(rotateIndex, selectedIndex);
                }

                if (input === "j" || key.downArrow) {
                    handleDownArrow(rotateIndex, selectedIndex);
                }

                if (NUMBER_KEY_PATTERN.test(input)) {
                    const targetIndex = Number.parseInt(input, 10) - 1;
                    const visibleItems = getVisibleItems(items, hasLimit, rotateIndex, limit);

                    if (targetIndex >= 0 && targetIndex < visibleItems.length) {
                        const selectedItem = visibleItems[targetIndex];

                        if (selectedItem && !isSeparator(selectedItem)) {
                            onSelectRef.current?.(selectedItem);
                            selectedItem.action?.();
                        }
                    }
                }

                if (key.return && selectedIndex !== NO_SELECTION) {
                    const slicedItems = getVisibleItems(items, hasLimit, rotateIndex, limit);
                    const selectedItem = slicedItems[selectedIndex];

                    if (selectedItem && !isSeparator(selectedItem)) {
                        onSelectRef.current?.(selectedItem);
                        selectedItem.action?.();
                    }
                }
            },
            [handleUpArrow, handleDownArrow, hasLimit, limit, items],
        ),
        { isActive: isFocused },
    );

    const slicedItems = getVisibleItems(items, hasLimit, state.rotateIndex, limit);

    return (
        <Box flexDirection="column">
            {slicedItems.map((entry, itemIndex) => {
                if (isSeparator(entry)) {
                    return (
                        <Box key={entry.key ?? `separator-${String(itemIndex)}`}>
                            <Text dimColor>{entry.label ?? DEFAULT_SEPARATOR_LABEL}</Text>
                        </Box>
                    );
                }

                const isSelected = itemIndex === state.selectedIndex;

                return (
                    <Box key={entry.key ?? String(entry.value)}>
                        {createElement(indicatorComponent, { accentColor, isFocused, isSelected })}
                        {createElement(itemComponent, { ...entry, accentColor, defaultColor, isFocused, isSelected })}
                    </Box>
                );
            })}
        </Box>
    );
}

export { SelectInput };
export type { Props as SelectInputProps };
export type { Item as SelectInputItemType };
export type { SeparatorItem as SelectInputSeparator };
