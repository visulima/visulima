/**
 * Shared environment-variable helpers.
 */

/**
 * Treat an env var as "on" unless it is unset, empty, `0`, `false`, or `no`
 * (case-insensitive). Canonical implementation reused across the security and
 * dlx surfaces — do not re-inline this predicate.
 * @param value The raw environment-variable value (or `undefined` if unset).
 * @returns `true` when the value is considered truthy/"on".
 */
export const isTruthyEnv = (value: string | undefined): boolean => {
    if (value === undefined) {
        return false;
    }

    const normalized = value.trim().toLowerCase();

    return normalized !== "" && normalized !== "0" && normalized !== "false" && normalized !== "no";
};
