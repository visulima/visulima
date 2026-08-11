// `@std/html` is consumed from JSR and stays a devDependency: a `jsr:` specifier is not
// installable for npm consumers, so the implementation is bundled. Re-exporting its symbols
// directly would still leave `from "@std/html/..."` in the emitted declarations, which no
// consumer can resolve — so the public surface is re-declared here with explicit signatures.
// eslint-disable-next-line import/no-extraneous-dependencies
import { escapeCss as stdEscapeCss } from "@std/html/unstable-escape-css";
// eslint-disable-next-line import/no-extraneous-dependencies
import { escapeJs as stdEscapeJs } from "@std/html/unstable-escape-js";
// eslint-disable-next-line import/no-extraneous-dependencies
import { isValidCustomElementName as stdIsValidCustomElementName } from "@std/html/unstable-is-valid-custom-element-name";

/** Options for {@link escapeJs}. */
export type EscapeJsOptions = {
    /**
     * The number of spaces or tab to use for indentation in the output.
     * If not specified, no extra whitespace is added.
     */
    space?: "\t" | number;
};

/**
 * Escapes a string for safe interpolation inside a CSS `&lt;style>` tag or attribute.
 * @param string_ The string to escape.
 * @returns The escaped string.
 */
export const escapeCss = (string_: string): string => stdEscapeCss(string_);

/**
 * Escapes JSON-serializable data for safe interpolation inside a `&lt;script>` tag.
 * @param data The data to escape.
 * @param options Options for escaping.
 * @returns The escaped string.
 */
export const escapeJs = (data: unknown, options?: EscapeJsOptions): string => stdEscapeJs(data, options);

/**
 * Checks whether a name is a valid custom element name per the HTML spec.
 * @param elementName The name to check.
 * @returns `true` when the name may be used for a custom element.
 */
export const isValidCustomElementName = (elementName: string): boolean => stdIsValidCustomElementName(elementName);
