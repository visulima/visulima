/* eslint-disable @stylistic/operator-linebreak, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/prefer-nullish-coalescing, e18e/prefer-static-regex, sonarjs/no-nested-conditional */
import Yoga from "yoga-layout";

type YogaNode = ReturnType<typeof Yoga.Node.create>;

// Standard ANSI 16-color name → index mapping
// Matches chalk/Ink color names exactly so examples port 1:1
export const NAMED_COLORS: Record<string, number> = {
    black: 0,
    // bright variants
    blackBright: 8,
    blue: 4,
    blueBright: 12,
    cyan: 6,
    cyanBright: 14,
    gray: 8,
    green: 2,
    greenBright: 10,
    grey: 8,
    magenta: 5,
    magentaBright: 13,
    red: 1,
    redBright: 9,
    white: 7,
    whiteBright: 15,
    yellow: 3,
    yellowBright: 11,
};

/**
 * Map an RGB triple (0-255 each) to the nearest ANSI 256-color index.
 * Colors 16-231 form a 6×6×6 RGB cube: index = 16 + 36r + 6g + b (r/g/b each 0-5).
 */
function rgbToAnsi256(r: number, g: number, b: number): number {
    const ri = Math.round(r / 51);
    const gi = Math.round(g / 51);
    const bi = Math.round(b / 51);

    return 16 + 36 * ri + 6 * gi + bi;
}

/**
 * Resolve a color value to an ANSI 256-color index.
 * Accepts: number (pass-through), string name ("green"), hex ("#FF8800"),
 * rgb() ("rgb(255,136,0)"), ansi256() ("ansi256(42)"), or undefined (→ 255 = terminal default).
 */
export function resolveColor(color: number | string | undefined): number {
    if (color === undefined) {
        return 255;
    }

    if (typeof color === "number") {
        return color;
    }

    if (color in NAMED_COLORS) {
        return NAMED_COLORS[color]!;
    }

    // ansi256(N) syntax
    const ansiMatch = /^ansi256\(\s*(\d+)\s*\)$/.exec(color);

    if (ansiMatch) {
        return Number(ansiMatch[1]);
    }

    // #RGB shorthand → expand to #RRGGBB
    const hex3Match = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(color);

    if (hex3Match) {
        return rgbToAnsi256(
            Number.parseInt(hex3Match[1]! + hex3Match[1]!, 16),
            Number.parseInt(hex3Match[2]! + hex3Match[2]!, 16),
            Number.parseInt(hex3Match[3]! + hex3Match[3]!, 16),
        );
    }

    // #RRGGBB hex
    const hexMatch = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);

    if (hexMatch) {
        return rgbToAnsi256(Number.parseInt(hexMatch[1]!, 16), Number.parseInt(hexMatch[2]!, 16), Number.parseInt(hexMatch[3]!, 16));
    }

    // rgb(R, G, B)
    const rgbMatch = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(color);

    if (rgbMatch) {
        return rgbToAnsi256(Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3]));
    }

    return 255; // unrecognised → terminal default
}

export type Styles = {
    alignContent?: "flex-start" | "flex-end" | "center" | "stretch" | "space-between" | "space-around";
    alignItems?: "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
    alignSelf?: "flex-start" | "center" | "flex-end" | "auto" | "stretch" | "baseline";
    aspectRatio?: number;
    backgroundColor?: number | string;

    bg?: number | string;
    // Ink-compatible Text style props (set bits in the styles byte)
    bold?: boolean;
    borderBottom?: boolean;

    borderBottomColor?: number | string;
    borderColor?: number | string;
    borderLeft?: boolean;
    borderLeftColor?: number | string;
    borderRight?: boolean;
    borderRightColor?: number | string;
    borderStyle?: "single" | "double" | "round" | "bold" | "singleDouble" | "doubleSingle" | "classic";

    borderTop?: boolean;
    borderTopColor?: number | string;
    bottom?: number | string;
    color?: number | string;
    columnGap?: number;
    dim?: boolean;
    display?: "flex" | "none";

    // Terminal-specific numeric props (native renderer)
    fg?: number | string;
    flexBasis?: number | string;
    flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
    flexGrow?: number;
    flexShrink?: number;

    flexWrap?: "nowrap" | "wrap" | "wrap-reverse";
    gap?: number;
    height?: number | string;
    /** Internal flag for sticky header alternate nodes */
    internalStickyAlternate?: boolean;

    inverse?: boolean;
    italic?: boolean;
    justifyContent?: "flex-start" | "flex-end" | "space-between" | "space-around" | "space-evenly" | "center";
    left?: number | string;
    margin?: number;
    marginBottom?: number;
    marginLeft?: number;

    marginRight?: number;
    marginTop?: number;

    marginX?: number;
    marginY?: number;
    maxHeight?: number | string;
    maxWidth?: number | string;
    minHeight?: number | string;

    minWidth?: number | string;
    overflow?: "hidden" | "scroll" | "visible";
    overflowX?: "hidden" | "scroll" | "visible";
    overflowY?: "hidden" | "scroll" | "visible";
    padding?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    paddingRight?: number;

    paddingTop?: number;
    paddingX?: number;

    paddingY?: number;
    position?: "absolute" | "relative" | "static";
    right?: number | string;
    rowGap?: number;
    scrollbar?: boolean;
    scrollbarThumbColor?: string;
    scrollLeft?: number;
    scrollTop?: number;
    sticky?: boolean;
    strikethrough?: boolean;
    styles?: number;

    top?: number | string;
    underline?: boolean;
    width?: number | string;
};

const positionEdges = [
    ["top", Yoga.EDGE_TOP],
    ["right", Yoga.EDGE_RIGHT],
    ["bottom", Yoga.EDGE_BOTTOM],
    ["left", Yoga.EDGE_LEFT],
] as const;

const applyPositionStyles = (node: YogaNode, style: Styles): void => {
    if ("position" in style) {
        node.setPositionType(
            style.position === "absolute"
                ? Yoga.POSITION_TYPE_ABSOLUTE
                : // static maps to relative because there is no static conceptually
                Yoga.POSITION_TYPE_RELATIVE,
        );
    }

    for (const [property, edge] of positionEdges) {
        if (property in style) {
            const value = style[property as keyof Styles] as number | string;

            if (typeof value === "string") {
                node.setPositionPercent(edge, Number.parseFloat(value));
            } else {
                node.setPosition(edge, value);
            }
        }
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
        node.setMargin(Yoga.EDGE_LEFT, style.marginLeft ?? 0);
    }

    if ("marginRight" in style) {
        node.setMargin(Yoga.EDGE_RIGHT, style.marginRight ?? 0);
    }

    if ("marginTop" in style) {
        node.setMargin(Yoga.EDGE_TOP, style.marginTop ?? 0);
    }

    if ("marginBottom" in style) {
        node.setMargin(Yoga.EDGE_BOTTOM, style.marginBottom ?? 0);
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
        node.setPadding(Yoga.EDGE_LEFT, style.paddingLeft ?? 0);
    }

    if ("paddingRight" in style) {
        node.setPadding(Yoga.EDGE_RIGHT, style.paddingRight ?? 0);
    }

    if ("paddingTop" in style) {
        node.setPadding(Yoga.EDGE_TOP, style.paddingTop ?? 0);
    }

    if ("paddingBottom" in style) {
        node.setPadding(Yoga.EDGE_BOTTOM, style.paddingBottom ?? 0);
    }
};

const applyFlexStyles = (node: YogaNode, style: Styles): void => {
    if ("flexGrow" in style) {
        node.setFlexGrow(style.flexGrow ?? 0);
    }

    if ("flexShrink" in style) {
        node.setFlexShrink(style.flexShrink ?? 1);
    }

    if ("flexWrap" in style) {
        node.setFlexWrap(style.flexWrap === "nowrap" ? Yoga.WRAP_NO_WRAP : style.flexWrap === "wrap" ? Yoga.WRAP_WRAP : Yoga.WRAP_WRAP_REVERSE);
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
            node.setFlexBasis(Number.NaN);
        }
    }

    if ("alignItems" in style) {
        const map: Record<string, any> = {
            baseline: Yoga.ALIGN_BASELINE,
            center: Yoga.ALIGN_CENTER,
            "flex-end": Yoga.ALIGN_FLEX_END,
            "flex-start": Yoga.ALIGN_FLEX_START,
            stretch: Yoga.ALIGN_STRETCH,
        };

        node.setAlignItems(map[style.alignItems || "stretch"]);
    }

    if ("alignSelf" in style) {
        const map: Record<string, any> = {
            auto: Yoga.ALIGN_AUTO,
            baseline: Yoga.ALIGN_BASELINE,
            center: Yoga.ALIGN_CENTER,
            "flex-end": Yoga.ALIGN_FLEX_END,
            "flex-start": Yoga.ALIGN_FLEX_START,
            stretch: Yoga.ALIGN_STRETCH,
        };

        node.setAlignSelf(map[style.alignSelf || "auto"]);
    }

    if ("alignContent" in style) {
        const map: Record<string, any> = {
            center: Yoga.ALIGN_CENTER,
            "flex-end": Yoga.ALIGN_FLEX_END,
            "flex-start": Yoga.ALIGN_FLEX_START,
            "space-around": Yoga.ALIGN_SPACE_AROUND,
            "space-between": Yoga.ALIGN_SPACE_BETWEEN,
            stretch: Yoga.ALIGN_STRETCH,
        };

        node.setAlignContent(map[style.alignContent || "flex-start"]);
    }

    if ("justifyContent" in style) {
        const map: Record<string, any> = {
            center: Yoga.JUSTIFY_CENTER,
            "flex-end": Yoga.JUSTIFY_FLEX_END,
            "flex-start": Yoga.JUSTIFY_FLEX_START,
            "space-around": Yoga.JUSTIFY_SPACE_AROUND,
            "space-between": Yoga.JUSTIFY_SPACE_BETWEEN,
            "space-evenly": Yoga.JUSTIFY_SPACE_EVENLY,
        };

        node.setJustifyContent(map[style.justifyContent || "flex-start"]);
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

export const applyStyles = (node: YogaNode, style: Styles = {}, currentStyle: Styles = style): void => {
    applyPositionStyles(node, style);
    applyMarginStyles(node, style);
    applyPaddingStyles(node, style);
    applyFlexStyles(node, style);
    applyDimensionStyles(node, style);
    applyDisplayStyles(node, style);
    applyBorderStyles(node, style, currentStyle);
    applyGapStyles(node, style);
};
