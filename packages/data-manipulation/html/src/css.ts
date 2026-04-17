// eslint-disable-next-line import/no-extraneous-dependencies
import { escapeCss } from "@std/html/unstable-escape-css";
import type { Properties } from "csstype";

/**
 * Flexible CSS properties type that allows autocomplete for property names
 * while accepting string, number, null, or undefined values.
 */
type FlexibleCSSProperties = {
    [K in keyof Properties]?: Properties[K] | string | number | null | undefined;
};

/**
 * Converts a CSS object to a CSS string.
 * @param cssObject The CSS object with camelCase properties
 * @returns The CSS string representation
 */
const cssObjectToString = (cssObject: FlexibleCSSProperties | Properties): string => {
    const styles: string[] = [];

    Object.entries(cssObject).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            const cssKey = key.startsWith("--")
                ? key
                : (() => {
                    const kebab = key.replaceAll(/([A-Z])/g, "-$1").toLowerCase();

                    return kebab.startsWith("ms-") ? `-ms-${kebab.slice(3)}` : kebab;
                })();

            styles.push(`${cssKey}: ${String(value)};`);
        }
    });

    return styles.join(" ");
};

/**
 * Template tag function for CSS that returns a minified one-line CSS string.
 * Template strings are used as-is, but interpolated values are escaped by default.
 * All whitespace and newlines are collapsed into single spaces.
 * @param strings Template literal strings
 * @param values Template literal values (escaped by default)
 * @returns A minified one-line CSS string
 * @example
 * css`:where(.UnderlineNav-actions ul) { animation: 1ms rgh-selector-observer; }`
 * // Returns: ":where(.UnderlineNav-actions ul) { animation: 1ms rgh-selector-observer; }"
 */
function css(strings: TemplateStringsArray, ...values: unknown[]): string;

/**
 * Function overload for CSS with escaping control.
 * Supports both string and object inputs.
 * @param value The CSS string or object to process
 * @param shouldEscape If true, escapes CSS. If false, returns CSS as-is.
 * @returns The processed CSS string
 * @example
 * css(':where(.UnderlineNav-actions ul) { animation: 1ms rgh-selector-observer; }', true)
 * @example
 * css({ padding: "1px" }, true)
 * @example
 * css({ margin: 20, padding: 10 }, false)
 */
function css(value: string | FlexibleCSSProperties | Properties, shouldEscape?: boolean): string;

function css(stringsOrValue: TemplateStringsArray | string | FlexibleCSSProperties | Properties, ...valuesOrEscape: unknown[]): string {
    if (Array.isArray(stringsOrValue) && "raw" in stringsOrValue) {
        const strings = stringsOrValue as TemplateStringsArray;

        let result = strings[0] ?? "";

        for (const [i, element] of valuesOrEscape.entries()) {
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            result += escapeCss(String(element ?? ""));
            result += strings[i + 1] ?? "";
        }

        result = result.trim().replaceAll(/\s+/g, " ");

        return result;
    }

    const value = stringsOrValue as string | FlexibleCSSProperties | Properties;
    const shouldEscape = valuesOrEscape[0] as boolean | undefined;

    const cssString = typeof value === "string" ? value : cssObjectToString(value);

    if (shouldEscape === true) {
        return escapeCss(cssString);
    }

    return cssString;
}

export default css;
