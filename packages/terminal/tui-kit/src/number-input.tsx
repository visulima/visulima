/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import useFocus from "@visulima/tui/hooks/use-focus";
import useInput from "@visulima/tui/hooks/use-input";
import type { ReactElement } from "react";
import { useCallback, useRef, useState } from "react";
import type { LiteralUnion } from "type-fest";

export type Props = {
    /**
     * Accent color for the border/caret when focused.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Auto-focus the input on mount.
     */
    readonly autoFocus?: boolean;

    /**
     * Initial value when uncontrolled.
     */
    readonly defaultValue?: number;

    /**
     * Disable input and dim the display.
     */
    readonly isDisabled?: boolean;

    /**
     * Upper bound. Values are clamped on commit and by the stepper.
     */
    readonly max?: number;

    /**
     * Lower bound. Values are clamped on commit and by the stepper.
     */
    readonly min?: number;

    /**
     * Fires whenever the numeric value changes.
     */
    readonly onChange?: (value: number) => void;

    /**
     * Fires when the user presses Enter.
     */
    readonly onSubmit?: (value: number) => void;

    /**
     * Placeholder rendered when the field is empty.
     * @default "0"
     */
    readonly placeholder?: string;

    /**
     * Number of decimal places to allow and display. `0` restricts input to
     * integers.
     * @default 0
     */
    readonly precision?: number;

    /**
     * Show ▲/▼ stepper hints and let ↑/↓ adjust by `step`.
     * @default true
     */
    readonly showControls?: boolean;

    /**
     * Increment applied by ↑/↓ (and Shift for 10× via PageUp/PageDown).
     * @default 1
     */
    readonly step?: number;

    /**
     * Controlled value. When provided, `defaultValue` is ignored.
     */
    readonly value?: number;
};

const clamp = (value: number, min: number | undefined, max: number | undefined): number => {
    let next = value;

    if (min !== undefined && next < min) {
        next = min;
    }

    if (max !== undefined && next > max) {
        next = max;
    }

    return next;
};

const roundTo = (value: number, precision: number): number => {
    const factor = 10 ** precision;

    return Math.round(value * factor) / factor;
};

const DIGIT_PATTERN = /^\d$/;

function format(value: number, precision: number): string {
    return precision > 0 ? value.toFixed(precision) : String(value);
}

/**
 * A keyboard-driven numeric input. Type digits (and `-`/`.` where allowed),
 * use ↑/↓ to step by `step`, PageUp/PageDown for 10× steps, and Enter to
 * submit. The raw text buffer is validated so partial entries like `-` or
 * `1.` are allowed while typing but clamped/parsed on change.
 */
export default function NumberInput({
    accentColor = "blue",
    autoFocus = false,
    defaultValue,
    isDisabled = false,
    max,
    min,
    onChange,
    onSubmit,
    placeholder = "0",
    precision = 0,
    showControls = true,
    step = 1,
    value: controlledValue,
}: Props): ReactElement {
    const { isFocused } = useFocus({ autoFocus, isActive: !isDisabled });
    const isControlled = controlledValue !== undefined;

    const [buffer, setBuffer] = useState<string>(defaultValue === undefined ? "" : format(defaultValue, precision));

    const onChangeRef = useRef(onChange);

    onChangeRef.current = onChange;

    const displayBuffer = isControlled ? format(controlledValue, precision) : buffer;

    const commit = useCallback(
        (next: number) => {
            const clamped = clamp(roundTo(next, precision), min, max);

            if (!isControlled) {
                setBuffer(format(clamped, precision));
            }

            onChangeRef.current?.(clamped);

            return clamped;
        },
        [isControlled, max, min, precision],
    );

    const parseBuffer = useCallback((raw: string): number => {
        const parsed = Number.parseFloat(raw);

        return Number.isFinite(parsed) ? parsed : 0;
    }, []);

    const inputHandler = useCallback(
        (input: string, key: { backspace: boolean; delete: boolean; downArrow: boolean; pageDown: boolean; pageUp: boolean; return: boolean; upArrow: boolean }) => {
            if (key.upArrow) {
                commit(parseBuffer(displayBuffer) + step);

                return;
            }

            if (key.downArrow) {
                commit(parseBuffer(displayBuffer) - step);

                return;
            }

            if (key.pageUp) {
                commit(parseBuffer(displayBuffer) + step * 10);

                return;
            }

            if (key.pageDown) {
                commit(parseBuffer(displayBuffer) - step * 10);

                return;
            }

            if (key.return) {
                onSubmit?.(commit(parseBuffer(displayBuffer)));

                return;
            }

            // Text editing works in both modes. Uncontrolled mode keeps a string
            // buffer so partial entries like `-` or `1.` survive; controlled mode
            // edits from the displayed value and emits onChange (partial states
            // can't round-trip a numeric `value`, but digit entry still works).
            const base = isControlled ? displayBuffer : buffer;

            if (key.backspace || key.delete) {
                const next = base.slice(0, -1);

                if (!isControlled) {
                    setBuffer(next);
                }

                onChangeRef.current?.(clamp(roundTo(parseBuffer(next), precision), min, max));

                return;
            }

            // Accept a leading minus, a single decimal point (when precision > 0),
            // and digits. Reject anything that would make the buffer unparseable.
            if (input === "-" && base.length === 0 && (min === undefined || min < 0)) {
                if (!isControlled) {
                    setBuffer("-");
                }

                return;
            }

            if (input === "." && precision > 0 && !base.includes(".")) {
                if (!isControlled) {
                    setBuffer(base.length === 0 ? "0." : `${base}.`);
                }

                return;
            }

            if (DIGIT_PATTERN.test(input)) {
                const next = `${base}${input}`;

                // Guard against more decimals than precision allows.
                const dot = next.indexOf(".");

                if (dot !== -1 && next.length - dot - 1 > precision) {
                    return;
                }

                if (!isControlled) {
                    setBuffer(next);
                }

                onChangeRef.current?.(clamp(roundTo(parseBuffer(next), precision), min, max));
            }
        },
        [buffer, commit, displayBuffer, isControlled, max, min, onSubmit, parseBuffer, precision, step],
    );

    useInput(inputHandler, { isActive: isFocused && !isDisabled });

    const isEmpty = displayBuffer.length === 0 || displayBuffer === "-";

    return (
        <Box borderColor={isFocused ? accentColor : undefined} borderStyle="round" paddingX={1}>
            {isEmpty ? <Text dimColor>{placeholder}</Text> : <Text color={isDisabled ? undefined : accentColor} dimColor={isDisabled}>{displayBuffer}</Text>}
            {isFocused && !isEmpty ? <Text color={accentColor}>▏</Text> : undefined}
            {showControls
                ? (
                <Box marginLeft={1}>
                    <Text dimColor>▲▼</Text>
                </Box>
                )
                : undefined}
        </Box>
    );
}

export { NumberInput };
export type { Props as NumberInputProps };
