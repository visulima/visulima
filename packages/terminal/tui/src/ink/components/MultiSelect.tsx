/* eslint-disable import/exports-last, react-you-might-not-need-an-effect/no-event-handler, react-you-might-not-need-an-effect/no-pass-live-state-to-parent, react/function-component-definition, unicorn/filename-case */

/**
 * Multi-select input component for Ink.
 *
 * Inspired by ink-ui MultiSelect by Vadim Demedes.
 * @see https://github.com/vadimdemedes/ink-ui
 *
 * MIT License
 * Copyright (c) Vadym Demedes (github.com/vadimdemedes)
 */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { LiteralUnion } from "type-fest";

import useInput from "../hooks/use-input";
import useWindowSize from "../hooks/use-window-size";
import Box from "./Box";
import Text from "./Text";

export type MultiSelectOption = {
    readonly key?: string;
    readonly label: string;
    readonly value: string;
};

export type Props = {
    /**
     * Color for the focused item indicator and selected checkmarks.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Color for unselected, unfocused option labels.
     */
    readonly defaultColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Initially selected values.
     */
    readonly defaultValue?: ReadonlyArray<string>;

    /**
     * When true, all input is ignored and labels are dimmed.
     * @default false
     */
    readonly isDisabled?: boolean;

    /**
     * Whether the parent has focus. When false, indicators are dimmed.
     * @default true
     */
    readonly isFocused?: boolean;

    /**
     * Number of visible options before scrolling.
     * When omitted, auto-limits to terminal height.
     */
    readonly limit?: number;

    /**
     * Fires when the set of selected values changes (space to toggle).
     */
    readonly onChange?: (values: ReadonlyArray<string>) => void;

    /**
     * Fires when the user presses Enter to submit.
     */
    readonly onSubmit?: (values: ReadonlyArray<string>) => void;

    /**
     * Available choices to pick from.
     */
    readonly options: ReadonlyArray<MultiSelectOption>;
};

const EMPTY_DEFAULT: ReadonlyArray<string> = [];

type MultiSelectState = {
    readonly focusedIndex: number;
    readonly visibleFrom: number;
};

// eslint-disable-next-line @stylistic/operator-linebreak
type MultiSelectAction =
    | { readonly index: number; readonly type: "focus" }
    | { readonly limit: number; readonly type: "focus-next" }
    | { readonly limit: number; readonly type: "focus-prev" };

const multiSelectReducer = (state: MultiSelectState, action: MultiSelectAction): MultiSelectState => {
    switch (action.type) {
        case "focus": {
            return { ...state, focusedIndex: action.index };
        }

        case "focus-next": {
            const nextIndex = state.focusedIndex + 1;
            const needsScroll = nextIndex >= state.visibleFrom + action.limit;

            return {
                ...state,
                focusedIndex: nextIndex,
                visibleFrom: needsScroll ? state.visibleFrom + 1 : state.visibleFrom,
            };
        }

        case "focus-prev": {
            const previousIndex = state.focusedIndex - 1;
            const needsScroll = previousIndex < state.visibleFrom;

            return {
                ...state,
                focusedIndex: previousIndex,
                visibleFrom: needsScroll ? state.visibleFrom - 1 : state.visibleFrom,
            };
        }

        default: {
            return state;
        }
    }
};

/**
 * Renders a multi-choice selection list with checkboxes and keyboard navigation.
 */
export default function MultiSelect({
    accentColor = "blue",
    defaultColor,
    defaultValue = EMPTY_DEFAULT,
    isDisabled = false,
    isFocused = true,
    limit: customLimit,
    onChange,
    onSubmit,
    options,
}: Props): ReactElement {
    const { rows: terminalRows } = useWindowSize();
    const effectiveLimit = typeof customLimit === "number" ? customLimit : terminalRows;
    const limit = Math.min(effectiveLimit, options.length);

    const [state, dispatch] = useReducer(multiSelectReducer, {
        focusedIndex: 0,
        visibleFrom: 0,
    });

    const [selectedValues, setSelectedValues] = useState(defaultValue);
    const previousSelectedRef = useRef(selectedValues);

    useEffect(() => {
        if (previousSelectedRef.current !== selectedValues) {
            onChange?.(selectedValues);
            previousSelectedRef.current = selectedValues;
        }
    }, [selectedValues, onChange]);

    const visibleOptions = useMemo(() => options.slice(state.visibleFrom, state.visibleFrom + limit), [options, state.visibleFrom, limit]);

    const handleToggle = useCallback(() => {
        setSelectedValues((previous) => {
            const focusedValue = options[state.focusedIndex]?.value;

            if (!focusedValue) {
                return previous;
            }

            if (previous.includes(focusedValue)) {
                return previous.filter((v) => v !== focusedValue);
            }

            return [...previous, focusedValue];
        });
    }, [options, state.focusedIndex]);

    const handleToggleAll = useCallback(() => {
        setSelectedValues((previous) => {
            if (previous.length === options.length) {
                return [];
            }

            return options.map((o) => o.value);
        });
    }, [options]);

    useInput(
        useCallback(
            (input: string, key) => {
                if ((key.downArrow || input === "j") && state.focusedIndex < options.length - 1) {
                    dispatch({ limit, type: "focus-next" });
                }

                if ((key.upArrow || input === "k") && state.focusedIndex > 0) {
                    dispatch({ limit, type: "focus-prev" });
                }

                if (input === " ") {
                    handleToggle();
                }

                if (input === "a") {
                    handleToggleAll();
                }

                if (key.return) {
                    onSubmit?.(selectedValues);
                }
            },
            [state.focusedIndex, options.length, limit, handleToggle, handleToggleAll, onSubmit, selectedValues],
        ),
        { isActive: !isDisabled && isFocused },
    );

    return (
        <Box flexDirection="column">
            {visibleOptions.map((option, visibleIndex) => {
                const absoluteIndex = state.visibleFrom + visibleIndex;
                const isFocusedOption = absoluteIndex === state.focusedIndex;
                const isSelected = selectedValues.includes(option.value);
                let labelColor: LiteralUnion<AnsiColors, string> | undefined = defaultColor;

                if (isSelected) {
                    labelColor = "green";
                } else if (isFocusedOption) {
                    labelColor = accentColor;
                }

                return (
                    <Box gap={1} key={option.key ?? option.value}>
                        {/* eslint-disable-next-line @stylistic/multiline-ternary */}
                        {isFocusedOption ? (
                            <Text color={accentColor} dimColor={!isFocused}>
                                ▸
                            </Text>
                        ) : (
                            <Text> </Text>
                        )}
                        <Text color={labelColor} dimColor={isDisabled}>
                            {isSelected ? "◼" : "◻"}
                            {" "}
                            {option.label}
                        </Text>
                        {isSelected
                            ? (
                                <Text color="green" dimColor={!isFocused}>
                                    ✓
                                </Text>
                            )
                            : undefined}
                    </Box>
                );
            })}
        </Box>
    );
}
