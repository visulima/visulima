/**
 * Built-in filter functions used by the Tera-subset renderer and
 * the filename interpolator. Names match moon's filter set.
 *
 * Case helpers come from `@visulima/string/case` (better Unicode and
 * acronym handling than the bare `change-case` package; same package
 * powers the rest of the visulima toolchain). Path filters use
 * `@visulima/path` so behaviour matches the rest of vis.
 */

import { join, relative } from "@visulima/path";
import { camelCase, constantCase, kebabCase, pascalCase, snakeCase, trainCase } from "@visulima/string/case";

export type FilterFn = (value: unknown, ...args: unknown[]) => unknown;

const stringify = (value: unknown): string => {
    if (value == null) {
        return "";
    }

    if (typeof value === "string") {
        return value;
    }

    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
        return String(value);
    }

    return JSON.stringify(value);
};

/**
 * Map of filter name → function. Unknown filter names raise an error
 * at render time so typos in templates don't silently no-op.
 */
export const FILTERS: Record<string, FilterFn> = {
    camel_case: (value) => camelCase(stringify(value)),
    kebab_case: (value) => kebabCase(stringify(value)),
    lower_case: (value) => stringify(value).toLowerCase(),
    pascal_case: (value) => pascalCase(stringify(value)),

    /**
     * `path_join`: join the input string with the filter argument as
     * an additional path segment. Matches moon's `value | path_join("subdir")`.
     */
    path_join: (value, ...args) => {
        const segments = [stringify(value), ...args.map((argument) => stringify(argument))];

        return join(...segments);
    },

    /**
     * `path_relative`: compute a relative path from the filter argument
     * (the "from" base) to the value (the "to" target). Matches moon's
     * `to | path_relative(from)`.
     */
    path_relative: (value, base) => relative(stringify(base), stringify(value)),
    snake_case: (value) => snakeCase(stringify(value)),
    upper_case: (value) => stringify(value).toUpperCase(),

    upper_kebab_case: (value) => trainCase(stringify(value)),

    upper_snake_case: (value) => constantCase(stringify(value)),
};

export const isKnownFilter = (name: string): boolean => Object.hasOwn(FILTERS, name);

/**
 * Apply a filter by name with optional arguments. Throws when the
 * filter name is unknown — callers should phrase the error with a
 * file:line reference.
 */
export const applyFilter = (name: string, value: unknown, args: unknown[] = []): unknown => {
    const fn = FILTERS[name];

    if (!fn) {
        throw new Error(`Unknown filter "${name}". Known filters: ${Object.keys(FILTERS).sort().join(", ")}.`);
    }

    return fn(value, ...args);
};
