type CssObject = {
    __proto__: null;
    backgroundColor: string | null;
    color: string | null;
    fontStyle: string | null;
    fontWeight: string | null;
    textDecorationColor: [number, number, number] | null;
    textDecorationLine: string[];
};

// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// eslint-disable-next-line no-secrets/no-secrets
// https://github.com/denoland/deno/blob/ece2a3de5b19588160634452638aa656218853c5/ext/console/01_console.js#L2575
const colorKeywords: Map<string, string> = new Map<string, string>([
    ["aliceblue", "#f0f8ff"],
    ["antiquewhite", "#faebd7"],
    ["aqua", "#00ffff"],
    ["aquamarine", "#7fffd4"],
    ["azure", "#f0ffff"],
    ["beige", "#f5f5dc"],
    ["bisque", "#ffe4c4"],
    ["black", "#000000"],
    ["blanchedalmond", "#ffebcd"],
    ["blue", "#0000ff"],
    ["blueviolet", "#8a2be2"],
    ["brown", "#a52a2a"],
    ["burlywood", "#deb887"],
    ["cadetblue", "#5f9ea0"],
    ["chartreuse", "#7fff00"],
    ["chocolate", "#d2691e"],
    ["coral", "#ff7f50"],
    ["cornflowerblue", "#6495ed"],
    ["cornsilk", "#fff8dc"],
    ["crimson", "#dc143c"],
    ["cyan", "#00ffff"],
    ["darkblue", "#00008b"],
    ["darkcyan", "#008b8b"],
    ["darkgoldenrod", "#b8860b"],
    ["darkgray", "#a9a9a9"],
    ["darkgreen", "#006400"],
    ["darkgrey", "#a9a9a9"],
    ["darkkhaki", "#bdb76b"],
    ["darkmagenta", "#8b008b"],
    ["darkolivegreen", "#556b2f"],
    ["darkorange", "#ff8c00"],
    ["darkorchid", "#9932cc"],
    ["darkred", "#8b0000"],
    ["darksalmon", "#e9967a"],
    ["darkseagreen", "#8fbc8f"],
    ["darkslateblue", "#483d8b"],
    ["darkslategray", "#2f4f4f"],
    ["darkslategrey", "#2f4f4f"],
    ["darkturquoise", "#00ced1"],
    ["darkviolet", "#9400d3"],
    ["deeppink", "#ff1493"],
    ["deepskyblue", "#00bfff"],
    ["dimgray", "#696969"],
    ["dimgrey", "#696969"],
    ["dodgerblue", "#1e90ff"],
    ["firebrick", "#b22222"],
    ["floralwhite", "#fffaf0"],
    ["forestgreen", "#228b22"],
    ["fuchsia", "#ff00ff"],
    ["gainsboro", "#dcdcdc"],
    ["ghostwhite", "#f8f8ff"],
    ["gold", "#ffd700"],
    ["goldenrod", "#daa520"],
    ["gray", "#808080"],
    ["green", "#008000"],
    ["greenyellow", "#adff2f"],
    ["grey", "#808080"],
    ["honeydew", "#f0fff0"],
    ["hotpink", "#ff69b4"],
    ["indianred", "#cd5c5c"],
    ["indigo", "#4b0082"],
    ["ivory", "#fffff0"],
    ["khaki", "#f0e68c"],
    ["lavender", "#e6e6fa"],
    ["lavenderblush", "#fff0f5"],
    ["lawngreen", "#7cfc00"],
    ["lemonchiffon", "#fffacd"],
    ["lightblue", "#add8e6"],
    ["lightcoral", "#f08080"],
    ["lightcyan", "#e0ffff"],
    ["lightgoldenrodyellow", "#fafad2"],
    ["lightgray", "#d3d3d3"],
    ["lightgreen", "#90ee90"],
    ["lightgrey", "#d3d3d3"],
    ["lightpink", "#ffb6c1"],
    ["lightsalmon", "#ffa07a"],
    ["lightseagreen", "#20b2aa"],
    ["lightskyblue", "#87cefa"],
    ["lightslategray", "#778899"],
    ["lightslategrey", "#778899"],
    ["lightsteelblue", "#b0c4de"],
    ["lightyellow", "#ffffe0"],
    ["lime", "#00ff00"],
    ["limegreen", "#32cd32"],
    ["linen", "#faf0e6"],
    ["magenta", "#ff00ff"],
    ["maroon", "#800000"],
    ["mediumaquamarine", "#66cdaa"],
    ["mediumblue", "#0000cd"],
    ["mediumorchid", "#ba55d3"],
    ["mediumpurple", "#9370db"],
    ["mediumseagreen", "#3cb371"],
    ["mediumslateblue", "#7b68ee"],
    ["mediumspringgreen", "#00fa9a"],
    ["mediumturquoise", "#48d1cc"],
    ["mediumvioletred", "#c71585"],
    ["midnightblue", "#191970"],
    ["mintcream", "#f5fffa"],
    ["mistyrose", "#ffe4e1"],
    ["moccasin", "#ffe4b5"],
    ["navajowhite", "#ffdead"],
    ["navy", "#000080"],
    ["oldlace", "#fdf5e6"],
    ["olive", "#808000"],
    ["olivedrab", "#6b8e23"],
    ["orange", "#ffa500"],
    ["orangered", "#ff4500"],
    ["orchid", "#da70d6"],
    ["palegoldenrod", "#eee8aa"],
    ["palegreen", "#98fb98"],
    ["paleturquoise", "#afeeee"],
    ["palevioletred", "#db7093"],
    ["papayawhip", "#ffefd5"],
    ["peachpuff", "#ffdab9"],
    ["peru", "#cd853f"],
    ["pink", "#ffc0cb"],
    ["plum", "#dda0dd"],
    ["powderblue", "#b0e0e6"],
    ["purple", "#800080"],
    ["rebeccapurple", "#663399"],
    ["red", "#ff0000"],
    ["rosybrown", "#bc8f8f"],
    ["royalblue", "#4169e1"],
    ["saddlebrown", "#8b4513"],
    ["salmon", "#fa8072"],
    ["sandybrown", "#f4a460"],
    ["seagreen", "#2e8b57"],
    ["seashell", "#fff5ee"],
    ["sienna", "#a0522d"],
    ["silver", "#c0c0c0"],
    ["skyblue", "#87ceeb"],
    ["slateblue", "#6a5acd"],
    ["slategray", "#708090"],
    ["slategrey", "#708090"],
    ["snow", "#fffafa"],
    ["springgreen", "#00ff7f"],
    ["steelblue", "#4682b4"],
    ["tan", "#d2b48c"],
    ["teal", "#008080"],
    ["thistle", "#d8bfd8"],
    ["tomato", "#ff6347"],
    ["turquoise", "#40e0d0"],
    ["violet", "#ee82ee"],
    ["wheat", "#f5deb3"],
    ["white", "#ffffff"],
    ["whitesmoke", "#f5f5f5"],
    ["yellow", "#ffff00"],
    ["yellowgreen", "#9acd32"],
]);

// eslint-disable-next-line security/detect-unsafe-regex,regexp/no-unused-capturing-group
const HASH_PATTERN = /^#([\dA-F]{2})([\dA-F]{2})([\dA-F]{2})([\dA-F]{2})?$/i;
// eslint-disable-next-line regexp/optimal-quantifier-concatenation,regexp/no-unused-capturing-group
const SMALL_HASH_PATTERN = /^#([\dA-F])([\dA-F])([\dA-F])([\dA-F])?$/i;
const RGB_PATTERN
    // eslint-disable-next-line security/detect-unsafe-regex,regexp/no-unused-capturing-group
    = /^rgba?\(\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*(,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*)?\)$/;
const HSL_PATTERN
    // eslint-disable-next-line security/detect-unsafe-regex,regexp/no-unused-capturing-group
    = /^hsla?\(\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))%\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))%\s*(,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*)?\)$/;

const getDefaultCss = (): CssObject => {
    return {
        __proto__: null,
        backgroundColor: null,
        color: null,
        fontStyle: null,
        fontWeight: null,
        textDecorationColor: null,
        textDecorationLine: [],
    };
};

const SPACE_PATTERN = /\s+/g;

// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// eslint-disable-next-line no-secrets/no-secrets
// https://github.com/denoland/deno/blob/ece2a3de5b19588160634452638aa656218853c5/ext/console/01_console.js#L2739
const parseCssColor = (colorString: string): [number, number, number] | null => {
    if (colorKeywords.has(colorString)) {
        // eslint-disable-next-line no-param-reassign
        colorString = colorKeywords.get(colorString) as string;
    }

    const hashMatch = HASH_PATTERN.exec(colorString);

    if (hashMatch) {
        return [Number.parseInt(hashMatch[1] as string, 16), Number.parseInt(hashMatch[2] as string, 16), Number.parseInt(hashMatch[3] as string, 16)];
    }

    const smallHashMatch = SMALL_HASH_PATTERN.exec(colorString);

    if (smallHashMatch) {
        return [
            Number.parseInt(`${smallHashMatch[1]}${smallHashMatch[1]}`, 16),
            Number.parseInt(`${smallHashMatch[2]}${smallHashMatch[2]}`, 16),
            Number.parseInt(`${smallHashMatch[3]}${smallHashMatch[3]}`, 16),
        ];
    }

    const rgbMatch = RGB_PATTERN.exec(colorString);

    if (rgbMatch) {
        return [
            Math.round(Math.max(0, Math.min(255, Number(rgbMatch[1])))),
            Math.round(Math.max(0, Math.min(255, Number(rgbMatch[2])))),
            Math.round(Math.max(0, Math.min(255, Number(rgbMatch[3])))),
        ];
    }

    const hslMatch = HSL_PATTERN.exec(colorString);

    if (hslMatch) {
        // https://www.rapidtables.com/convert/color/hsl-to-rgb.html
        let h = Number(hslMatch[1]) % 360;

        if (h < 0) {
            h += 360;
        }

        const s = Math.max(0, Math.min(100, Number(hslMatch[2]))) / 100;
        const l = Math.max(0, Math.min(100, Number(hslMatch[3]))) / 100;
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = l - c / 2;

        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        let r_: number;
        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        let g_: number;
        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        let b_: number;

        if (h < 60) {
            ({ 0: r_, 1: g_, 2: b_ } = [c, x, 0]);
        } else if (h < 120) {
            ({ 0: r_, 1: g_, 2: b_ } = [x, c, 0]);
        } else if (h < 180) {
            ({ 0: r_, 1: g_, 2: b_ } = [0, c, x]);
        } else if (h < 240) {
            ({ 0: r_, 1: g_, 2: b_ } = [0, x, c]);
        } else if (h < 300) {
            ({ 0: r_, 1: g_, 2: b_ } = [x, 0, c]);
        } else {
            ({ 0: r_, 1: g_, 2: b_ } = [c, 0, x]);
        }

        return [Math.round((r_ + m) * 255), Math.round((g_ + m) * 255), Math.round((b_ + m) * 255)];
    }

    return null;
};

// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// eslint-disable-next-line no-secrets/no-secrets
// https://github.com/denoland/deno/blob/ece2a3de5b19588160634452638aa656218853c5/ext/console/01_console.js#L2928
const colorEquals = (color1: string | [number, number, number] | null, color2: string | [number, number, number] | null) =>
    color1?.[0] === color2?.[0] && color1?.[1] === color2?.[1] && color1?.[2] === color2?.[2];

// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// eslint-disable-next-line no-secrets/no-secrets
// https://github.com/denoland/deno/blob/ece2a3de5b19588160634452638aa656218853c5/ext/console/01_console.js#L2821
// eslint-disable-next-line sonarjs/cognitive-complexity
export const parseCss = (cssString: string): CssObject => {
    const css = getDefaultCss();

    const rawEntries = [];

    let inValue = false;
    let currentKey = null;
    let parenthesesDepth = 0;
    let currentPart = "";

    for (const c of cssString) {
        if (c === "(") {
            parenthesesDepth++;
        } else if (parenthesesDepth > 0) {
            if (c === ")") {
                parenthesesDepth--;
            }
        } else if (inValue) {
            if (c === ";") {
                const value = currentPart.trim();

                if (value !== "") {
                    rawEntries.push([currentKey, value]);
                }

                currentKey = null;
                currentPart = "";
                inValue = false;

                continue;
            }
        } else if (c === ":") {
            currentKey = currentPart.trim();
            currentPart = "";
            inValue = true;

            continue;
        }

        currentPart += c;
    }

    if (inValue && parenthesesDepth === 0) {
        const value = currentPart.trim();

        if (value !== "") {
            rawEntries.push([currentKey, value]);
        }

        currentKey = null;
        currentPart = "";
    }

    for (const { 0: key, 1: value } of rawEntries) {
        switch (key) {
            case "background-color": {
                if (value != undefined) {
                    css.backgroundColor = value;
                }

                break;
            }
            case "color": {
                if (value != undefined) {
                    css.color = value;
                }

                break;
            }
            case "font-style": {
                if (["italic", "oblique", "oblique 14deg"].includes(value as string)) {
                    css.fontStyle = "italic";
                }

                break;
            }
            case "font-weight": {
                if (value === "bold") {
                    css.fontWeight = value;
                }

                break;
            }
            case "text-decoration": {
                css.textDecorationColor = null;
                css.textDecorationLine = [];

                // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
                const arguments_ = (value as string).split(SPACE_PATTERN);

                for (const argument of arguments_) {
                    const maybeColor = parseCssColor(argument);

                    if (maybeColor != undefined) {
                        css.textDecorationColor = maybeColor;
                    } else if (["line-through", "overline", "underline"].includes(argument)) {
                        css.textDecorationLine.push(argument);
                    }
                }

                break;
            }
            case "text-decoration-color": {
                const color = parseCssColor(value as string);

                if (color != undefined) {
                    css.textDecorationColor = color;
                }

                break;
            }
            case "text-decoration-line": {
                css.textDecorationLine = [];
                const lineTypes = (value as string).split(SPACE_PATTERN);

                for (const lineType of lineTypes) {
                    if (["line-through", "overline", "underline"].includes(lineType)) {
                        css.textDecorationLine.push(lineType);
                    }
                }

                break;
            }
            default:
            // empty
        }
    }

    return css;
};

// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// eslint-disable-next-line no-secrets/no-secrets
// https://github.com/denoland/deno/blob/ece2a3de5b19588160634452638aa656218853c5/ext/console/01_console.js#L2933
// eslint-disable-next-line sonarjs/cognitive-complexity
export const cssToAnsi = (css: CssObject, previousCss: CssObject | null = null): string => {
    // eslint-disable-next-line no-param-reassign
    previousCss = previousCss ?? getDefaultCss();

    let ansi = "";

    if (!colorEquals(css.backgroundColor, previousCss.backgroundColor)) {
        if (css.backgroundColor == undefined) {
            ansi += "\u001B[49m";
        } else {
            switch (css.backgroundColor) {
                case "black": {
                    ansi += "\u001B[40m";

                    break;
                }
                case "blue": {
                    ansi += "\u001B[44m";

                    break;
                }
                case "cyan": {
                    ansi += "\u001B[46m";

                    break;
                }
                case "green": {
                    ansi += "\u001B[42m";

                    break;
                }
                case "magenta": {
                    ansi += "\u001B[45m";

                    break;
                }
                case "red": {
                    ansi += "\u001B[41m";

                    break;
                }
                case "white": {
                    ansi += "\u001B[47m";

                    break;
                }
                case "yellow": {
                    ansi += "\u001B[43m";

                    break;
                }
                default: {
                    if (Array.isArray(css.backgroundColor)) {
                        const { 0: r, 1: g, 2: b } = css.backgroundColor;

                        ansi += `\u001B[48;2;${r};${g};${b}m`;
                    } else {
                        const parsed = parseCssColor(css.backgroundColor);

                        if (parsed === null) {
                            ansi += "\u001B[49m";
                        } else {
                            const { 0: r, 1: g, 2: b } = parsed;

                            ansi += `\u001B[48;2;${r};${g};${b}m`;
                        }
                    }
                }
            }
        }
    }

    if (!colorEquals(css.color, previousCss.color)) {
        if (css.color == undefined) {
            ansi += "\u001B[39m";
        } else {
            switch (css.color) {
                case "black": {
                    ansi += "\u001B[30m";

                    break;
                }
                case "blue": {
                    ansi += "\u001B[34m";

                    break;
                }
                case "cyan": {
                    ansi += "\u001B[36m";

                    break;
                }
                case "green": {
                    ansi += "\u001B[32m";

                    break;
                }
                case "magenta": {
                    ansi += "\u001B[35m";

                    break;
                }
                case "red": {
                    ansi += "\u001B[31m";

                    break;
                }
                case "white": {
                    ansi += "\u001B[37m";

                    break;
                }
                case "yellow": {
                    ansi += "\u001B[33m";

                    break;
                }
                default: {
                    if (Array.isArray(css.color)) {
                        const { 0: r, 1: g, 2: b } = css.color;

                        ansi += `\u001B[38;2;${r};${g};${b}m`;
                    } else {
                        const parsed = parseCssColor(css.color);

                        if (parsed === null) {
                            ansi += "\u001B[39m";
                        } else {
                            const { 0: r, 1: g, 2: b } = parsed;

                            ansi += `\u001B[38;2;${r};${g};${b}m`;
                        }
                    }
                }
            }
        }
    }

    if (css.fontWeight !== previousCss.fontWeight) {
        ansi += css.fontWeight === "bold" ? "\u001B[1m" : "\u001B[22m";
    }

    if (css.fontStyle !== previousCss.fontStyle) {
        ansi += css.fontStyle === "italic" ? "\u001B[3m" : "\u001B[23m";
    }

    if (!colorEquals(css.textDecorationColor, previousCss.textDecorationColor)) {
        if (css.textDecorationColor == undefined) {
            ansi += "\u001B[59m";
        } else {
            const { 0: r, 1: g, 2: b } = css.textDecorationColor;

            ansi += `\u001B[58;2;${r};${g};${b}m`;
        }
    }

    if (css.textDecorationLine.includes("line-through") !== previousCss.textDecorationLine.includes("line-through")) {
        ansi += css.textDecorationLine.includes("line-through") ? "\u001B[9m" : "\u001B[29m";
    }

    if (css.textDecorationLine.includes("overline") !== previousCss.textDecorationLine.includes("overline")) {
        ansi += css.textDecorationLine.includes("overline") ? "\u001B[53m" : "\u001B[55m";
    }

    if (css.textDecorationLine.includes("underline") !== previousCss.textDecorationLine.includes("underline")) {
        ansi += css.textDecorationLine.includes("underline") ? "\u001B[4m" : "\u001B[24m";
    }

    return ansi;
};
