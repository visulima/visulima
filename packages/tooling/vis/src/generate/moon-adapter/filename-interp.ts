/**
 * Filename interpolation for moon-format templates.
 *
 * Bracket syntax inside any path segment:
 *   `[var]`            → value of `var` from the variable map
 *   `[var | filter]`   → filter applied to the value
 *   `[var | filter(arg)]` → filter with a string argument
 *
 * Suffixes `.tera` and `.twig` are stripped from the final segment
 * (they exist only for editor syntax highlighting).
 */

import { applyFilter } from "./filters";

const BRACKET_PATTERN = /\[([^\]]+)\]/g;

interface ParsedPipe {
    filters: { args: string[]; name: string }[];
    name: string;
}

const parseFilterCall = (chunk: string): { args: string[]; name: string } => {
    const trimmed = chunk.trim();
    const openParen = trimmed.indexOf("(");

    if (openParen === -1) {
        return { args: [], name: trimmed };
    }

    if (!trimmed.endsWith(")")) {
        throw new Error(`Filter call "${chunk}" missing closing ")"`);
    }

    const name = trimmed.slice(0, openParen).trim();
    const argsRaw = trimmed.slice(openParen + 1, -1).trim();

    if (argsRaw === "") {
        return { args: [], name };
    }

    // Naive split on commas at the top level — sufficient for moon's
    // single-string-arg filter usage. Strip surrounding quotes if present.
    const args = argsRaw.split(",").map((s) => {
        const t = s.trim();

        if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
            return t.slice(1, -1);
        }

        return t;
    });

    return { args, name };
};

const parsePipe = (expr: string): ParsedPipe => {
    const parts = expr.split("|").map((s) => s.trim());
    const name = parts[0] ?? "";

    if (!name) {
        throw new Error(`Empty variable name in expression "${expr}"`);
    }

    const filters = parts.slice(1).map(parseFilterCall);

    return { filters, name };
};

const stringify = (value: unknown): string => {
    if (value == null) {
        return "";
    }

    return typeof value === "string" ? value : String(value);
};

/**
 * Interpolate a single path segment or an entire path. Variables are
 * looked up in `vars`; missing keys raise an error so typos surface
 * during render rather than producing surprising filenames.
 *
 * `.tera` / `.twig` extensions are stripped from the result.
 */
export const interpolateFilename = (filename: string, vars: Record<string, unknown>): string => {
    const interpolated = filename.replaceAll(BRACKET_PATTERN, (_, expr: string) => {
        const { filters, name } = parsePipe(expr);

        if (!Object.hasOwn(vars, name)) {
            throw new Error(`Variable "${name}" used in filename "${filename}" but not defined`);
        }

        let value = vars[name];

        for (const filter of filters) {
            value = applyFilter(filter.name, value, filter.args);
        }

        return stringify(value);
    });

    return stripTeraSuffix(interpolated);
};

/**
 * Strip the trailing `.tera` / `.twig` marker from **every** path
 * segment. moon strips them per segment (not just the final one) so a
 * template at `src/.tera/file.ts.tera` renders to `src/file.ts`, not
 * `src/.tera/file.ts`.
 */
export const stripTeraSuffix = (filename: string): string =>
    filename
        .split("/")
        .map((segment) => {
            if (segment.endsWith(".tera")) {
                return segment.slice(0, -5);
            }

            if (segment.endsWith(".twig")) {
                return segment.slice(0, -5);
            }

            return segment;
        })
        .join("/");

/**
 * Strip the trailing `.raw` extension. moon adopters ship binary or
 * Tera-conflicting files with `.raw` suffix; renderers must skip them
 * but the suffix itself is removed on write.
 */
export const stripRawSuffix = (filename: string): string => (filename.endsWith(".raw") ? filename.slice(0, -4) : filename);

/**
 * True when the file is a partial — matched by *either* a basename
 * starting with `_` (moon's primary convention) or a path segment
 * equal to `partials` (moon's "folder of partials" convention).
 *
 * The earlier substring match on `"partial"` swallowed any file whose
 * name contained those letters (e.g. `PartialResult.ts`,
 * `partially-applied.ts`), silently dropping them from the output.
 */
export const isPartialPath = (path: string): boolean => {
    const segments = path.split("/");
    const name = segments.at(-1) ?? "";

    if (name.startsWith("_")) {
        return true;
    }

    return segments.slice(0, -1).includes("partials");
};
