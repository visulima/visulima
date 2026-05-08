/* eslint-disable @typescript-eslint/no-shadow, import/no-named-as-default-member, jsdoc/escape-inline-tags, react-perf/jsx-no-new-object-as-prop, react-x/no-use-context, react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import colorizeDefault from "@visulima/colorize";
import type { ReactElement, ReactNode } from "react";
import { useCallback, useContext } from "react";
import type { LiteralUnion } from "type-fest";

import colorize from "../ink/colorize";
import type { Styles } from "../ink/styles";
import { accessibilityContext } from "./accessibility-context";
import { backgroundContext } from "./background-context";

export type Props = {
    /**
     * Hide the element from screen readers.
     */
    readonly "aria-hidden"?: boolean;

    /**
     * A label for the element for screen readers.
     */
    readonly "aria-label"?: string;

    /**
     * Same as `color`, but for the background.
     */
    readonly backgroundColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Make the text bold.
     */
    readonly bold?: boolean;

    readonly children?: ReactNode;

    /**
     * Change text color. Ink uses @visulima/colorize under the hood, so all its functionality is supported.
     */
    readonly color?: LiteralUnion<AnsiColors, string>;

    /**
     * Dim the color (make it less bright).
     */
    readonly dimColor?: boolean;

    /**
     * Inverse background and foreground colors.
     */
    readonly inverse?: boolean;

    /**
     * Make the text italic.
     */
    readonly italic?: boolean;

    /**
     * Make the text crossed out with a line.
     */
    readonly strikethrough?: boolean;

    /**
     * Make the text underlined.
     */
    readonly underline?: boolean;

    /**
     * Controls how text wraps when it exceeds the container width.
     *
     * - `wrap` (default) — Wrap at word boundaries; break inside words only when a single word exceeds the width.
     * - `wrap-anywhere` — Break at any character boundary, even when a whitespace break exists earlier.
     * - `wrap-preserve-words` — Wrap at word boundaries; never break inside words (long words may overflow).
     * - `wrap-strict` — Enforce exact width; always break at the column limit.
     * - `truncate` / `truncate-end` — Truncate at the end with an ellipsis.
     * - `truncate-start` — Truncate at the start with an ellipsis.
     * - `truncate-middle` — Truncate in the middle with an ellipsis.
     */
    readonly wrap?: Styles["textWrap"];
};

/**
 * This component can display text and change its style to make it bold, underlined, italic, or strikethrough.
 */
export default function Text({
    "aria-hidden": ariaHidden = false,
    "aria-label": ariaLabel,
    backgroundColor,
    bold = false,
    children,
    color,
    dimColor = false,
    inverse = false,
    italic = false,
    strikethrough = false,
    underline = false,
    wrap = "wrap",
}: Props): ReactElement | null {
    const { isScreenReaderEnabled } = useContext(accessibilityContext);
    const inheritedBackgroundColor = useContext(backgroundContext);
    const childrenOrAriaLabel = isScreenReaderEnabled && ariaLabel ? ariaLabel : children;

    const transform = useCallback(
        (children: string): string => {
            if (dimColor) {
                children = colorizeDefault.dim(children);
            }

            if (color) {
                children = colorize(children, color, "foreground");
            }

            // Use explicit backgroundColor if provided, otherwise use inherited from parent Box
            const effectiveBackgroundColor = backgroundColor ?? inheritedBackgroundColor;

            if (effectiveBackgroundColor) {
                children = colorize(children, effectiveBackgroundColor, "background");
            }

            if (bold) {
                children = colorizeDefault.bold(children);
            }

            if (italic) {
                children = colorizeDefault.italic(children);
            }

            if (underline) {
                children = colorizeDefault.underline(children);
            }

            if (strikethrough) {
                children = colorizeDefault.strikethrough(children);
            }

            if (inverse) {
                children = colorizeDefault.inverse(children);
            }

            return children;
        },
        [dimColor, color, backgroundColor, inheritedBackgroundColor, bold, italic, underline, strikethrough, inverse],
    );

    if (childrenOrAriaLabel === undefined || childrenOrAriaLabel === null) {
        return null;
    }

    if (isScreenReaderEnabled && ariaHidden) {
        return null;
    }

    return (
        <ink-text internal_transform={transform} style={{ flexDirection: "row", flexGrow: 0, flexShrink: 1, textWrap: wrap }}>
            {isScreenReaderEnabled && ariaLabel ? ariaLabel : children}
        </ink-text>
    );
}

export { Text };
export type { Props as TextProps };
