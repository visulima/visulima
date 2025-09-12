import { baseColors, baseStyles, styleMethods } from "./css-code";
import type { ColorizeType } from "./types";

const styles: Record<string, object> = {};

let stylePrototype: object | null = null;

const cssStringToObject = (css: string): Record<string, string> => {
    const cssObject: Record<string, string> = {};

    // eslint-disable-next-line regexp/no-super-linear-backtracking,regexp/optimal-quantifier-concatenation,unicorn/prefer-string-replace-all
    css.replace(/(?<=^|;)\s*([^:]+)\s*:\s*([^;]+)\s*/g, (_, key: string, value) => {
        // eslint-disable-next-line security/detect-object-injection
        cssObject[key] = value;

        return value;
    });

    return cssObject;
};

type ColorizeProperties = { css: string; cssStack: string; props: ColorizeProperties };

const createStyle = (
    { props }: { props?: ColorizeProperties },
    css: string,

): { (strings: ArrayLike<string> | ReadonlyArray<string> | string, ...values: string[]): string[] | ""; css: string; props: ColorizeProperties } => {
    let cssStack = css;

    if (props?.cssStack) {
        const cssObject = cssStringToObject(css);
        const propertiesCssObject = cssStringToObject(props.cssStack);

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const key in propertiesCssObject) {
            // eslint-disable-next-line security/detect-object-injection
            if (cssObject[key] === undefined) {
                // eslint-disable-next-line security/detect-object-injection
                cssObject[key] = propertiesCssObject[key] as string;
            }
        }

        // eslint-disable-next-line unicorn/prefer-string-replace-all
        cssStack = `${JSON.stringify(cssObject).replace(/["{}]/g, "").replace(/,/g, ";")};`;
    }

    const style = (
        input: ArrayLike<string> | ReadonlyArray<string> | number | string | { raw: ArrayLike<string> | ReadonlyArray<string> },
        ...values: string[]
    ): string[] => {
        if (!input) {
            return [];
        }

        if (typeof input === "string" && input.includes("%c")) {
            const collectedStyles = input.match(/(?<=,).*;/g);

            // eslint-disable-next-line unicorn/prefer-string-replace-all
            const inputWithoutStyles = input.replace(/,.*;/g, "");

            return [`%c${inputWithoutStyles}`, style.css, ...collectedStyles ?? []];
        }

        if (typeof input === "number" || typeof input === "string") {
            return [`%c${input}`, style.css];
        }

        if ((input as { raw?: ArrayLike<string> | ReadonlyArray<string> | null }).raw !== null && Array.isArray(values) && values.length > 0) {
            const rawString = String.raw(input as { raw: ArrayLike<string> | ReadonlyArray<string> }, ...values);

            const collectedStyles = rawString.match(/(?<=,).*;/g);
            // eslint-disable-next-line unicorn/prefer-string-replace-all
            const inputWithoutStyles = rawString.replace(/,.*;/g, "");

            return [`%c${inputWithoutStyles}`, style.css, ...(collectedStyles ?? []).join("").split(",").filter(Boolean)];
        }

        const [first, ...rest] = input as string[];

        rest.unshift(style.css);

        return [`${`${first}`.includes("%c") ? "" : "%c"}${first}`, rest.join("")];
    };

    Object.setPrototypeOf(style, stylePrototype);

    style.props = { css, cssStack, props } as ColorizeProperties;
    style.css = cssStack;

    return style;
};

// eslint-disable-next-line func-names
const WebColorize = function () {
    const self = (string_: number | string) => `${string_}`;

    self.strip = (value: string): string => value;

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

export default WebColorize;
