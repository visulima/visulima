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
            // Convert camelCase to kebab-case for CSS properties
            const cssKey = key.replaceAll(/([A-Z])/g, "-$1").toLowerCase();

            styles.push(`${cssKey}: ${String(value)};`);
        }
    });

    return styles.join(" ");
};

/**
 * Template tag function for CSS that returns the CSS as-is.
 * Template strings and interpolated values are used as-is without escaping.
 * Use the function call with `shouldEscape: true` if you need CSS escaping.
 * @param strings Template literal strings
 * @param values Template literal values (used as-is)
 * @returns The CSS string as-is
 * @example
 * css`:where(.UnderlineNav-actions ul) { animation: 1ms rgh-selector-observer; }`
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
    // Template tag call: css`...`
    if (Array.isArray(stringsOrValue) && "raw" in stringsOrValue) {
        const strings = stringsOrValue as TemplateStringsArray;
        let result = strings[0] ?? "";

        for (const [i, element] of valuesOrEscape.entries()) {
            // Template strings are trusted, interpolated values are used as-is
            result += String(element ?? "");
            result += strings[i + 1] ?? "";
        }

        // Return CSS as-is (no escaping) for template tag
        return result;
    }

    // Function call: css(value, escape)
    const value = stringsOrValue as string | FlexibleCSSProperties | Properties;
    const shouldEscape = valuesOrEscape[0] as boolean | undefined;

    // Convert object to CSS string if needed
    const cssString = typeof value === "string" ? value : cssObjectToString(value);

    if (shouldEscape === true) {
        return escapeCss(cssString);
    }

    // Default: return as-is
    return cssString;
}

export default css;
