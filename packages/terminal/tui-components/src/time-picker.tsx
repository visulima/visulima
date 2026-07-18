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

    const inputHandler = useCallback(
        (input: string, key: { downArrow: boolean; leftArrow: boolean; return: boolean; rightArrow: boolean; upArrow: boolean }) => {
            if (key.leftArrow) {
                setSegmentIndex((index) => wrap(index - 1, segments.length));

                return;
            }

            if (key.rightArrow) {
                setSegmentIndex((index) => wrap(index + 1, segments.length));

                return;
            }

            if (key.upArrow) {
                adjust(focusedSegment, 1);

                return;
            }

            if (key.downArrow) {
                adjust(focusedSegment, -1);

                return;
            }

            if (key.return) {
                onSubmit?.(current);

                return;
            }

            if (DIGIT_PATTERN.test(input)) {
                const digit = Number.parseInt(input, 10);

                switch (focusedSegment) {
                    case "hours": {
                        update({ ...current, hours: wrap(digit, 24) });

                        break;
                    }
                    case "minutes": {
                        update({ ...current, minutes: wrap(digit, 60) });

                        break;
                    }
                    case "seconds": {
                        update({ ...current, seconds: wrap(digit, 60) });

                        break;
                    }
                    default: {
                        // The AM/PM segment ignores direct digit entry.
                        break;
                    }
                }
            }

            if ((input === "a" || input === "p") && hour12) {
                const isPm = current.hours >= 12;
                const wantPm = input === "p";

                if (isPm !== wantPm) {
                    update({ ...current, hours: wrap(current.hours + 12, 24) });
                }
            }
        },
        [adjust, current, focusedSegment, hour12, onSubmit, segments.length, update],
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
