/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { LiteralUnion } from "type-fest";

import useFocus from "../ink/hooks/use-focus";
import useInput from "../ink/hooks/use-input";
import Box from "./box";
import Text from "./text";

export type Props = {
    /**
     * Accent color for today / the focused cell.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Auto-focus the grid on mount.
     */
    readonly autoFocus?: boolean;

    /**
     * Initial focused day when uncontrolled. Defaults to `value` or today.
     */
    readonly defaultValue?: Date;

    /**
     * First day of the week: 0 = Sunday, 1 = Monday.
     * @default 1
     */
    readonly firstDayOfWeek?: 0 | 1;

    /**
     * When true, disable input and render the grid dim.
     */
    readonly isDisabled?: boolean;

    /**
     * Upper bound; days after `maxDate` cannot be selected.
     */
    readonly maxDate?: Date;

    /**
     * Lower bound; days before `minDate` cannot be selected.
     */
    readonly minDate?: Date;

    /**
     * Called whenever the user navigates or selects a day.
     */
    readonly onChange?: (date: Date) => void;

    /**
     * Called when the user presses Enter.
     */
    readonly onSubmit?: (date: Date) => void;

    /**
     * Color used to mark the currently selected day.
     * @default "green"
     */
    readonly selectedColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Controlled selected date.
     */
    readonly value?: Date;
};

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * Move `date` by `delta` months while clamping the day so end-of-month
 * navigation does not roll over (e.g., Jan 31 + 1 month becomes Feb 28/29
 * instead of overflowing to March 3).
 */
const shiftMonth = (date: Date, delta: number): Date => {
    const targetYear = date.getFullYear();
    const targetMonth = date.getMonth() + delta;
    // `new Date(year, monthIndex + 1, 0)` returns the last day of `monthIndex`.
    const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
    const day = Math.min(date.getDate(), lastDay);

    return new Date(targetYear, targetMonth, day);
};

const isSameDay = (a: Date, b: Date): boolean => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const isOutOfRange = (date: Date, minDate: Date | undefined, maxDate: Date | undefined): boolean => {
    if (minDate !== undefined && date < startOfDay(minDate)) {
        return true;
    }

    if (maxDate !== undefined && date > startOfDay(maxDate)) {
        return true;
    }

    return false;
};

const buildWeeks = (year: number, month: number, firstDayOfWeek: 0 | 1): ReadonlyArray<ReadonlyArray<Date | undefined>> => {
    const firstOfMonth = new Date(year, month, 1);
    const firstDow = firstOfMonth.getDay();
    const leadingBlanks = (firstDow - firstDayOfWeek + 7) % 7;

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (Date | undefined)[] = [];

    for (let index = 0; index < leadingBlanks; index += 1) {
        cells.push(undefined);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        cells.push(new Date(year, month, day));
    }

    while (cells.length % 7 !== 0) {
        cells.push(undefined);
    }

    const weeks: ReadonlyArray<Date | undefined>[] = [];

    for (let row = 0; row < cells.length; row += 7) {
        weeks.push(cells.slice(row, row + 7));
    }

    return weeks;
};

/**
 * Month-grid date picker. Arrow keys move focus by one day, page up/down move
 * by month. Enter submits; Space or Enter selects.
 * @returns A bordered `ReactElement` containing the month header, weekday
 * labels, and the day grid.
 */
export default function Calendar({
    accentColor = "blue",
    autoFocus = false,
    defaultValue,
    firstDayOfWeek = 1,
    isDisabled = false,
    maxDate,
    minDate,
    onChange,
    onSubmit,
    selectedColor = "green",
    value,
}: Props): ReactElement {
    const { isFocused } = useFocus({ autoFocus, isActive: !isDisabled });
    // eslint-disable-next-line no-restricted-syntax -- today must be stable across renders; useRef would lose semantic clarity
    const today = useMemo(() => startOfDay(new Date()), []);
    const initial = startOfDay(value ?? defaultValue ?? today);
    const [internalCursor, setInternalCursor] = useState(initial);
    const cursor = value ? startOfDay(value) : internalCursor;
    const cursorRef = useRef(cursor);

    cursorRef.current = cursor;

    const weekdayLabels = useMemo(() => [...WEEKDAYS.slice(firstDayOfWeek), ...WEEKDAYS.slice(0, firstDayOfWeek)], [firstDayOfWeek]);

    const weeks = useMemo(() => buildWeeks(cursor.getFullYear(), cursor.getMonth(), firstDayOfWeek), [cursor, firstDayOfWeek]);

    const moveCursor = useCallback(
        (next: Date) => {
            const clamped = startOfDay(next);

            if (isOutOfRange(clamped, minDate, maxDate)) {
                return;
            }

            if (value === undefined) {
                setInternalCursor(clamped);
            }

            onChange?.(clamped);
        },
        [value, onChange, minDate, maxDate],
    );

    useInput(
        useCallback(
            (_, key) => {
                if (!isFocused) {
                    return;
                }

                const { current } = cursorRef;

                if (key.leftArrow) {
                    moveCursor(new Date(current.getFullYear(), current.getMonth(), current.getDate() - 1));
                } else if (key.rightArrow) {
                    moveCursor(new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1));
                } else if (key.upArrow) {
                    moveCursor(new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7));
                } else if (key.downArrow) {
                    moveCursor(new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7));
                } else if (key.pageUp) {
                    moveCursor(shiftMonth(current, -1));
                } else if (key.pageDown) {
                    moveCursor(shiftMonth(current, 1));
                } else if (key.return) {
                    onSubmit?.(current);
                }
            },
            [isFocused, moveCursor, onSubmit],
        ),
        { isActive: !isDisabled && isFocused },
    );

    const monthLabel = `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;

    return (
        <Box borderColor={isFocused ? accentColor : undefined} borderStyle="round" flexDirection="column" paddingX={1}>
            <Box justifyContent="center">
                <Text bold color={accentColor}>
                    {monthLabel}
                </Text>
            </Box>
            <Box marginTop={1}>
                {weekdayLabels.map((name) => (
                    <Box key={name} width={3}>
                        <Text dimColor>{name.padEnd(2, " ")}</Text>
                    </Box>
                ))}
            </Box>
            {weeks.map((week, weekIndex) => (
                // eslint-disable-next-line react-x/no-array-index-key -- calendar grid is positionally stable
                <Box key={weekIndex}>
                    {week.map((day, dayIndex) => {
                        if (day === undefined) {
                            return (
                                // eslint-disable-next-line react-x/no-array-index-key -- calendar grid is positionally stable
                                <Box key={dayIndex} width={3}>
                                    <Text>{"   "}</Text>
                                </Box>
                            );
                        }

                        const isToday = isSameDay(day, today);
                        const isCursor = isSameDay(day, cursor);
                        const outOfRange = isOutOfRange(day, minDate, maxDate);
                        const focusedColor = isToday ? selectedColor : undefined;
                        const dayColor = isCursor && isFocused ? "black" : focusedColor;

                        return (
                            // eslint-disable-next-line react-x/no-array-index-key -- calendar grid is positionally stable
                            <Box key={dayIndex} width={3}>
                                <Text
                                    backgroundColor={isCursor && isFocused ? accentColor : undefined}
                                    bold={isToday}
                                    color={dayColor}
                                    dimColor={outOfRange || isDisabled}
                                >
                                    {String(day.getDate()).padStart(2, " ")}
{" "}
                                </Text>
                            </Box>
                        );
                    })}
                </Box>
            ))}
        </Box>
    );
}

export { Calendar };
export type { Props as CalendarProps };
