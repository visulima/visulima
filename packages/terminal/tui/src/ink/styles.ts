/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
import type { AnsiColors } from "@visulima/colorize";
import type { Boxes, BoxStyle } from "cli-boxes";
import type { LiteralUnion } from "type-fest";
import type { Node as YogaNode } from "yoga-layout";
import Yoga from "yoga-layout";

export type Styles = {
    /**
     * It defines the alignment along the cross axis when there are multiple lines of flex items (when using flex-wrap).
     * See [align-content](https://css-tricks.com/almanac/properties/a/align-content/).
     */
    readonly alignContent?: "flex-start" | "flex-end" | "center" | "stretch" | "space-between" | "space-around" | "space-evenly";

    /**
     * The align-items property defines the default behavior for how items are laid out along the cross axis (perpendicular to the main axis).
     * See [align-items](https://css-tricks.com/almanac/properties/a/align-items/).
     */
    readonly alignItems?: "flex-start" | "center" | "flex-end" | "stretch" | "baseline";

    /**
     * It makes possible to override the align-items value for specific flex items.
     * See [align-self](https://css-tricks.com/almanac/properties/a/align-self/).
     */
    readonly alignSelf?: "flex-start" | "center" | "flex-end" | "auto" | "stretch" | "baseline";

    /**
     * Defines the aspect ratio (width/height) for the element.
     *
     * Use it with at least one size constraint (`width`, `height`, `minHeight`, or `maxHeight`) so Ink can derive the missing dimension.
     */
    readonly aspectRatio?: number;

    /**
     * Background color for the element.
     *
     * Accepts the same values as `color` in the `&lt;Text>` component.
     */
    readonly backgroundColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Change border background color. A shorthand for setting `borderTopBackgroundColor`, `borderRightBackgroundColor`, `borderBottomBackgroundColor`, and `borderLeftBackgroundColor`.
     */
    readonly borderBackgroundColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Determines whether the bottom border is visible.
     * @default true
     */
    readonly borderBottom?: boolean;

    /**
     * Change the bottom border background color. Accepts the same values as `backgroundColor` in `Text` component.
     */
    readonly borderBottomBackgroundColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Change the bottom border color. Accepts the same values as `color` in `Text` component.
     */
    readonly borderBottomColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Dim the bottom border color.
     * @default false
     */
    readonly borderBottomDimColor?: boolean;

    /**
     * Text to display embedded in the bottom border line.
     * Rendered as: `└─ title ─────────┘`
     */
    readonly borderBottomTitle?: string;

    /**
     * Alignment of the bottom border title.
     * @default "left"
     */
    readonly borderBottomTitleAlignment?: "center" | "left" | "right";

    /**
     * Change border color. A shorthand for setting `borderTopColor`, `borderRightColor`, `borderBottomColor`, and `borderLeftColor`.
     */
    readonly borderColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Dim the border color. A shorthand for setting `borderTopDimColor`, `borderBottomDimColor`, `borderLeftDimColor`, and `borderRightDimColor`.
     * @default false
     */
    readonly borderDimColor?: boolean;

    /**
     * Determines whether the left border is visible.
     * @default true
     */
    readonly borderLeft?: boolean;

    /**
     * Change the left border background color. Accepts the same values as `backgroundColor` in `Text` component.
     */
    readonly borderLeftBackgroundColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Change the left border color. Accepts the same values as `color` in `Text` component.
     */
    readonly borderLeftColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Dim the left border color.
     * @default false
     */
    readonly borderLeftDimColor?: boolean;

    /**
     * Determines whether the right border is visible.
     * @default true
     */
    readonly borderRight?: boolean;

    /**
     * Change the right border background color. Accepts the same values as `backgroundColor` in `Text` component.
     */
    readonly borderRightBackgroundColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Change the right border color. Accepts the same values as `color` in `Text` component.
     */
    readonly borderRightColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Dim the right border color.
     * @default false
     */
    readonly borderRightDimColor?: boolean;

    /**
     * Add a border with a specified style. If `borderStyle` is `undefined` (the default), no border will be added.
     */
    readonly borderStyle?: keyof Boxes | BoxStyle;

    /**
     * Determines whether the top border is visible.
     * @default true
     */
    readonly borderTop?: boolean;

    /**
     * Change the top border background color. Accepts the same values as `backgroundColor` in `Text` component.
     */
    readonly borderTopBackgroundColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Change the top border color. Accepts the same values as `color` in `Text` component.
     */
    readonly borderTopColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Dim the top border color.
     * @default false
     */
    readonly borderTopDimColor?: boolean;

    /**
     * Text to display on the right side of the top border line.
     * Rendered as: `┌─ title ──── rightTitle ─┐`
     */
    readonly borderTopRightTitle?: string;

    /**
     * Text to display embedded in the top border line.
     * Rendered as: `┌─ title ─────────┐`
     */
    readonly borderTopTitle?: string;

    /**
     * Alignment of the top border title.
     * @default "left"
     */
    readonly borderTopTitleAlignment?: "center" | "left" | "right";

    /**
     * Bottom offset for positioned elements.
     */
    readonly bottom?: number | string;

    /**
     * Size of the gap between an element's columns.
     */
    readonly columnGap?: number;

    /**
     * Set this property to `none` to hide the element.
     */
    readonly display?: "flex" | "none";

    /**
     * It specifies the initial size of the flex item, before any available space is distributed according to the flex factors.
     * See [flex-basis](https://css-tricks.com/almanac/properties/f/flex-basis/).
     */
    readonly flexBasis?: number | string;

    /**
     * It establishes the main-axis, thus defining the direction flex items are placed in the flex container.
     * See [flex-direction](https://css-tricks.com/almanac/properties/f/flex-direction/).
     */
    readonly flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";

    /**
     * This property defines the ability for a flex item to grow if necessary.
     * See [flex-grow](https://css-tricks.com/almanac/properties/f/flex-grow/).
     */
    readonly flexGrow?: number;

    /**
     * It specifies the “flex shrink factor”, which determines how much the flex item will shrink relative to the rest of the flex items in the flex container when there isn’t enough space on the row.
     * See [flex-shrink](https://css-tricks.com/almanac/properties/f/flex-shrink/).
     */
    readonly flexShrink?: number;

    /**
     * It defines whether the flex items are forced in a single line or can be flowed into multiple lines. If set to multiple lines, it also defines the cross-axis which determines the direction new lines are stacked in.
     * See [flex-wrap](https://css-tricks.com/almanac/properties/f/flex-wrap/).
     */
    readonly flexWrap?: "nowrap" | "wrap" | "wrap-reverse";

    /**
     * Size of the gap between an element's columns and rows. A shorthand for `columnGap` and `rowGap`.
     */
    readonly gap?: number;

    /**
     * Height of the element in lines (rows). You can also set it as a percentage, which will calculate the height based on the height of the parent element.
     */
    readonly height?: number | string;

    /**
     * It defines the alignment along the main axis.
     * See [justify-content](https://css-tricks.com/almanac/properties/j/justify-content/).
     */
    readonly justifyContent?: "flex-start" | "flex-end" | "space-between" | "space-around" | "space-evenly" | "center";

    /**
     * Left offset for positioned elements.
     */
    readonly left?: number | string;

    /**
     * Margin on all sides. Equivalent to setting `marginTop`, `marginBottom`, `marginLeft`, and `marginRight`.
     */
    readonly margin?: number;

    /**
     * Bottom margin.
     */
    readonly marginBottom?: number;

    /**
     * Left margin.
     */
    readonly marginLeft?: number;

    /**
     * Right margin.
     */
    readonly marginRight?: number;

    /**
     * Top margin.
     */
    readonly marginTop?: number;

    /**
     * Horizontal margin. Equivalent to setting `marginLeft` and `marginRight`.
     */
    readonly marginX?: number;

    /**
     * Vertical margin. Equivalent to setting `marginTop` and `marginBottom`.
     */
    readonly marginY?: number;

    /**
     * Sets a maximum height of the element in lines (rows). You can also set it as a percentage, which will calculate the maximum height based on the height of the parent element.
     */
    readonly maxHeight?: number | string;

    /**
     * Caps how far the stable scroll height is allowed to grow beyond the
     * content currently in the box, in rows. Only applies when both
     * `stableScrollback` and `overflowToBackbuffer` are enabled.
     *
     * Without a cap, `scrollHeight` for a stable-scrollback box never shrinks
     * and grows monotonically for the lifetime of the box (long-running logs,
     * streaming output). That makes the scrollbar/scrollTop math treat an
     * ever-growing region as scrollable even after the content is gone. This
     * bounds the retained history to at most `maxScrollbackLength` rows past
     * the current content. Omit for the previous unbounded behavior.
     *
     * It also bounds a single-frame backbuffer burst to at most this many rows
     * on a large `scrollTop` jump. A value of `0` therefore disables
     * terminal-scrollback emission entirely (scrolled-off lines are still
     * clipped from the live view, just not flushed to history) — use it to
     * cap growth without keeping any backbuffer, or omit it for unbounded
     * retention.
     */
    readonly maxScrollbackLength?: number;

    /**
     * Sets a maximum width of the element.
     * Percentages aren't supported yet; see https://github.com/facebook/yoga/issues/872.
     */
    readonly maxWidth?: number | string;

    /**
     * Sets a minimum height of the element in lines (rows). You can also set it as a percentage, which will calculate the minimum height based on the height of the parent element.
     */
    readonly minHeight?: number | string;

    /**
     * Sets a minimum width of the element.
     * Percentages aren't supported yet; see https://github.com/facebook/yoga/issues/872.
     */
    readonly minWidth?: number | string;

    /**
     * Behavior for an element's overflow in both directions.
     * @default 'visible'
     */
    readonly overflow?: "visible" | "hidden" | "scroll";

    /**
     * If true, content that is scrolled out of the top of the box (when overflowY is 'scroll')
     * is flushed into the terminal emulator's real scrollback history instead
     * of being clipped and discarded. Scrolling back up in the terminal reveals
     * the original lines.
     *
     * Constraints:
     * - Inline mode only. In alternate-screen mode the terminal has no
     *   scrollback, so this is a no-op. Non-TTY/piped output is also a no-op
     *   (content is clipped as before).
     * - Exactly one scrollable region in the app may enable
     *   `overflowToBackbuffer`. Results are undefined with more than one.
     *
     * Each scrolled-off line is emitted exactly once; scrolling back up never
     * re-emits. Pair with `stableScrollback` to keep `scrollTop` math stable as
     * history accumulates, and `maxScrollbackLength` to bound a single-frame
     * burst on a large `scrollTop` jump.
     * @default false
     */
    readonly overflowToBackbuffer?: boolean;

    /**
     * Behavior for an element's overflow in the horizontal direction.
     * @default 'visible'
     */
    readonly overflowX?: "visible" | "hidden" | "scroll";

    /**
     * Behavior for an element's overflow in the vertical direction.
     * @default 'visible'
     */
    readonly overflowY?: "visible" | "hidden" | "scroll";

    /**
     * Padding on all sides. Equivalent to setting `paddingTop`, `paddingBottom`, `paddingLeft`, and `paddingRight`.
     */
    readonly padding?: number;

    /**
     * Bottom padding.
     */
    readonly paddingBottom?: number;

    /**
     * Left padding.
     */
    readonly paddingLeft?: number;

    /**
     * Right padding.
     */
    readonly paddingRight?: number;

    /**
     * Top padding.
     */
    readonly paddingTop?: number;

    /**
     * Horizontal padding. Equivalent to setting `paddingLeft` and `paddingRight`.
     */
    readonly paddingX?: number;

    /**
     * Vertical padding. Equivalent to setting `paddingTop` and `paddingBottom`.
     */
    readonly paddingY?: number;

    /**
     * Controls how the element is positioned.
     *
     * When `position` is `static`, `top`, `right`, `bottom`, and `left` are ignored.
     */
    readonly position?: "absolute" | "relative" | "static";

    /**
     * Right offset for positioned elements.
     */
    readonly right?: number | string;

    /**
     * Size of the gap between an element's rows.
     */
    readonly rowGap?: number;

    /**
     * Color of the scrollbar thumb when overflow is set to 'scroll'.
     */
    readonly scrollbarThumbColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Horizontal scroll position (in columns). Only applies when overflowX or overflow is 'scroll'.
     */
    readonly scrollLeft?: number;

    /**
     * Vertical scroll position (in rows). Only applies when overflowY or overflow is 'scroll'.
     */
    readonly scrollTop?: number;

    /**
     * If true, and `overflowToBackbuffer` is also enabled, the `scrollHeight` of the box
     * will never decrease as long as the existing history remains valid.
     * This prevents the terminal's scrollback from being corrupted when content shrinks.
     *
     * Growth is bounded by `maxScrollbackLength` (if set); otherwise the stable
     * height grows monotonically for the lifetime of the box.
     * @default false
     */
    readonly stableScrollback?: boolean;

    /**
     * Controls how text wraps when it exceeds the container width.
     *
     * - `wrap` (default) — Wrap at word boundaries; break inside words only when a single word exceeds the width.
     * - `wrap-anywhere` — Break at any character boundary, even when a whitespace break exists earlier.
     * - `wrap-preserve-words` — Wrap at word boundaries; never break inside words (long words may overflow).
     * - `wrap-strict` — Enforce exact width; always break at the column limit.
     * - `hard` — Alias for `wrap-strict`. Fills each line to the full column width, breaking words mid-word as needed.
     * - `truncate` / `truncate-end` — Truncate at the end with an ellipsis.
     * - `truncate-start` — Truncate at the start with an ellipsis.
     * - `truncate-middle` — Truncate in the middle with an ellipsis.
     */
    readonly textWrap?:
        | "hard"
        | "wrap"
        | "wrap-anywhere"
        | "wrap-preserve-words"
        | "wrap-strict"
        | "end"
        | "middle"
        | "truncate-end"
        | "truncate"
        | "truncate-middle"
        | "truncate-start";

    /**
     * Top offset for positioned elements.
     */
    readonly top?: number | string;

    /**
     * Determines whether the user can select text within this element.
     * - `auto`: Default behavior, text is selectable.
     * - `none`: Text cannot be selected.
     * - `text`: Only text can be selected.
     * - `all`: All content is selected on click.
     */
    readonly userSelect?: "auto" | "none" | "text" | "all";

    /**
     * Width of the element in spaces. You can also set it as a percentage, which will calculate the width based on the width of the parent element.
     */
    readonly width?: number | string;
};

const positionEdges = [
    ["top", Yoga.EDGE_TOP],
    ["right", Yoga.EDGE_RIGHT],
    ["bottom", Yoga.EDGE_BOTTOM],
    ["left", Yoga.EDGE_LEFT],
] as const;

const applyPositionStyles = (node: YogaNode, style: Styles): void => {
    if ("position" in style) {
        let positionType = Yoga.POSITION_TYPE_RELATIVE;

        if (style.position === "absolute") {
            positionType = Yoga.POSITION_TYPE_ABSOLUTE;
        } else if (style.position === "static") {
            positionType = Yoga.POSITION_TYPE_STATIC;
        }

        node.setPositionType(positionType);
    }

    for (const [property, edge] of positionEdges) {
        if (!(property in style)) {
            continue;
        }

        const value = style[property];

        if (typeof value === "string") {
            node.setPositionPercent(edge, Number.parseFloat(value));
            continue;
        }

        node.setPosition(edge, value);
    }
};

const applyMarginStyles = (node: YogaNode, style: Styles): void => {
    if ("margin" in style) {
        node.setMargin(Yoga.EDGE_ALL, style.margin ?? 0);
    }

    if ("marginX" in style) {
        node.setMargin(Yoga.EDGE_HORIZONTAL, style.marginX ?? 0);
    }

    if ("marginY" in style) {
        node.setMargin(Yoga.EDGE_VERTICAL, style.marginY ?? 0);
    }

    if ("marginLeft" in style) {
        node.setMargin(Yoga.EDGE_START, style.marginLeft || 0);
    }

    if ("marginRight" in style) {
        node.setMargin(Yoga.EDGE_END, style.marginRight || 0);
    }

    if ("marginTop" in style) {
        node.setMargin(Yoga.EDGE_TOP, style.marginTop || 0);
    }

    if ("marginBottom" in style) {
        node.setMargin(Yoga.EDGE_BOTTOM, style.marginBottom || 0);
    }
};

const applyPaddingStyles = (node: YogaNode, style: Styles): void => {
    if ("padding" in style) {
        node.setPadding(Yoga.EDGE_ALL, style.padding ?? 0);
    }

    if ("paddingX" in style) {
        node.setPadding(Yoga.EDGE_HORIZONTAL, style.paddingX ?? 0);
    }

    if ("paddingY" in style) {
        node.setPadding(Yoga.EDGE_VERTICAL, style.paddingY ?? 0);
    }

    if ("paddingLeft" in style) {
        node.setPadding(Yoga.EDGE_LEFT, style.paddingLeft || 0);
    }

    if ("paddingRight" in style) {
        node.setPadding(Yoga.EDGE_RIGHT, style.paddingRight || 0);
    }

    if ("paddingTop" in style) {
        node.setPadding(Yoga.EDGE_TOP, style.paddingTop || 0);
    }

    if ("paddingBottom" in style) {
        node.setPadding(Yoga.EDGE_BOTTOM, style.paddingBottom || 0);
    }
};

const applyFlexStyles = (node: YogaNode, style: Styles): void => {
    if ("flexGrow" in style) {
        node.setFlexGrow(style.flexGrow ?? 0);
    }

    if ("flexShrink" in style) {
        node.setFlexShrink(typeof style.flexShrink === "number" ? style.flexShrink : 1);
    }

    if ("flexWrap" in style) {
        if (style.flexWrap === "nowrap") {
            node.setFlexWrap(Yoga.WRAP_NO_WRAP);
        }

        if (style.flexWrap === "wrap") {
            node.setFlexWrap(Yoga.WRAP_WRAP);
        }

        if (style.flexWrap === "wrap-reverse") {
            node.setFlexWrap(Yoga.WRAP_WRAP_REVERSE);
        }
    }

    if ("flexDirection" in style) {
        if (style.flexDirection === "row") {
            node.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
        }

        if (style.flexDirection === "row-reverse") {
            node.setFlexDirection(Yoga.FLEX_DIRECTION_ROW_REVERSE);
        }

        if (style.flexDirection === "column") {
            node.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN);
        }

        if (style.flexDirection === "column-reverse") {
            node.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN_REVERSE);
        }
    }

    if ("flexBasis" in style) {
        if (typeof style.flexBasis === "number") {
            node.setFlexBasis(style.flexBasis);
        } else if (typeof style.flexBasis === "string") {
            node.setFlexBasisPercent(Number.parseInt(style.flexBasis, 10));
        } else {
            // This should be replaced with node.setFlexBasisAuto() when new Yoga release is out
            node.setFlexBasis(Number.NaN);
        }
    }

    if ("alignItems" in style) {
        if (style.alignItems === "stretch" || !style.alignItems) {
            node.setAlignItems(Yoga.ALIGN_STRETCH);
        }

        if (style.alignItems === "flex-start") {
            node.setAlignItems(Yoga.ALIGN_FLEX_START);
        }

        if (style.alignItems === "center") {
            node.setAlignItems(Yoga.ALIGN_CENTER);
        }

        if (style.alignItems === "flex-end") {
            node.setAlignItems(Yoga.ALIGN_FLEX_END);
        }

        if (style.alignItems === "baseline") {
            node.setAlignItems(Yoga.ALIGN_BASELINE);
        }
    }

    if ("alignSelf" in style) {
        if (style.alignSelf === "auto" || !style.alignSelf) {
            node.setAlignSelf(Yoga.ALIGN_AUTO);
        }

        if (style.alignSelf === "flex-start") {
            node.setAlignSelf(Yoga.ALIGN_FLEX_START);
        }

        if (style.alignSelf === "center") {
            node.setAlignSelf(Yoga.ALIGN_CENTER);
        }

        if (style.alignSelf === "flex-end") {
            node.setAlignSelf(Yoga.ALIGN_FLEX_END);
        }

        if (style.alignSelf === "stretch") {
            node.setAlignSelf(Yoga.ALIGN_STRETCH);
        }

        if (style.alignSelf === "baseline") {
            node.setAlignSelf(Yoga.ALIGN_BASELINE);
        }
    }

    if ("alignContent" in style) {
        // Keep wrapped lines top-packed by default; stretch can add surprising empty rows in fixed-height boxes.
        if (style.alignContent === "flex-start" || !style.alignContent) {
            node.setAlignContent(Yoga.ALIGN_FLEX_START);
        }

        if (style.alignContent === "center") {
            node.setAlignContent(Yoga.ALIGN_CENTER);
        }

        if (style.alignContent === "flex-end") {
            node.setAlignContent(Yoga.ALIGN_FLEX_END);
        }

        if (style.alignContent === "space-between") {
            node.setAlignContent(Yoga.ALIGN_SPACE_BETWEEN);
        }

        if (style.alignContent === "space-around") {
            node.setAlignContent(Yoga.ALIGN_SPACE_AROUND);
        }

        if (style.alignContent === "space-evenly") {
            node.setAlignContent(Yoga.ALIGN_SPACE_EVENLY);
        }

        if (style.alignContent === "stretch") {
            node.setAlignContent(Yoga.ALIGN_STRETCH);
        }
    }

    if ("justifyContent" in style) {
        if (style.justifyContent === "flex-start" || !style.justifyContent) {
            node.setJustifyContent(Yoga.JUSTIFY_FLEX_START);
        }

        if (style.justifyContent === "center") {
            node.setJustifyContent(Yoga.JUSTIFY_CENTER);
        }

        if (style.justifyContent === "flex-end") {
            node.setJustifyContent(Yoga.JUSTIFY_FLEX_END);
        }

        if (style.justifyContent === "space-between") {
            node.setJustifyContent(Yoga.JUSTIFY_SPACE_BETWEEN);
        }

        if (style.justifyContent === "space-around") {
            node.setJustifyContent(Yoga.JUSTIFY_SPACE_AROUND);
        }

        if (style.justifyContent === "space-evenly") {
            node.setJustifyContent(Yoga.JUSTIFY_SPACE_EVENLY);
        }
    }
};

const applyDimensionStyles = (node: YogaNode, style: Styles): void => {
    if ("width" in style) {
        if (typeof style.width === "number") {
            node.setWidth(style.width);
        } else if (typeof style.width === "string") {
            node.setWidthPercent(Number.parseInt(style.width, 10));
        } else {
            node.setWidthAuto();
        }
    }

    if ("height" in style) {
        if (typeof style.height === "number") {
            node.setHeight(style.height);
        } else if (typeof style.height === "string") {
            node.setHeightPercent(Number.parseInt(style.height, 10));
        } else {
            node.setHeightAuto();
        }
    }

    if ("minWidth" in style) {
        if (typeof style.minWidth === "string") {
            node.setMinWidthPercent(Number.parseInt(style.minWidth, 10));
        } else {
            node.setMinWidth(style.minWidth ?? 0);
        }
    }

    if ("minHeight" in style) {
        if (typeof style.minHeight === "string") {
            node.setMinHeightPercent(Number.parseInt(style.minHeight, 10));
        } else {
            node.setMinHeight(style.minHeight ?? 0);
        }
    }

    if ("maxWidth" in style) {
        if (typeof style.maxWidth === "string") {
            node.setMaxWidthPercent(Number.parseInt(style.maxWidth, 10));
        } else {
            node.setMaxWidth(style.maxWidth);
        }
    }

    if ("maxHeight" in style) {
        if (typeof style.maxHeight === "string") {
            node.setMaxHeightPercent(Number.parseInt(style.maxHeight, 10));
        } else {
            node.setMaxHeight(style.maxHeight);
        }
    }

    if ("aspectRatio" in style) {
        node.setAspectRatio(style.aspectRatio);
    }
};

const applyDisplayStyles = (node: YogaNode, style: Styles): void => {
    if ("display" in style) {
        node.setDisplay(style.display === "flex" ? Yoga.DISPLAY_FLEX : Yoga.DISPLAY_NONE);
    }
};

const applyBorderStyles = (node: YogaNode, style: Styles, currentStyle: Styles): void => {
    const hasBorderChanges = "borderStyle" in style || "borderTop" in style || "borderBottom" in style || "borderLeft" in style || "borderRight" in style;

    if (!hasBorderChanges) {
        return;
    }

    const borderWidth = currentStyle.borderStyle ? 1 : 0;

    node.setBorder(Yoga.EDGE_TOP, currentStyle.borderTop === false ? 0 : borderWidth);
    node.setBorder(Yoga.EDGE_BOTTOM, currentStyle.borderBottom === false ? 0 : borderWidth);
    node.setBorder(Yoga.EDGE_LEFT, currentStyle.borderLeft === false ? 0 : borderWidth);
    node.setBorder(Yoga.EDGE_RIGHT, currentStyle.borderRight === false ? 0 : borderWidth);
};

const applyGapStyles = (node: YogaNode, style: Styles): void => {
    if ("gap" in style) {
        node.setGap(Yoga.GUTTER_ALL, style.gap ?? 0);
    }

    if ("columnGap" in style) {
        node.setGap(Yoga.GUTTER_COLUMN, style.columnGap ?? 0);
    }

    if ("rowGap" in style) {
        node.setGap(Yoga.GUTTER_ROW, style.rowGap ?? 0);
    }
};

const applyOverflowStyles = (node: YogaNode, style: Styles): void => {
    const overflow = style.overflow ?? "visible";
    const overflowX = style.overflowX ?? overflow;
    const overflowY = style.overflowY ?? overflow;

    // Yoga only supports a single overflow property (not per-axis).
    // Per-axis clipping and scroll behavior is handled at the rendering level
    // in render-node-to-output.ts. Here we set the Yoga hint for layout.
    if (overflowX === "scroll" || overflowY === "scroll") {
        node.setOverflow(Yoga.OVERFLOW_SCROLL);
    } else if (overflowX === "hidden" || overflowY === "hidden") {
        node.setOverflow(Yoga.OVERFLOW_HIDDEN);
    } else {
        node.setOverflow(Yoga.OVERFLOW_VISIBLE);
    }
};

const styles = (node: YogaNode, style: Styles = {}, currentStyle: Styles = style): void => {
    applyPositionStyles(node, style);
    applyMarginStyles(node, style);
    applyPaddingStyles(node, style);
    applyFlexStyles(node, style);
    applyDimensionStyles(node, style);
    applyDisplayStyles(node, style);
    applyBorderStyles(node, style, currentStyle);
    applyGapStyles(node, style);
    applyOverflowStyles(node, currentStyle);
};

export default styles;
