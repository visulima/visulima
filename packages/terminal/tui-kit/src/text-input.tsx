/* eslint-disable react/function-component-definition */

/**
 * Text input component for Ink.
 *
 * Inspired by ink-ui TextInput by Vadim Demedes and ink-text-input by Sindre Sorhus.
 * @see https://github.com/vadimdemedes/ink-ui
 *
 * MIT License
 * Copyright (c) Vadym Demedes (github.com/vadimdemedes)
 */
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import useInput from "@visulima/tui/hooks/use-input";
import { isInsertableInput } from "@visulima/tui/input";
import type { ReactElement } from "react";
import { useCallback, useRef, useState } from "react";

export type Props = {
    // eslint-disable-next-line jsdoc/informative-docs -- @default tag triggers false positive
    /** @default "" */
    readonly defaultValue?: string;

    /**
     * When true, all input is ignored and text is dimmed.
     * @default false
     */
    readonly isDisabled?: boolean;

    /**
     * When true, renders asterisks instead of the actual characters.
     * @default false
     */
    readonly mask?: boolean;

    /**
     * Fires on every keystroke with the updated text.
     */
    readonly onChange?: (value: string) => void;

    /**
     * Fires when the user presses Enter.
     */
    readonly onSubmit?: (value: string) => void;

    /**
     * Greyed-out text shown when the input is empty.
     */
    readonly placeholder?: string;

    /**
     * Autocomplete candidates. The first case-sensitive prefix match is shown
     * dimmed after the current input. Press right-arrow or Enter to accept.
     */
    readonly suggestions?: ReadonlyArray<string>;
};

// eslint-disable-next-line sonarjs/slow-regex -- false positive: linear backtracking on short input lines
const KILL_WORD_PATTERN = /\S+\s*$/;

/**
 * Find the first suggestion suffix that matches the current value.
 */
const findSuggestion = (value: string, suggestions: ReadonlyArray<string> | undefined): string | undefined => {
    if (value.length === 0 || !suggestions) {
        return undefined;
    }

    const match = suggestions.find((s) => s.startsWith(value));

    return match?.slice(value.length) ?? undefined;
};

const NAV_NOT_HANDLED = -1;

/**
 * Handle cursor navigation keys (arrows, Home, End, Ctrl+A/E).
 * Returns the new cursor position, or NAV_NOT_HANDLED if the key was not a navigation key.
 */
const handleNavigation = (
    input: string,
    key: { ctrl: boolean; end: boolean; home: boolean; leftArrow: boolean; rightArrow: boolean },
    cursor: number,
    valueLength: number,
): number => {
    if (key.leftArrow) {
        return Math.max(0, cursor - 1);
    }

    if (key.home || (key.ctrl && input === "a")) {
        return 0;
    }

    if (key.end || (key.ctrl && input === "e")) {
        return valueLength;
    }

    // rightArrow without suggestion acceptance is handled by caller
    return NAV_NOT_HANDLED;
};

/**
 * Handle editing keys (Backspace, Delete, Ctrl+U/K/W).
 * Returns [newValue, newCursor] or undefined if the key was not an editing key.
 */
const handleEditing = (
    input: string,
    key: { backspace: boolean; ctrl: boolean; delete: boolean },
    currentValue: string,
    cursor: number,
): [string, number] | undefined => {
    if (key.backspace && cursor > 0) {
        return [currentValue.slice(0, cursor - 1) + currentValue.slice(cursor), cursor - 1];
    }

    if (key.delete && cursor < currentValue.length) {
        return [currentValue.slice(0, cursor) + currentValue.slice(cursor + 1), cursor];
    }

    if (key.ctrl && input === "u") {
        return [currentValue.slice(cursor), 0];
    }

    if (key.ctrl && input === "k") {
        return [currentValue.slice(0, cursor), cursor];
    }

    if (key.ctrl && input === "w") {
        const before = currentValue.slice(0, cursor);
        const trimmed = before.replace(KILL_WORD_PATTERN, "");

        return [trimmed + currentValue.slice(cursor), trimmed.length];
    }

    return undefined;
};

/**
 * A single-line text input with cursor navigation, optional placeholder,
 * autocomplete suggestions, and password masking.
 *
 * Supports arrow keys, Home/End, Ctrl+A/E, Ctrl+U/K/W, Backspace, Delete.
 */
export default function TextInput({ defaultValue = "", isDisabled = false, mask = false, onChange, onSubmit, placeholder, suggestions }: Props): ReactElement {
    const [value, setValueRaw] = useState(defaultValue);
    const [cursor, setCursor] = useState(defaultValue.length);

    const valueRef = useRef(value);

    valueRef.current = value;
    const cursorRef = useRef(cursor);

    cursorRef.current = cursor;

    const onChangeRef = useRef(onChange);

    onChangeRef.current = onChange;
    const onSubmitRef = useRef(onSubmit);

    onSubmitRef.current = onSubmit;

    const suggestion = findSuggestion(value, suggestions);

    const inputHandler = useCallback(
        (
            input: string,
            key: {
                backspace: boolean;
                ctrl: boolean;
                delete: boolean;
                end: boolean;
                escape: boolean;
                home: boolean;
                leftArrow: boolean;
                meta: boolean;
                return: boolean;
                rightArrow: boolean;
            },
        ) => {
            const { current } = cursorRef;
            const currentValue = valueRef.current;

            if (key.return) {
                const currentSuggestion = findSuggestion(currentValue, suggestions);
                const finalValue = currentSuggestion ? currentValue + currentSuggestion : currentValue;

                if (currentSuggestion) {
                    setValueRaw(finalValue);
                    setCursor(finalValue.length);
                    onChangeRef.current?.(finalValue);
                }

                onSubmitRef.current?.(finalValue);

                return;
            }

            if (key.escape) {
                return;
            }

            // Right arrow: accept suggestion if at end, otherwise move cursor
            if (key.rightArrow) {
                const currentSuggestion = findSuggestion(currentValue, suggestions);

                if (current === currentValue.length && currentSuggestion) {
                    const completed = currentValue + currentSuggestion;

                    setValueRaw(completed);
                    setCursor(completed.length);
                    onChangeRef.current?.(completed);

                    return;
                }

                setCursor(Math.min(currentValue.length, current + 1));

                return;
            }

            // Navigation keys
            const navResult = handleNavigation(input, key, current, currentValue.length);

            if (navResult !== NAV_NOT_HANDLED) {
                setCursor(navResult);

                return;
            }

            // Editing keys
            const editResult = handleEditing(input, key, currentValue, current);

            if (editResult) {
                const [newValue, newCursor] = editResult;

                setValueRaw(newValue);
                setCursor(newCursor);
                onChangeRef.current?.(newValue);

                return;
            }

            // Printable character — insert at cursor (filters out ctrl/meta chords,
            // but allows AltGr symbols like @ and € on international keyboards)
            if (isInsertableInput(input, key)) {
                const next = currentValue.slice(0, current) + input + currentValue.slice(current);

                setValueRaw(next);
                setCursor(current + input.length);
                onChangeRef.current?.(next);
            }
        },
        [suggestions],
    );

    useInput(inputHandler, { isActive: !isDisabled });

    // Build the display string
    const displayValue = mask ? "*".repeat(value.length) : value;

    // Render with cursor
    const beforeCursor = displayValue.slice(0, cursor);
    const atCursor = displayValue[cursor];
    const afterCursor = displayValue.slice(cursor + 1);

    if (isDisabled) {
        return (
            <Box>
                {/* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- intentional: empty string should fall through to placeholder */}
                <Text dimColor>{displayValue || placeholder || ""}</Text>
            </Box>
        );
    }

    if (value.length === 0 && placeholder) {
        return (
            <Box>
                <Text dimColor inverse>
                    {placeholder[0]}
                </Text>
                <Text dimColor>{placeholder.slice(1)}</Text>
            </Box>
        );
    }

    return (
        <Box>
            <Text>
                {beforeCursor}
                <Text inverse>{atCursor ?? " "}</Text>
                {afterCursor}
            </Text>
            {suggestion ? <Text dimColor>{suggestion}</Text> : undefined}
        </Box>
    );
}

export { TextInput };
export type { Props as TextInputProps };
