import type { Inspect, Options } from "./types";

const ansiColors = {
    // 21-29 are resets for 1-9
    black: ["30", "39"],
    blue: ["34", "39"],
    bold: ["1", "22"],
    brightblack: ["30;1", "39"],
    brightblue: ["34;1", "39"],
    brightcyan: ["36;1", "39"],
    brightgreen: ["32;1", "39"],
    // 10-20 are fonts
    brightmagenta: ["35;1", "39"],
    brightred: ["31;1", "39"],
    brightwhite: ["37;1", "39"],
    brightyellow: ["33;1", "39"],
    cyan: ["36", "39"],
    dim: ["2", "22"],
    green: ["32", "39"],
    grey: ["90", "39"],

    hidden: ["8", "28"],
    // 5 & 6 are blinking
    inverse: ["7", "27"],
    italic: ["3", "23"],
    magenta: ["35", "39"],
    red: ["31", "39"],
    strike: ["9", "29"],
    underline: ["4", "24"],
    white: ["37", "39"],

    yellow: ["33", "39"],
} as const;

const styles: Record<string, keyof typeof ansiColors> = {
    bigint: "yellow",
    boolean: "yellow",
    date: "magenta",
    null: "bold",
    number: "yellow",
    regexp: "red",
    special: "cyan",
    string: "green",
    symbol: "green",
    undefined: "grey",
} as const;

export const truncator = "…";

type AnsiValue = (typeof ansiColors)[keyof typeof ansiColors];

function colorise<S extends string>(value: S, styleType: string): string {
    const color: AnsiValue | undefined = ansiColors[styles[styleType]] || ansiColors[styleType as keyof typeof ansiColors] || "";

    if (!color) {
        return String(value) as S;
    }

    return `\u001B[${color[0]}m${String(value) as S}\u001B[${color[1]}m`;
}

export function normaliseOptions(
    {
        breakLength = Number.POSITIVE_INFINITY,
        colors = false,
        customInspect = true,
        depth = 2,
        maxArrayLength = Number.POSITIVE_INFINITY,
        seen = [],
        showHidden = false,
        showProxy = false,
        stylize = String,

        truncate = Number.POSITIVE_INFINITY,
    }: Partial<Options> = {},
    inspect: Inspect,
): Options {
    const options = {
        breakLength: Number(breakLength),
        colors: Boolean(colors),
        customInspect: Boolean(customInspect),
        depth: Number(depth),
        inspect,
        maxArrayLength: Number(maxArrayLength),
        seen,
        showHidden: Boolean(showHidden),
        showProxy: Boolean(showProxy),
        stylize,
        truncate: Number(truncate),
    };
    if (options.colors) {
        options.stylize = colorise;
    }
    return options;
}

function isHighSurrogate(char: string): boolean {
    return char >= "\uD800" && char <= "\uDBFF";
}

export function truncate(string: number | string, length: number, tail: typeof truncator = truncator) {
    string = String(string);
    const tailLength = tail.length;
    const stringLength = string.length;
    if (tailLength > length && stringLength > tailLength) {
        return tail;
    }
    if (stringLength > length && stringLength > tailLength) {
        let end = length - tailLength;
        if (end > 0 && isHighSurrogate(string[end - 1])) {
            end -= 1;
        }
        return `${string.slice(0, end)}${tail}`;
    }
    return string;
}

export function inspectList(list: ArrayLike<unknown>, options: Options, inspectItem?: Inspect, separator = ", "): string {
    inspectItem = inspectItem || options.inspect;
    const size = list.length;
    if (size === 0) return "";
    const originalLength = options.truncate;
    let output = "";
    let peek = "";
    let truncated = "";
    for (let index = 0; index < size; index += 1) {
        const last = index + 1 === list.length;
        const secondToLast = index + 2 === list.length;
        truncated = `${truncator}(${list.length - index})`;
        const value = list[index];

        // If there is more than one remaining we need to account for a separator of `, `
        options.truncate = originalLength - output.length - (last ? 0 : separator.length);
        const string = peek || inspectItem(value, options) + (last ? "" : separator);
        const nextLength = output.length + string.length;
        const truncatedLength = nextLength + truncated.length;

        // If this is the last element, and adding it would
        // take us over length, but adding the truncator wouldn't - then break now
        if (last && nextLength > originalLength && output.length + truncated.length <= originalLength) {
            break;
        }

        // If this isn't the last or second to last element to scan,
        // but the string is already over length then break here
        if (!last && !secondToLast && truncatedLength > originalLength) {
            break;
        }

        // Peek at the next string to determine if we should
        // break early before adding this item to the output
        peek = last ? "" : inspectItem(list[index + 1], options) + (secondToLast ? "" : separator);

        // If we have one element left, but this element and
        // the next takes over length, the break early
        if (!last && secondToLast && truncatedLength > originalLength && nextLength + peek.length > originalLength) {
            break;
        }

        output += string;

        // If the next element takes us to length -
        // but there are more after that, then we should truncate now
        if (!last && !secondToLast && nextLength + peek.length >= originalLength) {
            truncated = `${truncator}(${list.length - index - 1})`;
            break;
        }

        truncated = "";
    }
    return `${output}${truncated}`;
}

function quoteComplexKey(key: string): string {
    if (/^[a-z_]\w*$/i.test(key)) {
        return key;
    }
    return JSON.stringify(key)
        .replaceAll("'", "\\'")
        .replaceAll('\\"', '"')
        .replaceAll(/(^"|"$)/g, "'");
}

export function inspectProperty([key, value]: [unknown, unknown], options: Options): string {
    options.truncate -= 2;
    if (typeof key === "string") {
        key = quoteComplexKey(key);
    } else if (typeof key !== "number") {
        key = `[${options.inspect(key, options)}]`;
    }
    options.truncate -= (key as string).length;
    value = options.inspect(value, options);
    return `${key}: ${value}`;
}
