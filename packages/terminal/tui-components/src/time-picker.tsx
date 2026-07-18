/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import useFocus from "@visulima/tui/hooks/use-focus";
import useInput from "@visulima/tui/hooks/use-input";
import type { ReactElement } from "react";
import { useCallback, useRef, useState } from "react";
import type { LiteralUnion } from "type-fest";

export type TimeValue = {
    readonly hours: number;
    readonly minutes: number;
    readonly seconds?: number;
};

export type Props = {
    /**
     * Accent color for the focused segment.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Auto-focus on mount.
     */
    readonly autoFocus?: boolean;

    /**
     * Initial value when uncontrolled.
     * @default { hours: 0, minutes: 0 }
     */
    readonly defaultValue?: TimeValue;

    /**
     * Use a 12-hour clock with an AM/PM segment instead of 24-hour.
     * @default false
     */
    readonly hour12?: boolean;

    /**
     * Disable input and dim the display.
     */
    readonly isDisabled?: boolean;

    /**
     * Fires whenever any segment changes.
     */
    readonly onChange?: (value: TimeValue) => void;

    /**
     * Fires on Enter.
     */
    readonly onSubmit?: (value: TimeValue) => void;

    /**
     * Show a seconds segment.
     * @default false
     */
    readonly showSeconds?: boolean;

    /**
     * Controlled value. When provided, `defaultValue` is ignored.
     */
    readonly value?: TimeValue;
};

type Segment = "ampm" | "hours" | "minutes" | "seconds";

const DIGIT_PATTERN = /^\d$/;
const DEFAULT_TIME: TimeValue = { hours: 0, minutes: 0 };

const wrap = (value: number, size: number): number => ((value % size) + size) % size;

const pad = (value: number): string => String(value).padStart(2, "0");

/**
 * A keyboard-driven time input with independent hour/minute (and optional
 * second) segments. ←/→ move between segments, ↑/↓ adjust the focused segment
 * (wrapping), digits type directly, and Enter submits.
 */
export default function TimePicker({
    accentColor = "blue",
    autoFocus = false,
    defaultValue = DEFAULT_TIME,
    hour12 = false,
    isDisabled = false,
    onChange,
    onSubmit,
    showSeconds = false,
    value: controlledValue,
}: Props): ReactElement {
    const { isFocused } = useFocus({ autoFocus, isActive: !isDisabled });
    const isControlled = controlledValue !== undefined;

    const [internal, setInternal] = useState<TimeValue>(defaultValue);
    const current = controlledValue ?? internal;

    const segments: Segment[] = ["hours", "minutes", ...showSeconds ? (["seconds"] as Segment[]) : [], ...hour12 ? (["ampm"] as Segment[]) : []];
    const [segmentIndex, setSegmentIndex] = useState(0);
    const focusedSegment = segments[Math.min(segmentIndex, segments.length - 1)]!;

    const onChangeRef = useRef(onChange);

    onChangeRef.current = onChange;

    // Tracks in-progress two-digit entry for the focused segment; reset whenever
    // focus moves or a non-digit key is pressed.
    const typedRef = useRef<{ segment: Segment; value: number } | null>(null);

    const update = useCallback(
        (next: TimeValue) => {
            if (!isControlled) {
                setInternal(next);
            }

            onChangeRef.current?.(next);
        },
        [isControlled],
    );

    const adjust = useCallback(
        (segment: Segment, delta: number) => {
            switch (segment) {
                case "hours": {
                    update({ ...current, hours: wrap(current.hours + delta, 24) });

                    break;
                }
                case "minutes": {
                    update({ ...current, minutes: wrap(current.minutes + delta, 60) });

                    break;
                }
                case "seconds": {
                    update({ ...current, seconds: wrap((current.seconds ?? 0) + delta, 60) });

                    break;
                }
                default: {
                // AM/PM: flip by ±12 hours.
                    update({ ...current, hours: wrap(current.hours + 12, 24) });
                }
            }
        },
        [current, update],
    );

    const applyDigit = useCallback(
        (segment: Segment, digit: number) => {
            const previous = typedRef.current;
            const combine = previous !== null && previous.segment === segment;

            if (segment === "minutes" || segment === "seconds") {
                let next = combine ? previous.value * 10 + digit : digit;

                if (next > 59) {
                    next = digit;
                }

                typedRef.current = { segment, value: next };
                update(segment === "minutes" ? { ...current, minutes: next } : { ...current, seconds: next });

                return;
            }

            // Hours. In 12-hour mode digits address the 1..12 range and the
            // current AM/PM is preserved; in 24-hour mode they address 0..23.
            const maxHour = hour12 ? 12 : 23;
            let next = combine ? previous.value * 10 + digit : digit;

            if (next > maxHour) {
                next = digit;
            }

            typedRef.current = { segment, value: next };

            if (hour12) {
                const isPm = current.hours >= 12;

                update({ ...current, hours: (next % 12) + (isPm ? 12 : 0) });
            } else {
                update({ ...current, hours: next });
            }
        },
        [current, hour12, update],
    );

    const inputHandler = useCallback(
        (input: string, key: { downArrow: boolean; leftArrow: boolean; return: boolean; rightArrow: boolean; upArrow: boolean }) => {
            if (key.leftArrow) {
                typedRef.current = null;
                setSegmentIndex((index) => wrap(index - 1, segments.length));

                return;
            }

            if (key.rightArrow) {
                typedRef.current = null;
                setSegmentIndex((index) => wrap(index + 1, segments.length));

                return;
            }

            if (key.upArrow) {
                typedRef.current = null;
                adjust(focusedSegment, 1);

                return;
            }

            if (key.downArrow) {
                typedRef.current = null;
                adjust(focusedSegment, -1);

                return;
            }

            if (key.return) {
                onSubmit?.(current);

                return;
            }

            if (DIGIT_PATTERN.test(input)) {
                if (focusedSegment !== "ampm") {
                    applyDigit(focusedSegment, Number.parseInt(input, 10));
                }

                return;
            }

            if ((input === "a" || input === "p") && hour12) {
                typedRef.current = null;

                const isPm = current.hours >= 12;
                const wantPm = input === "p";

                if (isPm !== wantPm) {
                    update({ ...current, hours: wrap(current.hours + 12, 24) });
                }
            }
        },
        [adjust, applyDigit, current, focusedSegment, hour12, onSubmit, segments.length, update],
    );

    useInput(inputHandler, { isActive: isFocused && !isDisabled });

    const hours12 = current.hours % 12 === 0 ? 12 : current.hours % 12;
    const displayHours = hour12 ? hours12 : current.hours;
    const meridiem = current.hours >= 12 ? "PM" : "AM";

    function segmentColor(segment: Segment): LiteralUnion<AnsiColors, string> | undefined {
        return isFocused && focusedSegment === segment ? accentColor : undefined;
    }

    function segmentInverse(segment: Segment): boolean {
        return isFocused && focusedSegment === segment;
    }

    return (
        <Box borderColor={isFocused ? accentColor : undefined} borderStyle="round" paddingX={1}>
            <Text color={segmentColor("hours")} dimColor={isDisabled} inverse={segmentInverse("hours")}>
                {pad(displayHours)}
            </Text>
            <Text dimColor>:</Text>
            <Text color={segmentColor("minutes")} dimColor={isDisabled} inverse={segmentInverse("minutes")}>
                {pad(current.minutes)}
            </Text>
            {showSeconds
                ? (
                <>
                    <Text dimColor>:</Text>
                    <Text color={segmentColor("seconds")} dimColor={isDisabled} inverse={segmentInverse("seconds")}>
                        {pad(current.seconds ?? 0)}
                    </Text>
                </>
                )
                : undefined}
            {hour12
                ? (
                <Box marginLeft={1}>
                    <Text color={segmentColor("ampm")} dimColor={isDisabled} inverse={segmentInverse("ampm")}>
                        {meridiem}
                    </Text>
                </Box>
                )
                : undefined}
        </Box>
    );
}

export { TimePicker };
export type { Props as TimePickerProps };
