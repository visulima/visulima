// eslint-disable-next-line import/no-extraneous-dependencies
import { escapeCss } from "@std/html/unstable-escape-css";
import type { Properties } from "csstype";

/**
 * Converts a CSS object to a CSS string.
 * @param cssObject The CSS object with camelCase properties
 * @returns The CSS string representation
 */
const cssObjectToString = (cssObject: Properties): string => {
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
 * @param strings Template literal strings
 * @param values Template literal values
 * @returns The CSS string as-is
 * @example
 * css`:where(.UnderlineNav-actions ul) { animation: 1ms rgh-selector-observer; }`
 */
function css(strings: TemplateStringsArray, ...values: unknown[]): string;

/**
 * Function overload for CSS with escaping control.
 * Supports both string and object inputs.
 * @param value The CSS string or object to process
 * @param escape If true, escapes CSS. If false, returns CSS as-is.
 * @returns The processed CSS string
 * @example
 * css(':where(.UnderlineNav-actions ul) { animation: 1ms rgh-selector-observer; }', true)
 * @example
 * css({ padding: "1px" }, true)
 */
function css(value: string | Properties, escape?: boolean): string;

function css(stringsOrValue: TemplateStringsArray | string | Properties, ...valuesOrEscape: unknown[]): string {
    // Template tag call: css`...`
    if (Array.isArray(stringsOrValue) && "raw" in stringsOrValue) {
        const strings = stringsOrValue as TemplateStringsArray;
        let result = strings[0] ?? "";

        for (const [i, element] of valuesOrEscape.entries()) {
            result += String(element ?? "");
            result += strings[i + 1] ?? "";
        }

        return result;
    }

    // Function call: css(value, escape)
    const value = stringsOrValue as string | Properties;
    const escape = valuesOrEscape[0] as boolean | undefined;

    // Convert object to CSS string if needed
    const cssString = typeof value === "string" ? value : cssObjectToString(value);

    if (escape === true) {
        return escapeCss(cssString);
    }

    // Default: return as-is
    return cssString;
}

export default css;
