/* eslint-disable react/function-component-definition */

/**
 * Badge component for Ink.
 *
 * Inspired by ink-ui Badge by Vadim Demedes.
 * @see https://github.com/vadimdemedes/ink-ui
 *
 * MIT License
 * Copyright (c) Vadym Demedes (github.com/vadimdemedes)
 */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement, ReactNode } from "react";
import type { LiteralUnion } from "type-fest";

import Text from "./text";

export type Props = {
    /**
     * Label content. Strings are automatically uppercased.
     */
    readonly children: ReactNode;

    /**
     * Background color for the badge.
     * @default "magenta"
     */
    readonly color?: LiteralUnion<AnsiColors, string>;
};

/**
 * Renders an uppercase colored label badge, useful for status indicators.
 */
export default function Badge({ children, color = "magenta" }: Props): ReactElement {
    const formattedChildren = typeof children === "string" ? children.toUpperCase() : children;

    return (
        <Text backgroundColor={color}>
            {" "}
            <Text color="black">{formattedChildren}</Text>
{" "}
        </Text>
    );
}
