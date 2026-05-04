/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement, ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import type { LiteralUnion } from "type-fest";

import useFocus from "../hooks/use-focus";
import useInput from "../hooks/use-input";
import Box from "./box";
import Text from "./text";

export type ContentSwitcherOption = {
    readonly content: ReactNode;
    readonly icon?: ReactNode;
    readonly id: string;
    readonly label: string;
};

export type Props = {
    /**
     * Accent color for the selected segment.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Auto-focus the switcher on mount.
     */
    readonly autoFocus?: boolean;

    /**
     * Initial selected id (uncontrolled).
     */
    readonly defaultValue?: string;

    /**
     * Disable input.
     */
    readonly isDisabled?: boolean;

    /**
     * Called when the selection changes.
     */
    readonly onChange?: (id: string) => void;

    /**
     * Segments to toggle between.
     */
    readonly options: ReadonlyArray<ContentSwitcherOption>;

    /**
     * Controlled selected id.
     */
    readonly value?: string;
};

/**
 * Segmented control that flips between mutually exclusive content. More
 * compact than `Tabs`: the selected segment is highlighted as a pill, and
 * only the active segment's content is rendered.
 * @returns A `ReactElement` with a segmented header row and the active
 * panel's content beneath it.
 */
export default function ContentSwitcher({
    accentColor = "blue",
    autoFocus = false,
    defaultValue,
    isDisabled = false,
    onChange,
    options,
    value,
}: Props): ReactElement {
    const { isFocused } = useFocus({ autoFocus, isActive: !isDisabled });
    const initialId = defaultValue ?? options[0]?.id;
    const [internal, setInternal] = useState(initialId);
    const current = value ?? internal;

    const currentIndex = useMemo(() => {
        if (current === undefined) {
            return 0;
        }

        const index = options.findIndex((option) => option.id === current);

        return Math.max(index, 0);
    }, [options, current]);

    const commit = useCallback(
        (index: number) => {
            const target = options[index];

            if (!target) {
                return;
            }

            const currentId = value ?? internal;

            if (target.id === currentId) {
                return;
            }

            if (value === undefined) {
                setInternal(target.id);
            }

            onChange?.(target.id);
        },
        [options, value, internal, onChange],
    );

    useInput(
        useCallback(
            (input, key) => {
                if (!isFocused) {
                    return;
                }

                if (key.leftArrow || input === "h") {
                    commit(Math.max(0, currentIndex - 1));
                } else if (key.rightArrow || input === "l") {
                    commit(Math.min(options.length - 1, currentIndex + 1));
                }
            },
            [isFocused, currentIndex, options.length, commit],
        ),
        { isActive: !isDisabled && isFocused },
    );

    const activeOption = options[currentIndex];

    return (
        <Box flexDirection="column">
            <Box>
                {options.map((option, index) => {
                    const isActive = index === currentIndex;
                    const background = isActive ? accentColor : undefined;
                    const color = isActive ? "black" : undefined;

                    return (
                        <Text backgroundColor={background} color={color} dimColor={isDisabled && !isActive} key={option.id}>
                            {" "}
                            {option.icon === undefined
                                ? undefined
                                : (
<>
{option.icon}
{" "}
</>
                                )}
                            {option.label}
{" "}
                        </Text>
                    );
                })}
            </Box>
            {activeOption === undefined
                ? undefined
                : (
                <Box flexDirection="column" marginTop={1}>
                    {activeOption.content}
                </Box>
                )}
        </Box>
    );
}
