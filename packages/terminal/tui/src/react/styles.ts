import Yoga from "yoga-layout-prebuilt";

type YogaNode = ReturnType<typeof Yoga.Node.create>;

// Standard ANSI 16-color name → index mapping
// Matches chalk/Ink color names exactly so examples port 1:1
export const NAMED_COLORS: Record<string, number> = {
    black: 0,
    red: 1,
    green: 2,
    yellow: 3,
    blue: 4,
    magenta: 5,
    cyan: 6,
    white: 7,
    // bright variants
    blackBright: 8,
    gray: 8,
    grey: 8,
    redBright: 9,
    greenBright: 10,
    yellowBright: 11,
    blueBright: 12,
    magentaBright: 13,
    cyanBright: 14,
    whiteBright: 15,
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
    if (color === undefined) return 255;
    if (typeof color === "number") return color;
    if (color in NAMED_COLORS) return NAMED_COLORS[color]!;
    // ansi256(N) syntax
    const ansiMatch = /^ansi256\(\s*(\d+)\s*\)$/.exec(color);
    if (ansiMatch) return Number(ansiMatch[1]);
    // #RRGGBB hex
    const hexMatch = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(color);
    if (hexMatch) return rgbToAnsi256(parseInt(hexMatch[1]!, 16), parseInt(hexMatch[2]!, 16), parseInt(hexMatch[3]!, 16));
    // rgb(R, G, B)
    const rgbMatch = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(color);
    if (rgbMatch) return rgbToAnsi256(Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3]));
    return 255; // unrecognised → terminal default
}

export type Styles = {
    position?: "absolute" | "relative" | "static";
    top?: number | string;
    right?: number | string;
    bottom?: number | string;
    left?: number | string;

    columnGap?: number;
    rowGap?: number;
    gap?: number;

    margin?: number;
    marginX?: number;
    marginY?: number;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;

    padding?: number;
    paddingX?: number;
    paddingY?: number;
    paddingTop?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    paddingRight?: number;

    flexGrow?: number;
    flexShrink?: number;
    flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
    flexBasis?: number | string;
    flexWrap?: "nowrap" | "wrap" | "wrap-reverse";

    alignItems?: "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
    alignSelf?: "flex-start" | "center" | "flex-end" | "auto" | "stretch" | "baseline";
    alignContent?: "flex-start" | "flex-end" | "center" | "stretch" | "space-between" | "space-around";
    justifyContent?: "flex-start" | "flex-end" | "space-between" | "space-around" | "space-evenly" | "center";

    width?: number | string;
    height?: number | string;
    minWidth?: number | string;
    minHeight?: number | string;
    maxWidth?: number | string;
    maxHeight?: number | string;

    aspectRatio?: number;
    display?: "flex" | "none";

    borderStyle?: "single" | "double" | "round" | "bold" | "singleDouble" | "doubleSingle" | "classic";
    borderTop?: boolean;
    borderBottom?: boolean;
    borderLeft?: boolean;
    borderRight?: boolean;

    borderColor?: number | string;
    borderTopColor?: number | string;
    borderBottomColor?: number | string;
    borderLeftColor?: number | string;
    borderRightColor?: number | string;

    backgroundColor?: number | string;
    color?: number | string;

    // Ink-compatible Text style props (set bits in the styles byte)
    bold?: boolean;
    dim?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    inverse?: boolean;

    // Terminal-specific numeric props (ratatat native)
    fg?: number | string;
    bg?: number | string;
    styles?: number;
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
    if ("margin" in style) node.setMargin(Yoga.EDGE_ALL, style.margin ?? 0);
    if ("marginX" in style) node.setMargin(Yoga.EDGE_HORIZONTAL, style.marginX ?? 0);
    if ("marginY" in style) node.setMargin(Yoga.EDGE_VERTICAL, style.marginY ?? 0);
    if ("marginLeft" in style) node.setMargin(Yoga.EDGE_START, style.marginLeft ?? 0);
    if ("marginRight" in style) node.setMargin(Yoga.EDGE_END, style.marginRight ?? 0);
    if ("marginTop" in style) node.setMargin(Yoga.EDGE_TOP, style.marginTop ?? 0);
    if ("marginBottom" in style) node.setMargin(Yoga.EDGE_BOTTOM, style.marginBottom ?? 0);
};

const applyPaddingStyles = (node: YogaNode, style: Styles): void => {
    if ("padding" in style) node.setPadding(Yoga.EDGE_ALL, style.padding ?? 0);
    if ("paddingX" in style) node.setPadding(Yoga.EDGE_HORIZONTAL, style.paddingX ?? 0);
    if ("paddingY" in style) node.setPadding(Yoga.EDGE_VERTICAL, style.paddingY ?? 0);
    if ("paddingLeft" in style) node.setPadding(Yoga.EDGE_LEFT, style.paddingLeft ?? 0);
    if ("paddingRight" in style) node.setPadding(Yoga.EDGE_RIGHT, style.paddingRight ?? 0);
    if ("paddingTop" in style) node.setPadding(Yoga.EDGE_TOP, style.paddingTop ?? 0);
    if ("paddingBottom" in style) node.setPadding(Yoga.EDGE_BOTTOM, style.paddingBottom ?? 0);
};

const applyFlexStyles = (node: YogaNode, style: Styles): void => {
    if ("flexGrow" in style) node.setFlexGrow(style.flexGrow ?? 0);
    if ("flexShrink" in style) node.setFlexShrink(style.flexShrink ?? 1);

    if ("flexWrap" in style) {
        node.setFlexWrap(style.flexWrap === "nowrap" ? Yoga.WRAP_NO_WRAP : style.flexWrap === "wrap" ? Yoga.WRAP_WRAP : Yoga.WRAP_WRAP_REVERSE);
    }

    if ("flexDirection" in style) {
        if (style.flexDirection === "row") node.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
        if (style.flexDirection === "row-reverse") node.setFlexDirection(Yoga.FLEX_DIRECTION_ROW_REVERSE);
        if (style.flexDirection === "column") node.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN);
        if (style.flexDirection === "column-reverse") node.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN_REVERSE);
    }

    if ("flexBasis" in style) {
        if (typeof style.flexBasis === "number") node.setFlexBasis(style.flexBasis);
        else if (typeof style.flexBasis === "string") node.setFlexBasisPercent(Number.parseInt(style.flexBasis, 10));
        else node.setFlexBasis(Number.NaN);
    }

    if ("alignItems" in style) {
        const map: Record<string, any> = {
            stretch: Yoga.ALIGN_STRETCH,
            "flex-start": Yoga.ALIGN_FLEX_START,
            center: Yoga.ALIGN_CENTER,
            "flex-end": Yoga.ALIGN_FLEX_END,
            baseline: Yoga.ALIGN_BASELINE,
        };
        node.setAlignItems(map[style.alignItems || "stretch"]);
    }

    if ("alignSelf" in style) {
        const map: Record<string, any> = {
            auto: Yoga.ALIGN_AUTO,
            "flex-start": Yoga.ALIGN_FLEX_START,
            center: Yoga.ALIGN_CENTER,
            "flex-end": Yoga.ALIGN_FLEX_END,
            stretch: Yoga.ALIGN_STRETCH,
            baseline: Yoga.ALIGN_BASELINE,
        };
        node.setAlignSelf(map[style.alignSelf || "auto"]);
    }

    if ("alignContent" in style) {
        const map: Record<string, any> = {
            "flex-start": Yoga.ALIGN_FLEX_START,
            center: Yoga.ALIGN_CENTER,
            "flex-end": Yoga.ALIGN_FLEX_END,
            "space-between": Yoga.ALIGN_SPACE_BETWEEN,
            "space-around": Yoga.ALIGN_SPACE_AROUND,
            stretch: Yoga.ALIGN_STRETCH,
        };
        node.setAlignContent(map[style.alignContent || "flex-start"]);
    }

    if ("justifyContent" in style) {
        const map: Record<string, any> = {
            "flex-start": Yoga.JUSTIFY_FLEX_START,
            center: Yoga.JUSTIFY_CENTER,
            "flex-end": Yoga.JUSTIFY_FLEX_END,
            "space-between": Yoga.JUSTIFY_SPACE_BETWEEN,
            "space-around": Yoga.JUSTIFY_SPACE_AROUND,
            "space-evenly": Yoga.JUSTIFY_SPACE_EVENLY,
        };
        node.setJustifyContent(map[style.justifyContent || "flex-start"]);
    }
};

const applyDimensionStyles = (node: YogaNode, style: Styles): void => {
    if ("width" in style) {
        if (typeof style.width === "number") node.setWidth(style.width);
        else if (typeof style.width === "string") node.setWidthPercent(Number.parseInt(style.width, 10));
        else node.setWidthAuto();
    }
    if ("height" in style) {
        if (typeof style.height === "number") node.setHeight(style.height);
        else if (typeof style.height === "string") node.setHeightPercent(Number.parseInt(style.height, 10));
        else node.setHeightAuto();
    }

    if ("minWidth" in style) {
        if (typeof style.minWidth === "string") node.setMinWidthPercent(Number.parseInt(style.minWidth, 10));
        else node.setMinWidth(style.minWidth ?? 0);
    }
    if ("minHeight" in style) {
        if (typeof style.minHeight === "string") node.setMinHeightPercent(Number.parseInt(style.minHeight, 10));
        else node.setMinHeight(style.minHeight ?? 0);
    }

    if ("maxWidth" in style) {
        if (typeof style.maxWidth === "string") node.setMaxWidthPercent(Number.parseInt(style.maxWidth, 10));
        else node.setMaxWidth(style.maxWidth as number);
    }
    if ("maxHeight" in style) {
        if (typeof style.maxHeight === "string") node.setMaxHeightPercent(Number.parseInt(style.maxHeight, 10));
        else node.setMaxHeight(style.maxHeight as number);
    }

    if ("aspectRatio" in style) node.setAspectRatio(style.aspectRatio!);
};

const applyDisplayStyles = (node: YogaNode, style: Styles): void => {
    if ("display" in style) {
        node.setDisplay(style.display === "flex" ? Yoga.DISPLAY_FLEX : Yoga.DISPLAY_NONE);
    }
};

const applyBorderStyles = (node: YogaNode, style: Styles, currentStyle: Styles): void => {
    const hasBorderChanges = "borderStyle" in style || "borderTop" in style || "borderBottom" in style || "borderLeft" in style || "borderRight" in style;
    if (!hasBorderChanges) return;

    const borderWidth = currentStyle.borderStyle ? 1 : 0;
    node.setBorder(Yoga.EDGE_TOP, currentStyle.borderTop === false ? 0 : borderWidth);
    node.setBorder(Yoga.EDGE_BOTTOM, currentStyle.borderBottom === false ? 0 : borderWidth);
    node.setBorder(Yoga.EDGE_LEFT, currentStyle.borderLeft === false ? 0 : borderWidth);
    node.setBorder(Yoga.EDGE_RIGHT, currentStyle.borderRight === false ? 0 : borderWidth);
};

const applyGapStyles = (node: YogaNode, style: Styles): void => {
    // @ts-ignore
    if ("gap" in style && node.setGap) node.setGap(Yoga.GUTTER_ALL, style.gap ?? 0);
    // @ts-ignore
    if ("columnGap" in style && node.setGap) node.setGap(Yoga.GUTTER_COLUMN, style.columnGap ?? 0);
    // @ts-ignore
    if ("rowGap" in style && node.setGap) node.setGap(Yoga.GUTTER_ROW, style.rowGap ?? 0);
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
