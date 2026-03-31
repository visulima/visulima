/* eslint-disable import/exports-last, react-you-might-not-need-an-effect/no-event-handler, react/function-component-definition, unicorn/filename-case */

/**
 * Tabs component for Ink.
 *
 * Inspired by ink-tab by Julien Deniau.
 * @see https://github.com/jdeniau/ink-tab
 *
 * MIT License
 * Copyright (c) Julien Deniau (github.com/jdeniau)
 */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement, ReactNode } from "react";
import { Children, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LiteralUnion } from "type-fest";

import type { Key } from "../hooks/use-input";
import useInput from "../hooks/use-input";
import Box from "./Box";
import type { Props as TabProps } from "./Tab";
import Text from "./Text";

const NUMBER_KEY_PATTERN = /^\d$/u;

/**
 * Keyboard navigation configuration for Tabs.
 */
export type KeyMap = {
    /**
     * Key names that move to the next tab.
     * Defaults to `["rightArrow"]` for row layouts and `["downArrow"]` for column layouts.
     */
    readonly next?: ReadonlyArray<string>;

    /**
     * Key names that move to the previous tab.
     * Defaults to `["leftArrow"]` for row layouts and `["upArrow"]` for column layouts.
     */
    readonly previous?: ReadonlyArray<string>;

    /**
     * Whether Meta/Cmd + 1–9 jumps to a specific tab.
     * @default true
     */
    readonly useNumbers?: boolean;

    /**
     * Whether the Tab key cycles through tabs (only when `isFocused` is not managed by Ink).
     * @default true
     */
    readonly useTab?: boolean;
};

/**
 * Color customization for active tab styling.
 */
export type TabColors = {
    readonly activeTab?: {
        readonly backgroundColor?: LiteralUnion<AnsiColors, string>;
        readonly color?: LiteralUnion<AnsiColors, string>;
    };
};

export type Props = {
    /**
     * Tab elements to render.
     */
    readonly children: ReactNode;

    /**
     * Active tab colors. When `isFocused` is `false`, the active tab uses gray.
     */
    readonly colors?: TabColors;

    /**
     * Name of the tab to select initially.
     */
    readonly defaultValue?: string;

    /**
     * Layout direction for the tab bar.
     * @default "row"
     */
    readonly flexDirection?: "column" | "column-reverse" | "row" | "row-reverse";

    /**
     * Whether the tabs are focused and respond to keyboard input.
     * - `true`: focused, uses active colors.
     * - `false`: unfocused, uses gray active color, ignores input.
     * - `undefined`/`null`: always active (focus not managed by Ink).
     * @default undefined
     */
    readonly isFocused?: boolean | null;

    /**
     * Custom keyboard mappings.
     */
    readonly keyMap?: KeyMap;

    /**
     * Called when the active tab changes.
     */
    readonly onChange: (name: string, activeTab: ReactElement<TabProps>) => void;

    /**
     * Whether to display 1-based index numbers before each tab name.
     * @default true
     */
    readonly showIndex?: boolean;

    /**
     * Width of the container Box. Also determines the separator width in column layouts.
     */
    readonly width?: number | string;
};

const isTabElement = (child: unknown): child is ReactElement<TabProps> =>
    child != null && typeof child === "object" && "props" in (child as ReactElement) && "name" in (child as ReactElement<TabProps>).props;

const collectTabs = (children: ReactNode): ReactElement<TabProps>[] => {
    const result: ReactElement<TabProps>[] = [];

    // Children.toArray flattens fragments and filters out nulls/booleans
    // eslint-disable-next-line no-for-of-array/no-for-of-array, react-x/no-children-to-array
    for (const child of Children.toArray(children)) {
        if (isTabElement(child)) {
            result.push(child);
        }
    }

    return result;
};

const matchesAnyKey = (keys: ReadonlyArray<string>, key: Key): boolean => keys.some((keyName) => key[keyName as keyof Key]);

const getActiveTabColors = (
    isActive: boolean,
    focused: boolean,
    colorsProp: TabColors | undefined,
): { backgroundColor: string | undefined; color: string | undefined } => {
    if (!isActive) {
        return { backgroundColor: undefined, color: undefined };
    }

    if (focused) {
        return {
            backgroundColor: colorsProp?.activeTab?.backgroundColor ?? "green",
            color: colorsProp?.activeTab?.color ?? "black",
        };
    }

    return { backgroundColor: "gray", color: "black" };
};

/**
 * Tabbed navigation component. Renders a row or column of tabs with keyboard
 * navigation (arrow keys, Tab, number keys) and calls `onChange` when the
 * active tab changes.
 */
export default function Tabs({
    children,
    colors: colorsProp,
    defaultValue,
    flexDirection = "row",
    isFocused,
    keyMap: keyMapProp,
    onChange,
    showIndex = true,
    width,
}: Props): ReactElement {
    const tabs = collectTabs(children);
    const tabCount = tabs.length;
    const tabsRef = useRef(tabs);

    tabsRef.current = tabs;

    const isColumn = flexDirection === "column" || flexDirection === "column-reverse";

    const [activeTab, setActiveTab] = useState(() => {
        if (defaultValue == null || tabCount === 0) {
            return 0;
        }

        const foundIndex = tabs.findIndex((tab) => tab.props.name === defaultValue);

        return foundIndex === -1 ? 0 : foundIndex;
    });

    const onChangeRef = useRef(onChange);

    onChangeRef.current = onChange;

    // Notify initial tab on mount
    useEffect(() => {
        const tab = tabsRef.current[activeTab];

        if (tab) {
            onChangeRef.current(tab.props.name, tab);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Resolve key map with directional defaults
    const previousKeys = useMemo(() => keyMapProp?.previous ?? [isColumn ? "upArrow" : "leftArrow"], [keyMapProp?.previous, isColumn]);
    const nextKeys = useMemo(() => keyMapProp?.next ?? [isColumn ? "downArrow" : "rightArrow"], [keyMapProp?.next, isColumn]);
    const useNumbers = keyMapProp?.useNumbers ?? true;
    const useTab = keyMapProp?.useTab ?? true;

    const handleTabChange = useCallback((index: number) => {
        setActiveTab(index);

        const tab = tabsRef.current[index];

        if (tab) {
            onChangeRef.current(tab.props.name, tab);
        }
    }, []);

    const moveToNext = useCallback(() => {
        setActiveTab((current) => {
            const next = current + 1 >= tabCount ? 0 : current + 1;

            const tab = tabsRef.current[next];

            if (tab) {
                onChangeRef.current(tab.props.name, tab);
            }

            return next;
        });
    }, [tabCount]);

    const moveToPrevious = useCallback(() => {
        setActiveTab((current) => {
            const previous = current - 1 < 0 ? tabCount - 1 : current - 1;

            const tab = tabsRef.current[previous];

            if (tab) {
                onChangeRef.current(tab.props.name, tab);
            }

            return previous;
        });
    }, [tabCount]);

    useInput(
        useCallback(
            (input: string, key) => {
                if (matchesAnyKey(previousKeys, key)) {
                    moveToPrevious();

                    return;
                }

                if (matchesAnyKey(nextKeys, key)) {
                    moveToNext();

                    return;
                }

                // Tab key navigation (only when focus is not managed by Ink)
                if (key.tab && useTab && isFocused == null) {
                    if (key.shift) {
                        moveToPrevious();
                    } else {
                        moveToNext();
                    }

                    return;
                }

                // Number key navigation (Meta/Cmd + 1-9)
                if (useNumbers && key.meta && NUMBER_KEY_PATTERN.test(input)) {
                    const tabIndex = input === "0" ? 9 : Number.parseInt(input, 10) - 1;

                    if (tabIndex < tabCount) {
                        handleTabChange(tabIndex);
                    }
                }
            },
            [previousKeys, nextKeys, useTab, useNumbers, isFocused, moveToPrevious, moveToNext, tabCount, handleTabChange],
        ),
        { isActive: isFocused !== false },
    );

    const separatorWidth = typeof width === "number" ? width : 6;

    const separator = useMemo(
        // eslint-disable-next-line @stylistic/no-extra-parens
        () => (isColumn ? "─".repeat(separatorWidth) : " | "),
        [isColumn, separatorWidth],
    );

    return (
        <Box flexDirection={flexDirection} width={width}>
            {tabs.map((child, index) => {
                const { name } = child.props;
                const textColors = getActiveTabColors(activeTab === index, isFocused !== false, colorsProp);

                return (
                    <Box flexDirection={flexDirection} key={name}>
                        {index !== 0 && <Text color="dim">{separator}</Text>}
                        <Box>
                            {showIndex && (
                                <Text color="grey">
                                    {/* eslint-disable-next-line @stylistic/jsx-one-expression-per-line, react/jsx-one-expression-per-line */}
                                    {index + 1}.{" "}
                                </Text>
                            )}
                            <Text backgroundColor={textColors.backgroundColor} color={textColors.color}>
                                {child}
                            </Text>
                        </Box>
                    </Box>
                );
            })}
        </Box>
    );
}
