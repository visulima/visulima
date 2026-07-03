import type { TemplateRenderer } from "./types";

/**
 * Resolves a dotted path (e.g. `user.name`) against a data object.
 * @param data The data object to read from.
 * @param path The dotted key path.
 * @returns The resolved value, or `undefined` when any segment is missing.
 */
const resolvePath = (data: Record<string, unknown>, path: string): unknown => {
    const segments = path.split(".");
    let current: unknown = data;

    for (const segment of segments) {
        if (current === null || typeof current !== "object") {
            return undefined;
        }

        current = (current as Record<string, unknown>)[segment];
    }

    return current;
};

/**
 * Zero-dependency `{{var}}` interpolation renderer. Edge-safe and peer-free.
 *
 * Replaces `{{ key }}` / `{{ a.b.c }}` placeholders with the matching value from
 * `data`. Unmatched placeholders render as an empty string. Whitespace inside the
 * braces is ignored. This is intentionally minimal — for conditionals/loops use the
 * Handlebars or Liquid renderers.
 * @param template The template string containing `{{var}}` placeholders.
 * @param data The data/variables to interpolate.
 * @returns The rendered string.
 * @throws {TypeError} When the template is not a string.
 * @example
 * ```ts
 * renderString("Hi {{ user.name }}, code {{code}}", { code: "123", user: { name: "Ada" } });
 * // => "Hi Ada, code 123"
 * ```
 */
export const renderString: TemplateRenderer = (template: unknown, data?: Record<string, unknown>): string => {
    if (typeof template !== "string") {
        throw new TypeError("String template must be a string");
    }

    const values = data ?? {};

    return template.replaceAll(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string): string => {
        const value = resolvePath(values, path);

        if (value === undefined || value === null) {
            return "";
        }

        if (typeof value === "string") {
            return value;
        }

        if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
            return String(value);
        }

        return JSON.stringify(value);
    });
};

export default renderString;
