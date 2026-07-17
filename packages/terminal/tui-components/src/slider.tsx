/* eslint-disable jsdoc/informative-docs, react/function-component-definition, sonarjs/no-nested-conditional */

/**
 * Slider component for Ink.
 *
 * A keyboard-driven range input for terminal UIs, supporting
 * horizontal and vertical orientations.
 */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import useInput from "@visulima/tui/hooks/use-input";
import type { ReactElement } from "react";
import { useCallback, useRef, useState } from "react";
import type { LiteralUnion } from "type-fest";

export type Props = {
    /**
     * Accent color for the filled portion of the track and thumb.
     * @default "green"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Color for the empty portion of the track.
     * @default "gray"
     */
    readonly defaultColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Initial value when uncontrolled.
     * @default 0
     */
    readonly defaultValue?: number;

    /**
     * Character used for the empty portion of the track.
     * @default "░"
     */
    readonly emptyCharacter?: string;

    /**
     * Character used for the filled portion of the track.
     * @default "█"
     */
    readonly filledCharacter?: string;

    /**
     * When true, all input is ignored and the slider is dimmed.
     * @default false
     */
    readonly isDisabled?: boolean;

    /**
     * When true, the component responds to keyboard input.
     * @default true
     */
    readonly isFocused?: boolean;

    /**
     * Maximum value.
     * @default 100
     */
    readonly max?: number;

    /**
     * Minimum value.
     * @default 0
     */
    readonly min?: number;

    /**
     * Fires whenever the value changes.
     */
    readonly onChange?: (value: number) => void;

    /**
     * Layout direction of the slider.
     * @default "horizontal"
     */
    readonly orientation?: "horizontal" | "vertical";

    /**
     * Increment size for arrow key presses.
     * @default 1
     */
    readonly step?: number;

    /**
     * Character used to indicate the current position.
     * @default "●"
     */
    readonly thumbCharacter?: string;

    /**
     * Controlled value. When provided, `defaultValue` is ignored.
     */
    readonly value?: number;

    /**
     * Width of the slider track in columns (horizontal) or rows (vertical).
     * @default 20
     */
    readonly width?: number;
};

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * A keyboard-driven slider / range input.
 *
 * ```tsx
 * &lt;Slider defaultValue={50} min={0} max={100} onChange={setValue} />
 * ```
 */
export default function Slider({
    accentColor = "green",
    defaultColor = "gray",
    defaultValue = 0,
    emptyCharacter = "\u2591",
    filledCharacter = "\u2588",
    isDisabled = false,
    isFocused = true,
    max = 100,
    min = 0,
    onChange,
    orientation = "horizontal",
    step = 1,
    thumbCharacter = "\u25CF",
    value: controlledValue,
    width = 20,
}: Props): ReactElement {
    // Ensure min <= max
    const safeMin = Math.min(min, max);
    const safeMax = Math.max(min, max);

    const isControlled = controlledValue !== undefined;
    const [internalValue, setInternalValue] = useState(clamp(defaultValue, safeMin, safeMax));
    const current = isControlled ? clamp(controlledValue, safeMin, safeMax) : internalValue;

    const onChangeRef = useRef(onChange);

    onChangeRef.current = onChange;
    const currentRef = useRef(current);

    currentRef.current = current;

    const setValue = useCallback(
        (next: number) => {
            const clamped = clamp(next, safeMin, safeMax);

            if (!isControlled) {
                setInternalValue(clamped);
            }

            onChangeRef.current?.(clamped);
        },
        [safeMin, safeMax, isControlled],
    );

    const largeStep = step * 10;
    const range = safeMax - safeMin;

    const inputHandler = useCallback(
        (
            input: string,
            key: {
                downArrow: boolean;
                end: boolean;
                home: boolean;
                leftArrow: boolean;
                pageDown: boolean;
                pageUp: boolean;
                rightArrow: boolean;
                upArrow: boolean;
            },
        ) => {
            const isForward = orientation === "horizontal" ? key.rightArrow : key.upArrow;
            const isBackward = orientation === "horizontal" ? key.leftArrow : key.downArrow;

            if (isForward) {
                setValue(currentRef.current + step);

                return;
            }

            if (isBackward) {
                setValue(currentRef.current - step);

                return;
            }

            if (key.pageUp) {
                setValue(currentRef.current + largeStep);

                return;
            }

            if (key.pageDown) {
                setValue(currentRef.current - largeStep);

                return;
            }

            if (key.home) {
                setValue(safeMin);

                return;
            }

            if (key.end) {
                setValue(safeMax);

                return;
            }

            // Number keys 0-9: jump to percentage
            if (input >= "0" && input <= "9") {
                const percent = Number.parseInt(input, 10) / 10;

                setValue(safeMin + range * percent);
            }
        },
        [step, largeStep, safeMin, safeMax, range, orientation, setValue],
    );

    useInput(inputHandler, { isActive: isFocused && !isDisabled });

    // Calculate thumb position
    const trackSize = Math.max(1, width);
    const ratio = range === 0 ? 0 : (current - safeMin) / range;
    const thumbPos = Math.round(ratio * (trackSize - 1));

    if (orientation === "vertical") {
        const rows: ReactElement[] = [];

        for (let index = trackSize - 1; index >= 0; index--) {
            const isThumb = index === thumbPos;
            const isFilled = index <= thumbPos;

            rows.push(
                <Box key={index}>
                    <Text color={isDisabled ? undefined : isFilled ? accentColor : defaultColor} dimColor={isDisabled}>
                        {isThumb ? thumbCharacter : isFilled ? filledCharacter : emptyCharacter}
                    </Text>
                </Box>,
            );
        }

        return <Box flexDirection="column">{rows}</Box>;
    }

    // Horizontal
    let track = "";

    for (let index = 0; index < trackSize; index++) {
        if (index === thumbPos) {
            track += thumbCharacter;
        } else if (index < thumbPos) {
            track += filledCharacter;
        } else {
            track += emptyCharacter;
        }
    }

    // Split into filled (before+including thumb) and empty (after thumb) for coloring
    const filledPart = track.slice(0, thumbPos);
    const thumb = track[thumbPos] ?? "";
    const emptyPart = track.slice(thumbPos + 1);

    return (
        <Box>
            <Text color={isDisabled ? undefined : accentColor} dimColor={isDisabled}>
                {filledPart}
            </Text>
            <Text bold color={isDisabled ? undefined : accentColor} dimColor={isDisabled}>
                {thumb}
            </Text>
            <Text color={isDisabled ? undefined : defaultColor} dimColor={isDisabled}>
                {emptyPart}
            </Text>
        </Box>
    );
}

export { Slider };
export type { Props as SliderProps };
