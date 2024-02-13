import type { AnsiColors, AnsiStyles, ColorizeType } from "./types";

const baseStyles: Required<Record<AnsiStyles, string>> = {
    bold: "font-weight: bold;",
    dim: "opacity: 0.5;",
    hidden: "visibility: hidden;",
    inverse: "background-color: currentColor; color: background-color;",
    italic: "font-style: italic;",
    overline: "text-decoration: overline;",
    reset: "color: inherit",
    strike: "text-decoration: line-through;",
    strikethrough: "text-decoration: line-through;",
    underline: "text-decoration: underline;",
    visible: "opacity: 0;",
};

const baseColors: Required<Record<AnsiColors, string>> = {
    bgBlack: "background-color: black; color: white;",
    bgBlackBright: "background-color: #666; color: white;",
    bgBlue: "background-color: blue; color: white;",
    bgBlueBright: "background-color: #55f; color: white;",
    bgCyan: "background-color: cyan; color: black;",
    bgCyanBright: "background-color: #5ff; color: black;",
    bgGray: "background-color: #666; color: white;", // US spelling alias for bgBlackBright
    bgGreen: "background-color: green; color: white;",
    bgGreenBright: "background-color: #5f5; color: white;",
    bgGrey: "background-color: #666; color: white;", // UK spelling alias for bgBlackBright
    bgMagenta: "background-color: magenta; color: white;",
    bgMagentaBright: "background-color: #f5f; color: white;",
    bgRed: "background-color: red; color: white;",
    bgRedBright: "background-color: #f55; color: white;",
    bgWhite: "background-color: white; color: black;",
    bgWhiteBright: "background-color: #eee; color: black;",
    bgYellow: "background-color: yellow; color: black;",
    bgYellowBright: "background-color: #ff5; color: black;",
    black: "color: black;",
    blackBright: "color: #666;",
    blue: "color: blue;",
    blueBright: "color: #55f;",
    cyan: "color: cyan;",
    cyanBright: "color: #5ff;",
    gray: "color: #666;", // US spelling alias for blackBright
    green: "color: green;",
    greenBright: "color: #5f5;",
    grey: "color: #666;", // UK spelling alias for blackBright
    magenta: "color: magenta;",
    magentaBright: "color: #f5f;",
    red: "color: red;",
    redBright: "color: #f55;",
    white: "color: white;",
    whiteBright: "color: #eee;",
    yellow: "color: yellow;",
    yellowBright: "color: #ff5;",
};

const styleMethods: {
    bg: (code: number) => string;
    bgHex: (hex: string) => string;
    bgRgb: (r: number, g: number, b: number) => string;
    fg: (code: number) => string;
    hex: (hex: string) => string;
    rgb: (r: number, g: number, b: number) => string;
} = {
    bg: (code: number) => `background-color: rgb(${code}); color: white;`,
    bgHex: (hex: string) => `background-color: ${hex}; color: white;`,
    bgRgb: (r: number, g: number, b: number) => `background-color: rgb(${r}, ${g}, ${b}); color: white;`,
    fg: (code: number) => `color: rgb(${code});`,
    hex: (hex: string) => `color: ${hex};`,
    rgb: (r: number, g: number, b: number) => `color: rgb(${r}, ${g}, ${b});`,
};

const styles: Record<string, object> = {};

let stylePrototype: object | null = null;

const cssStringToObject = (css: string): Record<string, string> => {
    const cssObject: Record<string, string> = {};

    // eslint-disable-next-line regexp/no-super-linear-backtracking,regexp/optimal-quantifier-concatenation,security/detect-object-injection,no-return-assign
    css.replaceAll(/(?<=^|;)\s*([^:]+)\s*:\s*([^;]+)\s*/g, (_, key: string, value) => (cssObject[key] = value));

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

        cssStack = Object.entries(cssObject)
            .map(([p, v]) => `${p}:${v}`)
            .join(";");
    }

    const style = (
        strings: ArrayLike<string> | ReadonlyArray<string> | number | string | { raw: ArrayLike<string> | ReadonlyArray<string> },
        ...values: string[]
    ) => {
        if (!strings) {
            return "";
        }

        const string =
            (strings as { raw?: ArrayLike<string> | ReadonlyArray<string> | null }).raw == null
                // eslint-disable-next-line @typescript-eslint/no-base-to-string,@typescript-eslint/restrict-plus-operands
                ? strings + "" as string
                : String.raw(strings as { raw: ArrayLike<string> | ReadonlyArray<string> }, ...values);

        return ["%c" + string, cssStack];
    };

    Object.setPrototypeOf(style, stylePrototype);

    style.props = { css, cssStack, props } as ColorizeProperties;
    style.css = cssStack;

    return style;
};

// eslint-disable-next-line func-names
const Colorize = function () {
    const self = (string_: number | string) => string_ + "";

    self.strip = (value: string): string => value;

    // eslint-disable-next-line guard-for-in,no-loops/no-loops,no-restricted-syntax
    for (const name in baseColors) {
        // eslint-disable-next-line security/detect-object-injection
        styles[name] = {
            get() {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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

styles["ansi256"] = styles["fg"] as object;
styles["bgAnsi256"] = styles["bg"] as object;

// eslint-disable-next-line import/no-default-export,import/no-unused-modules
export default Colorize;
