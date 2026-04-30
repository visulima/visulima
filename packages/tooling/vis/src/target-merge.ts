import type { VisTargetConfiguration } from "./target-options";

/**
 * Sentinel string that opts a single array entry into "splice the parent
 * array's values in here." Without it, child arrays replace parent arrays
 * wholesale (the `{ ...a, ...b }` spread semantics every config-merge
 * site already had).
 *
 * The `@` prefix matches our existing namespace convention for non-literal
 * config strings (`@filegroup:foo`, `@workspace`).
 */
export const INHERIT_SENTINEL = "@inherit" as const;

/**
 * Array-field names on `VisTargetConfiguration` that participate in the
 * inherit-aware merge. Listed once here so the same set drives every
 * merge site — adding a new array field means appending to this list.
 *
 * Out of scope: `tags` lives on the project (not the target);
 * `env` / `passThroughEnv` live under `options` and aren't on the target
 * itself — callers wanting to inherit those should use `@inherit` inside
 * the `options` object once that surface stabilises.
 */
const ARRAY_FIELDS = ["aliases", "dependsOn", "inputs", "outputs"] as const;

/**
 * Merge `child` over `parent` with `@inherit` splicing.
 *
 * - `child === undefined` — return `parent` (cloned) so callers can mutate freely.
 * - No `@inherit` in `child` — `child` replaces `parent` wholesale.
 * - `@inherit` present — each occurrence is replaced inline by `parent`'s
 *   entries, preserving order around it. Multiple `@inherit` occurrences
 *   each splice `parent` again (rarely useful but consistent).
 */
export const mergeArrayWithInherit = <T>(parent: readonly T[] | undefined, child: readonly T[] | undefined): T[] | undefined => {
    if (child === undefined) {
        return parent === undefined ? undefined : [...parent];
    }

    if (!child.some((entry) => entry === (INHERIT_SENTINEL as unknown as T))) {
        return [...child];
    }

    const result: T[] = [];

    for (const entry of child) {
        if (entry === (INHERIT_SENTINEL as unknown as T)) {
            if (parent !== undefined) {
                result.push(...parent);
            }

            continue;
        }

        result.push(entry);
    }

    return result;
};

/**
 * Merge two target configurations, applying `@inherit` splicing to every
 * array field listed in {@link ARRAY_FIELDS}. Non-array fields fall back
 * to plain "later wins" semantics (the existing `{ ...a, ...b }` rule).
 *
 * Returns a new object — never mutates either input.
 */
export const mergeTargetWithInherit = (
    parent: Partial<VisTargetConfiguration> | undefined,
    child: Partial<VisTargetConfiguration> | undefined,
): Partial<VisTargetConfiguration> => {
    const merged: Record<string, unknown> = { ...parent, ...child };

    for (const field of ARRAY_FIELDS) {
        const parentValue = parent?.[field] as readonly unknown[] | undefined;
        const childValue = child?.[field] as readonly unknown[] | undefined;
        const result = mergeArrayWithInherit(parentValue, childValue);

        if (result === undefined) {
            delete merged[field];
        } else {
            merged[field] = result;
        }
    }

    return merged as Partial<VisTargetConfiguration>;
};
