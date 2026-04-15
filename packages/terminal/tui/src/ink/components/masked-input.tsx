/* eslint-disable react/function-component-definition */
import type { ReactElement } from "react";
import { useCallback, useMemo, useState } from "react";

import useInput from "../hooks/use-input";
import Box from "./box";
import Text from "./text";

export type Props = {
    /**
     * Initial raw value (digits/characters only, without mask symbols).
     */
    readonly defaultValue?: string;

    /**
     * Disable input and dim the display.
     */
    readonly isDisabled?: boolean;

    /**
     * Mask definition. Each `#` is replaced with a user character; any other
     * character is rendered literally. Example: `(###) ###-####`.
     */
    readonly mask: string;

    /**
     * Called whenever the underlying raw value changes.
     */
    readonly onChange?: (value: string) => void;

    /**
     * Called when the user presses Enter with the current raw value.
     */
    readonly onSubmit?: (value: string) => void;

    /**
     * Placeholder character used in the mask for empty positions.
     * @default "_"
     */
    readonly placeholderChar?: string;

    /**
     * Character used to mark editable positions.
     * @default "#"
     */
    readonly token?: string;
};

const formatValue = (raw: string, mask: string, token: string, placeholderChar: string): string => {
    let rawIndex = 0;
    let output = "";

    for (const maskChar of mask) {
        if (maskChar === token) {
            const rawChar = raw[rawIndex];

            if (rawChar !== undefined) {
                output += rawChar;
                rawIndex += 1;
            } else {
                output += placeholderChar;
            }
        } else {
            output += maskChar;
        }
    }

    return output;
};

const cursorColumn = (raw: string, mask: string, token: string): number => {
    let rawIndex = 0;

    for (const [column, maskChar] of [...mask].entries()) {
        if (maskChar === token) {
            if (rawIndex === raw.length) {
                return column;
            }

            rawIndex += 1;
        }
    }

    return mask.length;
};

/**
 * Input with a fixed-width mask. The mask token (`#` by default) marks
 * positions where the user can type; every other character is preserved.
 */
export default function MaskedInput({
    defaultValue = "",
    isDisabled = false,
    mask,
    onChange,
    onSubmit,
    placeholderChar = "_",
    token = "#",
}: Props): ReactElement {
    const maxLength = useMemo(() => [...mask].filter((c) => c === token).length, [mask, token]);
    const [raw, setRaw] = useState<string>(defaultValue.slice(0, maxLength));

    useInput(
        useCallback(
            (input, key) => {
                if (key.return) {
                    onSubmit?.(raw);

                    return;
                }

                if (key.backspace || key.delete) {
                    if (raw.length === 0) {
                        return;
                    }

                    const next = raw.slice(0, -1);

                    setRaw(next);
                    onChange?.(next);

                    return;
                }

                if (!input || input.length !== 1 || raw.length >= maxLength) {
                    return;
                }

                const next = raw + input;

                setRaw(next);
                onChange?.(next);
            },
            [raw, maxLength, onChange, onSubmit],
        ),
        { isActive: !isDisabled },
    );

    const display = formatValue(raw, mask, token, placeholderChar);
    const cursor = cursorColumn(raw, mask, token);
    const before = display.slice(0, cursor);
    const atCursor = display.charAt(cursor) || " ";
    const after = display.slice(cursor + 1);

    return (
        <Box>
            <Text dimColor={isDisabled}>{before}</Text>
            <Text dimColor={isDisabled} inverse={!isDisabled}>
                {atCursor}
            </Text>
            <Text dimColor={isDisabled}>{after}</Text>
        </Box>
    );
}
