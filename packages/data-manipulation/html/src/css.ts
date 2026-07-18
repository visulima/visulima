// eslint-disable-next-line import/no-extraneous-dependencies
import { escapeCss } from "@std/html/unstable-escape-css";
import type { Properties } from "csstype";

/**
 * The standard CSS properties type from `csstype`.
 */
type CSSProperties = Properties;

/**
 * Flexible CSS properties type that allows autocomplete for property names
 * while accepting string, number, null, or undefined values.
 */
type FlexibleCSSProperties = {
    [K in keyof Properties]?: Properties[K] | string | number | null | undefined;
};

// CSS property names recur heavily across renders (e.g. "padding", "marginTop"),
// so memoize the camelCase -> kebab-case conversion in a module-level cache to avoid
// repeating the regex work and per-call closure allocation on hot paths.
const kebabCache = new Map<string, string>();
const KEBAB_CACHE_LIMIT = 1000;

/**
 * Converts a camelCase CSS property name to kebab-case, preserving custom properties
 * (`--foo`) and vendor-prefixed `ms`/`Ms` properties (`-ms-*`).
 * @param key The (potentially camelCase) CSS property name.
 * @returns The kebab-cased property name.
 */
const toKebab = (key: string): string => {
    // Custom properties are identity-mapped; skip the cache entirely so dynamic
    // custom-property names (e.g. `--color-${id}`) cannot grow it unbounded.
    if (key.startsWith("--")) {
        return key;
    }

    const cached = kebabCache.get(key);

    if (cached !== undefined) {
        return cached;
    }

    const kebab = key.replaceAll(/([A-Z])/g, "-$1").toLowerCase();
    const result = kebab.startsWith("ms-") ? `-ms-${kebab.slice(3)}` : kebab;

    // Bound the cache so an adversarial or dynamic stream of distinct property
    // names cannot grow it without limit for the process lifetime.
    if (kebabCache.size < KEBAB_CACHE_LIMIT) {
        kebabCache.set(key, result);
    }

    return result;
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
            styles.push(`${toKebab(key)}: ${String(value)};`);
        }
    });

    return styles.join(" ");
};

const CSS_WHITESPACE = new Set([" ", "\t", "\n", "\r", "\f", "\v"]);

/**
 * Immutable minifier state threaded through the one-line CSS minifier's per-character
 * handlers. Handlers read this and return a fresh state rather than mutating it.
 */
interface MinifyState {
    readonly inComment: boolean;
    readonly inWhitespaceRun: boolean;
    readonly quote: "\"" | "'" | undefined;
}

/**
 * The outcome of processing a single character: the text to append, the index of the last
 * character consumed, and the resulting state.
 */
interface MinifyStep {
    readonly nextIndex: number;
    readonly nextState: MinifyState;
    readonly output: string;
}

/**
 * Builds the step for a run of whitespace, emitting a single collapsed space only when the
 * previous character was not already whitespace.
 * @param state The current minifier state.
 * @param index The current character index.
 * @returns A step that emits at most one space and marks a whitespace run as open.
 */
const collapseWhitespaceStep = (state: MinifyState, index: number): MinifyStep => {
    return {
        nextIndex: index,
        nextState: { ...state, inWhitespaceRun: true },
        output: state.inWhitespaceRun ? "" : " ",
    };
};

/**
 * Processes one character while inside a quoted CSS string: emit verbatim, honoring
 * backslash escapes, until the matching closing quote is reached.
 * @param input The full CSS string being minified.
 * @param index The current character index.
 * @param state The current minifier state.
 * @returns The resulting step.
 */
const stepInQuote = (input: string, index: number, state: MinifyState): MinifyStep => {
    const char = input[index] as string;

    if (char === "\\" && index + 1 < input.length) {
        return { nextIndex: index + 1, nextState: state, output: char + (input[index + 1] as string) };
    }

    const nextState = char === state.quote ? { ...state, quote: undefined } : state;

    return { nextIndex: index, nextState, output: char };
};

/**
 * Processes one character while inside a comment: collapse whitespace like normal but never
 * treat a quote as a string opener, so apostrophes in prose comments do not flip string
 * mode and corrupt the rest of the stylesheet.
 * @param input The full CSS string being minified.
 * @param index The current character index.
 * @param state The current minifier state.
 * @returns The resulting step.
 */
const stepInComment = (input: string, index: number, state: MinifyState): MinifyStep => {
    const char = input[index] as string;

    if (char === "*" && input[index + 1] === "/") {
        return { nextIndex: index + 1, nextState: { ...state, inComment: false, inWhitespaceRun: false }, output: "*/" };
    }

    if (CSS_WHITESPACE.has(char)) {
        return collapseWhitespaceStep(state, index);
    }

    return { nextIndex: index, nextState: { ...state, inWhitespaceRun: false }, output: char };
};

/**
 * Processes one character in the default (outside string/comment) mode.
 * @param input The full CSS string being minified.
 * @param index The current character index.
 * @param state The current minifier state.
 * @returns The resulting step.
 */
const stepDefault = (input: string, index: number, state: MinifyState): MinifyStep => {
    const char = input[index] as string;

    if (char === "/" && input[index + 1] === "*") {
        return { nextIndex: index + 1, nextState: { ...state, inComment: true, inWhitespaceRun: false }, output: "/*" };
    }

    if (char === "\"" || char === "'") {
        return { nextIndex: index, nextState: { ...state, inWhitespaceRun: false, quote: char }, output: char };
    }

    if (CSS_WHITESPACE.has(char)) {
        return collapseWhitespaceStep(state, index);
    }

    return { nextIndex: index, nextState: { ...state, inWhitespaceRun: false }, output: char };
};

/**
 * Collapses runs of whitespace into a single space while preserving the contents of
 * single- and double-quoted CSS strings (e.g. `content: "a   b"`), so the one-line
 * minifier does not mangle quoted values. Escaped quotes (`\"`, `\'`) inside strings
 * are respected.
 * @param input The CSS string to minify.
 * @returns The minified one-line CSS string.
 */
const collapseWhitespaceOutsideStrings = (input: string): string => {
    let state: MinifyState = { inComment: false, inWhitespaceRun: false, quote: undefined };
    let result = "";
    let index = 0;

    while (index < input.length) {
        let step: MinifyStep;

        if (state.quote !== undefined) {
            step = stepInQuote(input, index, state);
        } else if (state.inComment) {
            step = stepInComment(input, index, state);
        } else {
            step = stepDefault(input, index, state);
        }

        result += step.output;
        state = step.nextState;
        index = step.nextIndex + 1;
    }

    return result.trim();
};

/**
 * Template tag function for CSS that returns a minified one-line CSS string.
 * Template strings are used as-is, but interpolated values are escaped by default.
 * Whitespace and newlines outside of quoted strings are collapsed into single spaces;
 * whitespace inside single-/double-quoted values (e.g. `content: "a   b"`) is preserved.
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

        return collapseWhitespaceOutsideStrings(result);
    }

    const value = stringsOrValue as string | FlexibleCSSProperties | Properties;
    const shouldEscape = valuesOrEscape[0] as boolean | undefined;

    const cssString = typeof value === "string" ? value : cssObjectToString(value);

    if (shouldEscape === true) {
        return escapeCss(cssString);
    }

    return cssString;
}

export type { CSSProperties, FlexibleCSSProperties };
export default css;
