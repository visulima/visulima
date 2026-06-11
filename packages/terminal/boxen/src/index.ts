/**
 * This file is a modified version of the original `boxen` package.
 *
 * MIT License
 *
 * Copyright (c) Sindre Sorhus &lt;sindresorhus@gmail.com> (https://sindresorhus.com)
 */

// eslint-disable-next-line import/no-extraneous-dependencies
import { alignText, getStringWidth, slice, wordWrap, WrapMode } from "@visulima/string";
// eslint-disable-next-line import/no-extraneous-dependencies
import terminalSize from "terminal-size";

import type { Alignment, BorderPosition, BorderStyle, BorderStyleName, DimensionOptions, Options, Spacer, VerticalAlignment } from "./types";
import cliBoxes from "./vendor/cli-boxes/boxes";
import { widestLine } from "./widest-line";

const NEWLINE = "\n";
const PAD = " ";
const NONE = "none";

const getObject = (detail: Partial<Spacer> | number | undefined): Spacer => {
    if (typeof detail === "number") {
        return {
            bottom: detail,
            left: detail * 3,
            right: detail * 3,
            top: detail,
        };
    }

    return {
        bottom: 0,
        left: 0,
        right: 0,
        top: 0,
        ...detail,
    };
};

const getBorderWidth = (borderStyle: BorderStyle | string): number => {
    if (borderStyle === NONE) {
        return 0;
    }

    return 2;
};

// eslint-disable-next-line sonarjs/cognitive-complexity
const getBorderChars = (borderStyle: BorderStyle | string): BorderStyle => {
    const sides = ["topLeft", "topRight", "bottomRight", "bottomLeft", "left", "right", "top", "bottom"];

    let characters: BorderStyle;

    // Create empty border style
    if (borderStyle === NONE) {
        // eslint-disable-next-line no-param-reassign
        borderStyle = {};

        for (const side of sides) {
            // eslint-disable-next-line no-param-reassign
            borderStyle[side as keyof BorderStyle] = "";
        }
    }

    if (typeof borderStyle === "string") {
        const cliBox = cliBoxes[borderStyle as keyof typeof cliBoxes] as BorderStyle | undefined;

        if (cliBox === undefined) {
            throw new TypeError(`Invalid border style: ${borderStyle}`);
        }

        characters = cliBox;
    } else {
        // eslint-disable-next-line no-param-reassign
        borderStyle = { ...borderStyle };

        // Ensure retro-compatibility
        if (typeof borderStyle.vertical === "string") {
            // eslint-disable-next-line no-param-reassign
            borderStyle.left = borderStyle.vertical;
            // eslint-disable-next-line no-param-reassign
            borderStyle.right = borderStyle.vertical;
        }

        // Ensure retro-compatibility
        if (typeof borderStyle.horizontal === "string") {
            // eslint-disable-next-line no-param-reassign
            borderStyle.top = borderStyle.horizontal;
            // eslint-disable-next-line no-param-reassign
            borderStyle.bottom = borderStyle.horizontal;
        }

        for (const side of sides) {
            if (typeof borderStyle[side as keyof BorderStyle] !== "string") {
                throw new TypeError(`Invalid border style: ${side}`);
            }
        }

        characters = borderStyle;
    }

    return characters;
};

const wrapText = (
    text: string,
    colorizeText: (string: string) => string,
    horizontal: string,
    colorizeBorder: (string: string, length: number) => string,
    alignment: string,
) => {
    // eslint-disable-next-line no-param-reassign
    text = colorizeText(text);

    const textWidth = getStringWidth(text);

    let title: string;

    switch (alignment) {
        case "left": {
            title = text + colorizeBorder(horizontal.slice(textWidth), getStringWidth(horizontal.slice(textWidth)));

            break;
        }

        case "right": {
            const seg = horizontal.slice(textWidth + 2);

            title = `${colorizeBorder(seg, getStringWidth(seg))} ${text} `;

            break;
        }

        default: {
            // eslint-disable-next-line no-param-reassign
            horizontal = horizontal.slice(textWidth);

            if (getStringWidth(horizontal) % 2 === 1) {
                // This is needed in case the length is odd
                // eslint-disable-next-line no-param-reassign
                horizontal = slice(horizontal, Math.floor(getStringWidth(horizontal) / 2));

                title =
                    colorizeBorder(slice(horizontal, 1), getStringWidth(slice(horizontal, 1))) + text + colorizeBorder(horizontal, getStringWidth(horizontal)); // We reduce the left part of one character to avoid the bar to go beyond its limit
            } else {
                // eslint-disable-next-line no-param-reassign
                horizontal = slice(horizontal, getStringWidth(horizontal) / 2);

                const horizontalLength = getStringWidth(horizontal);

                title = colorizeBorder(horizontal, horizontalLength) + text + colorizeBorder(horizontal, horizontalLength);
            }

            break;
        }
    }

    return title;
};

type ContentTextOptions = {
    height: number | undefined;
    padding: Spacer;
    textAlignment: Alignment;
    verticalAlignment: VerticalAlignment;
    width: number;
};

const makeContentText = (
    text: string,
    { height, padding, textAlignment, verticalAlignment, width }: ContentTextOptions,
    // eslint-disable-next-line sonarjs/cognitive-complexity
) => {
    // eslint-disable-next-line no-param-reassign
    text = alignText(text, { align: textAlignment }) as string;

    let lines: string[] = text.split(NEWLINE);

    const textWidth = widestLine(text);
    const max = width - padding.left - padding.right;

    if (textWidth > max) {
        const newLines = [];

        for (const line of lines) {
            const createdLines = wordWrap(line, { width: max, wrapMode: WrapMode.BREAK_WORDS });
            const alignedLines = alignText(createdLines, { align: textAlignment });
            const alignedLinesArray = (alignedLines as string).split("\n");
            const longestLength = Math.max(...alignedLinesArray.map((s) => getStringWidth(s)));

            for (const alignedLine of alignedLinesArray) {
                let paddedLine;

                switch (textAlignment) {
                    case "center": {
                        paddedLine = PAD.repeat((max - longestLength) / 2) + alignedLine;
                        break;
                    }

                    case "right": {
                        paddedLine = PAD.repeat(max - longestLength) + alignedLine;
                        break;
                    }

                    default: {
                        paddedLine = alignedLine;
                        break;
                    }
                }

                newLines.push(paddedLine);
            }
        }

        lines = newLines;
    }

    if (textAlignment === "center" && textWidth < max) {
        lines = lines.map((line) => PAD.repeat((max - textWidth) / 2) + line);
    } else if (textAlignment === "right" && textWidth < max) {
        lines = lines.map((line) => PAD.repeat(max - textWidth) + line);
    }

    const paddingLeft = PAD.repeat(padding.left);
    const paddingRight = PAD.repeat(padding.right);

    lines = lines.map((line) => {
        const newLine = paddingLeft + line + paddingRight;
        const remainingWidth = width - getStringWidth(newLine);

        return newLine + PAD.repeat(Math.max(remainingWidth, 0));
    });

    if (padding.top > 0) {
        lines = [...Array.from<string>({ length: padding.top }).fill(PAD.repeat(width)), ...lines];
    }

    if (padding.bottom > 0) {
        lines = [...lines, ...Array.from<string>({ length: padding.bottom }).fill(PAD.repeat(width))];
    }

    if (height && lines.length > height) {
        lines = lines.slice(0, height);
    } else if (height && lines.length < height) {
        const fillerCount = height - lines.length;
        const fillerRow = PAD.repeat(width);

        switch (verticalAlignment) {
            case "bottom": {
                lines = [...Array.from<string>({ length: fillerCount }).fill(fillerRow), ...lines];
                break;
            }

            case "center": {
                const top = Math.floor(fillerCount / 2);
                const bottom = fillerCount - top;

                lines = [...Array.from<string>({ length: top }).fill(fillerRow), ...lines, ...Array.from<string>({ length: bottom }).fill(fillerRow)];
                break;
            }

            default: {
                lines = [...lines, ...Array.from<string>({ length: fillerCount }).fill(fillerRow)];
                break;
            }
        }
    }

    return lines.join(NEWLINE);
};

const boxContent = (content: string, contentWidth: number, columnsWidth: number, options: DimensionOptions): string => {
    // eslint-disable-next-line no-confusing-arrow
    const colorizeBorder = (border: string, position: BorderPosition, length: number): string =>
        options.borderColor ? options.borderColor(border, position, length) : border;
    // eslint-disable-next-line @stylistic/no-extra-parens
    const colorizeHeaderText = (title: string): string => (options.headerTextColor ? options.headerTextColor(title) : title);
    // eslint-disable-next-line @stylistic/no-extra-parens
    const colorizeFooterText = (title: string): string => (options.footerTextColor ? options.footerTextColor(title) : title);
    // eslint-disable-next-line @stylistic/no-extra-parens
    const colorizeContent = (value: string): string => (options.textColor ? options.textColor(value) : value);
    // eslint-disable-next-line @stylistic/no-extra-parens
    const fillBackground = (value: string): string => (options.backgroundColor ? options.backgroundColor(value) : value);

    const chars = getBorderChars(options.borderStyle) as Required<BorderStyle>;

    let marginLeft = PAD.repeat(options.margin.left);

    if (options.float === "center") {
        const marginWidth = Math.max((columnsWidth - contentWidth - getBorderWidth(options.borderStyle)) / 2, 0);

        marginLeft = PAD.repeat(marginWidth);
    } else if (options.float === "right") {
        const marginWidth = Math.max(columnsWidth - contentWidth - options.margin.right - getBorderWidth(options.borderStyle), 0);

        marginLeft = PAD.repeat(marginWidth);
    }

    let result = "";

    if (options.margin.top) {
        result += NEWLINE.repeat(options.margin.top);
    }

    if (options.borderStyle !== NONE || options.headerText) {
        let headerText = colorizeBorder(chars.top.repeat(contentWidth), "top", contentWidth);

        if (options.headerText) {
            headerText = wrapText(
                options.headerText,
                colorizeHeaderText,
                chars.top.repeat(contentWidth),
                (value: string, length: number) => colorizeBorder(value, "top", length),
                options.headerAlignment,
            );
        }

        const topBorder = colorizeBorder(marginLeft + chars.topLeft, "topLeft", getStringWidth(marginLeft + chars.topLeft));

        result += topBorder + headerText + colorizeBorder(chars.topRight, "topRight", getStringWidth(chars.topRight)) + NEWLINE;
    }

    const lines = content.split(NEWLINE);

    // Hoist loop-invariant work out of the per-line map: the left/right border
    // characters and their colorized/measured forms never change between lines.
    const leftBorderWidth = getStringWidth(chars.left);
    const rightBorderWidth = getStringWidth(chars.right);
    const leftBorder = marginLeft + colorizeBorder(chars.left, "left", leftBorderWidth);
    const rightBorder = colorizeBorder(chars.right, "right", rightBorderWidth);

    result += lines.map((line) => leftBorder + fillBackground(colorizeContent(line)) + rightBorder).join(NEWLINE);

    if (options.borderStyle !== NONE || options.footerText) {
        const bottomBorder = NEWLINE + colorizeBorder(marginLeft + chars.bottomLeft, "bottomLeft", getStringWidth(marginLeft + chars.bottomLeft));
        let footerText = colorizeBorder(chars.bottom.repeat(contentWidth), "bottom", contentWidth);

        if (options.footerText) {
            footerText = wrapText(
                options.footerText,
                colorizeFooterText,
                chars.bottom.repeat(contentWidth),
                (value: string, length: number) => colorizeBorder(value, "bottom", length),
                options.footerAlignment,
            );
        }

        result += bottomBorder + footerText + colorizeBorder(chars.bottomRight, "bottomRight", getStringWidth(chars.bottomRight));
    }

    if (options.margin.bottom) {
        result += NEWLINE.repeat(options.margin.bottom);
    }

    return result;
};

// Resolve the dimensions returned by a `fullscreen` callback. Accepts both a
// [width, height] tuple and a { columns, rows } object, and validates the shape.
const resolveFullscreenDimensions = (result: unknown): { columns: number; rows: number } => {
    let columns: unknown;
    let rows: unknown;

    if (Array.isArray(result)) {
        const tuple = result as [unknown, unknown];

        [columns, rows] = tuple;
    } else if (result && typeof result === "object") {
        ({ columns, rows } = result as { columns: unknown; rows: unknown });
    } else {
        throw new TypeError(`"fullscreen" callback must return a [width, height] tuple or { columns, rows } object, got ${typeof result}`);
    }

    if (typeof columns !== "number" || typeof rows !== "number" || Number.isNaN(columns) || Number.isNaN(rows)) {
        throw new TypeError(`"fullscreen" callback returned invalid dimensions; both width and height must be numbers`);
    }

    return { columns, rows };
};

const sanitizeOptions = (options: DimensionOptions, terminal: { columns: number; rows: number }): DimensionOptions => {
    // If fullscreen is enabled, max-out unspecified width/height
    if (options.fullscreen) {
        const { columns, rows } =
            typeof options.fullscreen === "function" ? resolveFullscreenDimensions(options.fullscreen(terminal.columns, terminal.rows)) : terminal;

        // eslint-disable-next-line no-param-reassign
        options.width ??= columns;

        // eslint-disable-next-line no-param-reassign
        options.height ??= rows;
    }

    // If width is provided, make sure it's not below 1
    if (options.width) {
        // eslint-disable-next-line no-param-reassign
        options.width = Math.max(1, options.width - getBorderWidth(options.borderStyle));
    }

    // If height is provided, make sure it's not below 1
    if (options.height) {
        // eslint-disable-next-line no-param-reassign
        options.height = Math.max(1, options.height - getBorderWidth(options.borderStyle));
    }

    return options;
};

const formatTitle = (title: string, borderStyle: BorderStyle | string): string => {
    if (borderStyle === NONE) {
        return title;
    }

    return ` ${title} `;
};

// eslint-disable-next-line sonarjs/cognitive-complexity
const determineDimensions = (text: string, columnsWidth: number, options: DimensionOptions, terminal: { columns: number; rows: number }): DimensionOptions => {
    // eslint-disable-next-line no-param-reassign
    options = sanitizeOptions(options, terminal);

    const widthOverride = options.width !== undefined;
    const borderWidth = getBorderWidth(options.borderStyle);
    const maxWidth = columnsWidth - options.margin.left - options.margin.right - borderWidth;

    // When a fixed `width` is supplied, `widest` is never used to size the box
    // (it resolves to the user width below), so skip the expensive full-text
    // word-wrap + per-line measurement pass entirely.
    const widest = widthOverride
        ? 0
        : widestLine(wordWrap(text, { trim: false, width: columnsWidth - borderWidth, wrapMode: WrapMode.BREAK_WORDS })) +
          options.padding.left +
          options.padding.right;

    // If title and width are provided, title adheres to fixed width
    if (options.headerText && widthOverride) {
        // eslint-disable-next-line no-param-reassign
        options.headerText = slice(options.headerText, 0, Math.max(0, (options.width as number) - 2));

        if (options.headerText) {
            // eslint-disable-next-line no-param-reassign
            options.headerText = formatTitle(options.headerText, options.borderStyle);
        }
    } else if (options.headerText) {
        // eslint-disable-next-line no-param-reassign
        options.headerText = slice(options.headerText, 0, Math.max(0, maxWidth - 2));

        // Recheck if title isn't empty now
        if (options.headerText) {
            // eslint-disable-next-line no-param-reassign
            options.headerText = formatTitle(options.headerText, options.borderStyle);

            // If the title is larger than content, box adheres to title width
            if (getStringWidth(options.headerText) > widest) {
                // eslint-disable-next-line no-param-reassign
                options.width = getStringWidth(options.headerText);
            }
        }
    }

    // If fixed width is provided, use it or content width as reference
    // eslint-disable-next-line no-param-reassign
    options.width = options.width ?? widest;

    if (!widthOverride) {
        if (options.margin.left && options.margin.right && options.width > maxWidth) {
            // Let's assume we have margins: left = 3, right = 5, in total = 8
            const spaceForMargins = columnsWidth - options.width - borderWidth;
            // Let's assume we have space = 4
            const multiplier = spaceForMargins / (options.margin.left + options.margin.right);

            // Here: multiplier = 4/8 = 0.5
            // eslint-disable-next-line no-param-reassign
            options.margin.left = Math.max(0, Math.floor(options.margin.left * multiplier));
            // eslint-disable-next-line no-param-reassign
            options.margin.right = Math.max(0, Math.floor(options.margin.right * multiplier));
            // Left: 3 * 0.5 = 1.5 -> 1
            // Right: 6 * 0.5 = 3
        }

        // Re-cap width considering the margins after shrinking
        // eslint-disable-next-line no-param-reassign
        options.width = Math.min(options.width, columnsWidth - borderWidth - options.margin.left - options.margin.right);
    }

    // Prevent padding overflow
    if (options.width - (options.padding.left + options.padding.right) <= 0) {
        // eslint-disable-next-line no-param-reassign
        options.padding.left = 0;
        // eslint-disable-next-line no-param-reassign
        options.padding.right = 0;
    }

    if (options.height && options.height - (options.padding.top + options.padding.bottom) <= 0) {
        // eslint-disable-next-line no-param-reassign
        options.padding.top = 0;
        // eslint-disable-next-line no-param-reassign
        options.padding.bottom = 0;
    }

    return options;
};

const describeType = (value: unknown): string => {
    if (value === null) {
        return "null";
    }

    return typeof value;
};

const assertFunction = (value: unknown, name: string): void => {
    if (value !== undefined && typeof value !== "function") {
        throw new TypeError(`"${name}" must be a function, got ${describeType(value)}`);
    }
};

/**
 * Render a string inside a styled, bordered box for terminal output.
 *
 * Supports borders, padding, margins, horizontal/vertical alignment,
 * header/footer text, float positioning, fixed width/height, per-line text and
 * background colors, and fullscreen sizing.
 * @param text The text to render inside the box.
 * @param options {@link Options} controlling border, spacing, alignment and color.
 * @returns The rendered box as a multi-line string.
 * @example
 * ```js
 * import { boxen } from "@visulima/boxen";
 *
 * console.log(boxen("unicorn", { padding: 1, borderStyle: "round" }));
 * ```
 */
export const boxen = (text: string, options: Options = {}): string => {
    assertFunction(options.borderColor, "borderColor");
    assertFunction(options.textColor, "textColor");
    assertFunction(options.backgroundColor, "backgroundColor");
    assertFunction(options.headerTextColor, "headerTextColor");
    assertFunction(options.footerTextColor, "footerTextColor");

    if (options.fullscreen !== undefined && typeof options.fullscreen !== "boolean" && typeof options.fullscreen !== "function") {
        throw new TypeError(`"fullscreen" must be a boolean or a function, got ${typeof options.fullscreen}`);
    }

    let config: DimensionOptions = {
        borderStyle: "single",
        float: "left",
        footerAlignment: "right",
        headerAlignment: "left",
        textAlignment: "left",
        transformTabToSpace: 4,
        verticalAlignment: "top",
        ...options,
    } as DimensionOptions;

    config.padding = getObject(options.padding ?? 0);
    config.margin = getObject(options.margin);

    // replace tabs with spaces
    if (config.transformTabToSpace) {
        // eslint-disable-next-line no-param-reassign
        text = text.replaceAll("\t", " ".repeat(config.transformTabToSpace));
    }

    // Allow callers to skip the (potentially blocking, non-TTY) terminal-size
    // probe by supplying explicit dimensions — also makes snapshots deterministic.
    const needsTerminalProbe = options.terminalColumns === undefined || (config.fullscreen && options.terminalRows === undefined);
    const probed = needsTerminalProbe ? terminalSize() : { columns: 0, rows: 0 };
    const terminal = {
        columns: options.terminalColumns ?? probed.columns,
        rows: options.terminalRows ?? probed.rows,
    };
    const { columns } = terminal;

    config = determineDimensions(text, columns, config, terminal);

    return boxContent(makeContentText(text, config as ContentTextOptions), config.width as number, columns, config);
};

/**
 * The vendored catalog of built-in border styles, keyed by {@link BorderStyleName}.
 *
 * Exported so consumers can derive a custom {@link BorderStyle} from a built-in
 * one without copying box-drawing characters by hand.
 * @example
 * ```js
 * import { boxen, boxes } from "@visulima/boxen";
 *
 * boxen("foo", { borderStyle: { ...boxes.round, top: "=" } });
 * ```
 */
export const boxes: Record<BorderStyleName, Required<Omit<BorderStyle, "horizontal" | "vertical">>> = cliBoxes as Record<
    BorderStyleName,
    Required<Omit<BorderStyle, "horizontal" | "vertical">>
>;

export type {
    Alignment,
    BaseOptions,
    BorderPosition,
    BorderStyle,
    BorderStyleName,
    DimensionOptions,
    FullscreenDimensions,
    Options,
    Spacer,
    VerticalAlignment,
} from "./types";
