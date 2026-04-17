/**
 * Small helpers shared between the CLI command and the programmatic
 * surface when a value has to be coerced from a string (CLI flag, env
 * variable, config file). Kept free of runtime deps so it can be unit
 * tested in isolation.
 */

/** Env var read as the concurrency fallback when `--concurrent` isn't passed. */
export const CONCURRENT_ENV_VAR = "VIS_STAGED_CONCURRENT";

/**
 * Parses a stringified concurrency value. Accepts the same shapes as the
 * `--concurrent` CLI flag:
 *
 * - `"true"` or an empty string → `true` (unbounded, capped internally at CPU count)
 * - `"false"` → `false` (serial)
 * - an integer string → the parsed number
 * - anything else (including NaN) → `true`, matching the CLI-flag fallback
 */
export const parseConcurrent = (value: string): boolean | number => {
    const trimmed = value.trim();

    if (trimmed === "true" || trimmed === "") {
        return true;
    }

    if (trimmed === "false") {
        return false;
    }

    const parsed = Number(trimmed);

    return Number.isNaN(parsed) ? true : parsed;
};
