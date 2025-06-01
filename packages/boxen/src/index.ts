/**
 * This file is a modified version of the original `boxen` package.
 *
 * MIT License
 *
 * Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
 */

// eslint-disable-next-line import/no-extraneous-dependencies
import terminalSize from "terminal-size";

// eslint-disable-next-line import/no-extraneous-dependencies
import { alignText, getStringWidth, wordWrap, WrapMode } from "@visulima/string";
import type { BorderPosition, BorderStyle, DimensionOptions, Options, Spacer } from "./types";
import cliBoxes from "./vendor/cli-boxes/boxes";
import { widestLine } from "./widest-line";

const NEWLINE = "\n";
const PAD = " ";
const NONE = "none";

const getObject = (detail: Partial<Spacer> | number | undefined): Spacer =>
    (typeof detail === "number"
        ? {
              bottom: detail,
              left: detail * 3,
              right: detail * 3,
              top: detail,
          }
        : {
              bottom: 0,
              left: 0,
              right: 0,
              top: 0,
              ...detail,
          });

const getBorderWidth = (borderStyle: BorderStyle | string) => (borderStyle === NONE ? 0 : 2);

// eslint-disable-next-line sonarjs/cognitive-complexity
const getBorderChars = (borderStyle: BorderStyle | string): BorderStyle => {
    const sides = ["topLeft", "topRight", "bottomRight", "bottomLeft", "left", "right", "top", "bottom"];

    let characters: BorderStyle;

    // Create empty border style
    if (borderStyle === NONE) {
        // eslint-disable-next-line no-param-reassign
        borderStyle = {};

        // eslint-disable-next-line no-restricted-syntax
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

        // eslint-disable-next-line no-restricted-syntax
        for (const side of sides) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (borderStyle[side as keyof BorderStyle] === null || typeof borderStyle[side as keyof BorderStyle] !== "string") {
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
    let title = "";

    // eslint-disable-next-line no-param-reassign
    text = colorizeText(text);

    const textWidth = getStringWidth(text);

    switch (alignment) {
        case "left": {
            title = text + colorizeBorder(horizontal.slice(textWidth), getStringWidth(horizontal.slice(textWidth)));

            break;
        }

        case "right": {
            title = colorizeBorder(horizontal.slice(textWidth + 2), getStringWidth(horizontal.slice(textWidth)) + 2) + " " + text + " ";

            break;
        }

        default: {
            // eslint-disable-next-line no-param-reassign
            horizontal = horizontal.slice(textWidth);

            if (horizontal.length % 2 === 1) {
                // This is needed in case the length is odd
                // eslint-disable-next-line no-param-reassign
                horizontal = horizontal.slice(Math.floor(horizontal.length / 2));

                title = colorizeBorder(horizontal.slice(1), getStringWidth(horizontal.slice(1))) + text + colorizeBorder(horizontal, getStringWidth(horizontal)); // We reduce the left part of one character to avoid the bar to go beyond its limit
            } else {
                // eslint-disable-next-line no-param-reassign
                horizontal = horizontal.slice(horizontal.length / 2);

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
    textAlignment: "center" | "left" | "right";
    width: number;
};

const makeContentText = (
    text: string,
    { height, padding, textAlignment, width }: ContentTextOptions,
    // eslint-disable-next-line sonarjs/cognitive-complexity
) => {
    // eslint-disable-next-line no-param-reassign
    text = alignText(text, { align: textAlignment }) as string;

    let lines: string[] = text.split(NEWLINE);

    const textWidth = widestLine(text);
    const max = width - padding.left - padding.right;

    if (textWidth > max) {
        const newLines = [];

        // eslint-disable-next-line no-restricted-syntax
        for (const line of lines) {
            const createdLines = wordWrap(line, { width: max, wrapMode: WrapMode.BREAK_WORDS }) as string;
            const alignedLines = alignText(createdLines, { align: textAlignment });
            const alignedLinesArray = (alignedLines as string).split("\n");
            const longestLength = Math.max(...alignedLinesArray.map((s) => getStringWidth(s) as number));

            // eslint-disable-next-line no-restricted-syntax
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

        return newLine + PAD.repeat(width - getStringWidth(newLine));
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
        lines = [...lines, ...Array.from<string>({ length: height - lines.length }).fill(PAD.repeat(width))];
    }

    return lines.join(NEWLINE);
};

// eslint-disable-next-line sonarjs/cognitive-complexity
const boxContent = (content: string, contentWidth: number, columnsWidth: number, options: DimensionOptions): string => {
    const colorizeBorder = (border: string, position: BorderPosition, length: number): string =>
        (options.borderColor ? options.borderColor(border, position, length) : border);
    const colorizeHeaderText = (title: string): string => (options.headerTextColor ? options.headerTextColor(title) : title);
    const colorizeFooterText = (title: string): string => (options.footerTextColor ? options.footerTextColor(title) : title);
    const colorizeContent = (value: string): string => (options.textColor ? options.textColor(value) : value);

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

    result += lines
        .map(
            (line) =>
                marginLeft +
                colorizeBorder(chars.left, "left", getStringWidth(chars.left)) +
                colorizeContent(line) +
                colorizeBorder(chars.right, "right", getStringWidth(chars.right)),
        )
        .join(NEWLINE);

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

const sanitizeOptions = (options: DimensionOptions): DimensionOptions => {
    // If fullscreen is enabled, max-out unspecified width/height
    if (options.fullscreen) {
        let newDimensions = terminalSize();

        if (typeof options.fullscreen === "function") {
            newDimensions = options.fullscreen(newDimensions.columns, newDimensions.rows);
        }

        if (!options.width) {
            // eslint-disable-next-line no-param-reassign
            options.width = newDimensions.columns;
        }

        if (!options.height) {
            // eslint-disable-next-line no-param-reassign
            options.height = newDimensions.rows;
        }
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

const formatTitle = (title: string, borderStyle: BorderStyle | string): string => (borderStyle === NONE ? title : ` ${title} `);

// eslint-disable-next-line sonarjs/cognitive-complexity
const determineDimensions = (text: string, columnsWidth: number, options: DimensionOptions): DimensionOptions => {
    // eslint-disable-next-line no-param-reassign
    options = sanitizeOptions(options);

    const widthOverride = options.width !== undefined;
    const borderWidth = getBorderWidth(options.borderStyle);
    const maxWidth = columnsWidth - options.margin.left - options.margin.right - borderWidth;

    const widest = widestLine(wordWrap(text, { width: columnsWidth - borderWidth, wrapMode: WrapMode.BREAK_WORDS, trim: false })) + options.padding.left + options.padding.right;

    // If title and width are provided, title adheres to fixed width
    if (options.headerText && widthOverride) {
        // eslint-disable-next-line no-param-reassign
        options.headerText = options.headerText.slice(0, Math.max(0, (options.width as number) - 2));

        if (options.headerText) {
            // eslint-disable-next-line no-param-reassign
            options.headerText = formatTitle(options.headerText, options.borderStyle);
        }
    } else if (options.headerText) {
        // eslint-disable-next-line no-param-reassign
        options.headerText = options.headerText.slice(0, Math.max(0, maxWidth - 2));

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
    // eslint-disable-next-line no-param-reassign,@typescript-eslint/prefer-nullish-coalescing
    options.width = options.width || widest;

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

// eslint-disable-next-line import/prefer-default-export
export const boxen = (text: string, options: Options = {}): string => {
    if (options.borderColor !== undefined && typeof options.borderColor !== "function") {
        throw new Error(`"borderColor" is not a valid function`);
    }

    if (options.textColor !== undefined && typeof options.textColor !== "function") {
        throw new Error(`"textColor" is not a valid function`);
    }

    let config: DimensionOptions = {
        borderStyle: "single",
        dimBorder: false,
        float: "left",
        footerAlignment: "right",
        headerAlignment: "left",
        textAlignment: "left",
        transformTabToSpace: 4,
        ...options,
    } as DimensionOptions;

    config.padding = getObject(options.padding ?? 0);
    config.margin = getObject(options.margin);

    // replace tabs with spaces
    if (config.transformTabToSpace) {
        // eslint-disable-next-line no-param-reassign
        text = text.replaceAll("\t", " ".repeat(config.transformTabToSpace));
    }

    const { columns } = terminalSize();

    config = determineDimensions(text, columns, config);

    return boxContent(makeContentText(text, config as ContentTextOptions), config.width as number, columns, config);
};
