import { classifyMany, matchesFilter } from "../../util/identify";
import type { HookEntry } from "./config";

const compileRegex = (pattern: string, label: string): RegExp => {
    try {
        return new RegExp(pattern);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        throw new Error(`invalid ${label} regex ${JSON.stringify(pattern)}: ${message}`, { cause: error });
    }
};

const hasTagFilters = (entry: HookEntry): boolean =>
    (entry.types && entry.types.length > 0) || (entry.typesOr && entry.typesOr.length > 0) || (entry.excludeTypes && entry.excludeTypes.length > 0) || false;

/**
 * Apply pre-commit-style `files` / `exclude` / `types` / `types_or` /
 * `exclude_types` filtering to `files`. Order:
 *
 *   1. `files` (keep matches)
 *   2. `exclude` (drop matches)
 *   3. tag filters (single pass over the classifier)
 *
 * Returns the surviving file list in input order.
 */
export const applyHookFilter = (files: ReadonlyArray<string>, entry: HookEntry): string[] => {
    let filtered: ReadonlyArray<string> = files;

    if (entry.files) {
        const rx = compileRegex(entry.files, "files");

        filtered = filtered.filter((f) => rx.test(f));
    }

    if (entry.exclude) {
        const rx = compileRegex(entry.exclude, "exclude");

        filtered = filtered.filter((f) => !rx.test(f));
    }

    if (!hasTagFilters(entry)) {
        return [...filtered];
    }

    const classifications = classifyMany(filtered);
    const filter = {
        excludeTypes: entry.excludeTypes,
        types: entry.types,
        typesOr: entry.typesOr,
    };

    return filtered.filter((f) => {
        const c = classifications.get(f);

        return c ? matchesFilter(c, filter) : false;
    });
};
