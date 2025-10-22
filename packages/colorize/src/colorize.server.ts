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

let stylePrototype: object | null = null;

const wrapText = (
    strings: ArrayLike<string> | ReadonlyArray<string> | number | string | { raw: ArrayLike<string> | ReadonlyArray<string> },
    values: string[],
    properties: ColorizeProperties,
) => {
    if (!strings) {
        return "";
    }

    let string
        = (strings as { raw?: ArrayLike<string> | ReadonlyArray<string> | null }).raw == undefined
            ? (`${strings as number | string}` as string)
            : String.raw(strings as { raw: ArrayLike<string> | ReadonlyArray<string> }, ...values);

    if (string.includes("\u001B")) {
        // eslint-disable-next-line no-loops/no-loops
        for (let currentProperties = properties; currentProperties; currentProperties = currentProperties.props) {
            string = stringReplaceAll(string, currentProperties.close, currentProperties.open);
        }
    }

    if (string.includes("\n")) {
        // eslint-disable-next-line unicorn/prefer-string-replace-all
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
    const self = (string_: number | string) => `${string_}`;

    self.strip = (value: string): string => value.replaceAll(ansiRegex(), "");

    // eslint-disable-next-line guard-for-in,no-loops/no-loops,no-restricted-syntax
    for (const name in baseColors) {
        // eslint-disable-next-line security/detect-object-injection
        styles[name] = {
            get() {
                const style = createStyle(this, baseColors[name as keyof typeof baseColors]);

                Object.defineProperty(this, name, { value: style });

                return style;
            },
        };
    }

    // eslint-disable-next-line guard-for-in,no-loops/no-loops,no-restricted-syntax
    for (const name in baseStyles) {
        // eslint-disable-next-line security/detect-object-injection
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

// eslint-disable-next-line guard-for-in,no-loops/no-loops,no-restricted-syntax
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
