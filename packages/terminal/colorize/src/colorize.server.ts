/**
 * Modified copy of https://github.com/webdiscus/ansis/blob/master/src/index.js
 *
 * ISC License
 *
 * Copyright (c) 2023, webdiscus
 */

// eslint-disable-next-line import/no-extraneous-dependencies
import ansiRegex from "ansi-regex";

import { baseColors, baseStyles, styleMethods } from "./ansi-codes";
import type { ColorData, ColorizeType } from "./types";
import { stringReplaceAll } from "./util/string-replace-all";

const styles: Record<string, object> = {};

// eslint-disable-next-line unicorn/no-null -- Object.setPrototypeOf requires null, not undefined
let stylePrototype: object | null = null;

const wrapText = (
    strings: ArrayLike<string> | ReadonlyArray<string> | number | string | { raw: ArrayLike<string> | ReadonlyArray<string> },
    values: string[],
    properties: ColorizeProperties,
) => {
    if (!strings) {
        return "";
    }

    // eslint-disable-next-line @stylistic/operator-linebreak -- prettier places `=` at end of line
    let string =
        (strings as { raw?: ArrayLike<string> | ReadonlyArray<string> }).raw === undefined
            // eslint-disable-next-line @typescript-eslint/no-base-to-string -- strings is string | number | array of strings here; objects only carry `raw`, handled in the other branch
            ? String(strings)
            : String.raw(strings as { raw: ArrayLike<string> | ReadonlyArray<string> }, ...values);

    if (string.includes("\u001B")) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        for (let currentProperties = properties; currentProperties; currentProperties = currentProperties.props) {
            string = stringReplaceAll(string, currentProperties.close, currentProperties.open);
        }
    }

    if (string.includes("\n")) {
        // eslint-disable-next-line unicorn/prefer-string-replace-all,sonarjs/slow-regex
        string = string.replace(/(\r*\n)/g, `${properties.closeStack}$1${properties.openStack}`);
    }

    return properties.openStack + string + properties.closeStack;
};

type ColorizeProperties = { close: string; closeStack: string; open: string; openStack: string; props: ColorizeProperties };

const createStyle = (
    { props }: { props?: ColorizeProperties },
    { close, open }: ColorData,
): {
    (strings: ArrayLike<string> | ReadonlyArray<string> | string, ...values: string[]): string;
    close: string;
    open: string;
    props: { close: string; closeStack: string; open: string; openStack: string; props?: ColorizeProperties };
} => {
    const openStack: string = (props?.openStack ?? "") + open;
    const closeStack: string = close + (props?.closeStack ?? "");

    const style = (strings: ArrayLike<string> | ReadonlyArray<string> | string, ...values: string[]) => wrapText(strings, values, style.props);

    Object.setPrototypeOf(style, stylePrototype);

    style.props = { close, closeStack, open, openStack, props } as ColorizeProperties;
    style.open = openStack;
    style.close = closeStack;

    return style;
};

// eslint-disable-next-line func-names
const Colorize = function () {
    // eslint-disable-next-line unicorn/prefer-native-coercion-functions
    const self = (string_: number | string) => String(string_);

    self.strip = (value: string): string => value.replaceAll(ansiRegex(), "");

    // eslint-disable-next-line guard-for-in,no-restricted-syntax
    for (const name in baseColors) {
        styles[name] = {
            get() {
                const style = createStyle(this, baseColors[name as keyof typeof baseColors]);

                Object.defineProperty(this, name, { value: style });

                return style;
            },
        };
    }

    // eslint-disable-next-line guard-for-in,no-restricted-syntax
    for (const name in baseStyles) {
        styles[name] = {
            get() {
                const style = createStyle(this, baseStyles[name as keyof typeof baseStyles]);

                Object.defineProperty(this, name, { value: style });

                return style;
            },
        };
    }

    // This needs to be the last thing we do, so that the prototype is fully populated.
    stylePrototype = Object.defineProperties({}, styles);

    Object.setPrototypeOf(self, stylePrototype);

    return self;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any as new () => ColorizeType;

// eslint-disable-next-line guard-for-in,no-restricted-syntax
for (const name in styleMethods) {
    styles[name as keyof typeof styleMethods] = {
        get() {
            return (...arguments_: (number | string)[]) =>
                // @ts-expect-error: TODO: fix typing of `arguments_`
                createStyle(this, styleMethods[name as keyof typeof styleMethods](...arguments_));
        },
    };
}

styles.ansi256 = styles.fg as object;
styles.bgAnsi256 = styles.bg as object;

export default Colorize;
