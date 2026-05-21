/* eslint-disable react/function-component-definition */

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
import { useCallback, useMemo, useReducer, useRef, useState } from "react";
import type { LiteralUnion } from "type-fest";

import useInput from "../ink/hooks/use-input";
import useWindowSize from "../ink/hooks/use-window-size";
import Box from "./box";
import Text from "./text";

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
    const selectedValuesRef = useRef(selectedValues);

    selectedValuesRef.current = selectedValues;
    const onSubmitRef = useRef(onSubmit);

    onSubmitRef.current = onSubmit;
    const onChangeRef = useRef(onChange);

    onChangeRef.current = onChange;

    const stateRef = useRef(state);

    stateRef.current = state;

    const visibleOptions = useMemo(() => options.slice(state.visibleFrom, state.visibleFrom + limit), [options, state.visibleFrom, limit]);

    const handleToggle = useCallback(() => {
        const focusedValue = options[stateRef.current.focusedIndex]?.value;

        if (!focusedValue) {
            return;
        }

        setSelectedValues((previous) => {
            const next = previous.includes(focusedValue) ? previous.filter((v) => v !== focusedValue) : [...previous, focusedValue];

            onChangeRef.current?.(next);

            return next;
        });
    }, [options]);

    const handleToggleAll = useCallback(() => {
        setSelectedValues((previous) => {
            const next = previous.length === options.length ? [] : options.map((o) => o.value);

            onChangeRef.current?.(next);

            return next;
        });
    }, [options]);

    useInput(
        useCallback(
            (input: string, key) => {
                const { focusedIndex } = stateRef.current;

                if ((key.downArrow || input === "j") && focusedIndex < options.length - 1) {
                    dispatch({ limit, type: "focus-next" });
                }

                if ((key.upArrow || input === "k") && focusedIndex > 0) {
                    dispatch({ limit, type: "focus-prev" });
                }

                if (input === " ") {
                    handleToggle();
                }

                if (input === "a") {
                    handleToggleAll();
                }

                if (key.return) {
                    onSubmitRef.current?.(selectedValuesRef.current);
                }
            },
            [options.length, limit, handleToggle, handleToggleAll],
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
                            {isSelected ? "◼" : "◻"} {option.label}
                        </Text>
                        {isSelected ? (
                            <Text color="green" dimColor={!isFocused}>
                                ✓
                            </Text>
                        ) : undefined}
                    </Box>
                );
            })}
        </Box>
    );
}

export { MultiSelect };
export type { Props as MultiSelectProps };
