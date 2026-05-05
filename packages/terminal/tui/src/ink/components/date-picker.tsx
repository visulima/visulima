/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import type { LiteralUnion } from "type-fest";

import useFocus from "../hooks/use-focus";
import useInput from "../hooks/use-input";
import Box from "./box";
import Calendar from "./calendar";
import Text from "./text";

export type Props = {
    /**
     * Accent color used by the inner calendar when open.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Auto-focus the picker on mount.
     */
    readonly autoFocus?: boolean;

    /**
     * Initial selected date when uncontrolled.
     */
    readonly defaultValue?: Date;

    /**
     * Override the way the selected date is rendered in the input row.
     */
    readonly formatValue?: (date: Date) => string;

    /**
     * Disable the picker.
     */
    readonly isDisabled?: boolean;

    /**
     * Upper bound for selectable dates.
     */
    readonly maxDate?: Date;

    /**
     * Lower bound for selectable dates.
     */
    readonly minDate?: Date;

    /**
     * Fired when the user commits a date with Enter.
     */
    readonly onChange?: (date: Date) => void;

    /**
     * Placeholder rendered when no date is selected.
     * @default "Pick a date"
     */
    readonly placeholder?: string;

    /**
     * Controlled selected date.
     */
    readonly value?: Date;
};

const defaultFormat = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

/**
 * Compact date input. Shows the currently-selected date; Enter / Space opens
 * the inline `Calendar` for navigation. Enter inside the calendar commits the
 * date and closes the picker.
 */
export default function DatePicker({
    accentColor = "blue",
    autoFocus = false,
    defaultValue,
    formatValue = defaultFormat,
    isDisabled = false,
    maxDate,
    minDate,
    onChange,
    placeholder = "Pick a date",
    value,
}: Props): ReactElement {
    const { isFocused } = useFocus({ autoFocus, isActive: !isDisabled });
    const [isOpen, setIsOpen] = useState(false);
    const [internal, setInternal] = useState(defaultValue);
    const current = value ?? internal;

    useInput(
        useCallback(
            (input, key) => {
                if (!isFocused || isOpen) {
                    return;
                }

                if (key.return || input === " ") {
                    setIsOpen(true);
                }
            },
            [isFocused, isOpen],
        ),
        { isActive: !isDisabled && isFocused && !isOpen },
    );

    // While the Calendar is open we still want Esc to dismiss without
    // committing — the Calendar itself doesn't handle Escape.
    useInput(
        useCallback((_input, key) => {
            if (key.escape) {
                setIsOpen(false);
            }
        }, []),
        { isActive: !isDisabled && isFocused && isOpen },
    );

    const handleCalendarSubmit = useCallback(
        (date: Date) => {
            if (value === undefined) {
                setInternal(date);
            }

            setIsOpen(false);
            onChange?.(date);
        },
        [value, onChange],
    );

    return (
        <Box flexDirection="column">
            <Box borderColor={isFocused ? accentColor : undefined} borderStyle="round" paddingX={1}>
                <Text color={accentColor}>📅 </Text>
                {current === undefined ? <Text dimColor>{placeholder}</Text> : <Text bold>{formatValue(current)}</Text>}
                {isFocused && !isOpen ? (
                    <Box marginLeft={1}>
                        <Text dimColor>(Enter to open)</Text>
                    </Box>
                ) : undefined}
            </Box>
            {isOpen ? (
                <Box marginTop={1}>
                    <Calendar accentColor={accentColor} autoFocus defaultValue={current} maxDate={maxDate} minDate={minDate} onSubmit={handleCalendarSubmit} />
                </Box>
            ) : undefined}
        </Box>
    );
}
