/**
 * Modified copy of https://github.com/webdiscus/ansis/blob/master/src/index.js
 *
 * ISC License
 *
 * Copyright (c) 2023, webdiscus
 */

import type { ColorSupportLevel } from "@visulima/is-ansi-color-supported";
// eslint-disable-next-line import/no-extraneous-dependencies
import ansiRegex from "ansi-regex";

import { createAnsiCodes, stdoutColorLevel } from "./ansi-codes";
import type { ColorData, ColorizeType } from "./types";
import { stringReplaceAll } from "./util/string-replace-all";

type ColorizeProperties = { close: string; closeStack: string; open: string; openStack: string; props: ColorizeProperties };

/**
 * Options accepted by the {@link Colorize} constructor.
 */
type ColorizeOptions = {
    /**
     * Force a specific color-support level instead of auto-detecting it from the
     * terminal at import time. Useful to force TrueColor for snapshot tests, to
     * disable color when piping to a file, or to render at a chosen level at runtime.
     *
     * - `0` — disabled (no ANSI codes)
     * - `1` — basic 16 colors
     * - `2` — 256 colors
     * - `3` — TrueColor (16 million colors)
     *
     * Defaults to the auto-detected stdout level.
     */
    level?: ColorSupportLevel;
};

const wrapText = (
    strings: ArrayLike<string> | ReadonlyArray<string> | number | string | { raw: ArrayLike<string> | ReadonlyArray<string> },
    values: string[],
    properties: ColorizeProperties,
) => {
    // eslint-disable-next-line unicorn/no-null -- let 0 through while still bailing on null/undefined/empty string
    if (strings === undefined || strings === null || strings === "") {
        return "";
    }

    let string;

    // eslint-disable-next-line unicorn/prefer-ternary -- ternary form trips @stylistic/operator-linebreak with the inline disable comment for no-base-to-string
    if ((strings as { raw?: ArrayLike<string> | ReadonlyArray<string> }).raw === undefined) {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string -- strings is string | number | array of strings here; objects only carry `raw`, handled in the other branch
        string = String(strings);
    } else {
        string = String.raw(strings as { raw: ArrayLike<string> | ReadonlyArray<string> }, ...values);
    }

    if (string.includes("")) {
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

/**
 * The Colorize class. A `new Colorize()` instance is a callable that styles
 * strings via chained getters (`red.bold`), style methods (`hex`, `rgb`, …) and
 * tagged templates.
 *
 * Unlike the module-level singleton, each instance owns its own style prototype
 * and color codes, so creating one with a custom `level` does not affect any
 * other instance.
 */
type ColorizeConstructor = new (options?: ColorizeOptions) => ColorizeType;

// eslint-disable-next-line func-names
const Colorize = function (this: ColorizeType, options?: ColorizeOptions) {
    const level: ColorSupportLevel = options?.level ?? stdoutColorLevel;

    const { baseColors, baseStyles, styleMethods } = createAnsiCodes(level);

    // Per-instance style descriptors + prototype. Building these on the instance
    // (instead of mutating module-level shared state) means user-created instances
    // never stomp on each other, and the work is scoped to the level being used.
    const styles: Record<string, object> = {};

    // eslint-disable-next-line unicorn/no-null -- Object.setPrototypeOf requires null, not undefined
    let stylePrototype: object | null = null;

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

    // This needs to be the last thing we do, so that the prototype is fully populated.
    stylePrototype = Object.defineProperties({}, styles);

    Object.setPrototypeOf(self, stylePrototype);

    return self;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any as ColorizeConstructor;

export type { ColorizeConstructor, ColorizeOptions };

// fallow-ignore-next-line unused-export -- stdoutColorLevel is public API (re-exported for parity with stderrColorLevel); not consumed inside the repo.
export { stderrColorLevel, stdoutColorLevel } from "./ansi-codes";

export default Colorize;
