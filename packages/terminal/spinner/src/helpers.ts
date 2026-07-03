import type { InteractiveManager } from "@visulima/interactive-manager";

import { Spinner } from "./spinner";
import type { SpinnerOptions, SpinnerPromiseOptions } from "./types";

/**
 * Resolve a text-or-function option against a value.
 */
const resolveText = (value: ((argument: never) => string) | string | undefined, argument: unknown): string | undefined => {
    if (typeof value === "function") {
        return (value as (argument: unknown) => string)(argument);
    }

    return value;
};

/**
 * Convenience factory mirroring ora's one-liner API.
 *
 * Returns a (not yet started) {@link Spinner} writing directly to `process.stderr`
 * (or `options.stream`) — no `InteractiveManager` boilerplate required.
 * @param text Optional text shown next to the spinner.
 * @param options Spinner configuration.
 * @returns A new {@link Spinner} instance (not started).
 * @example
 * ```typescript
 * import { createSpinner } from "@visulima/spinner";
 *
 * const spinner = createSpinner("Loading...").start();
 * // ... work ...
 * spinner.succeed("Done!");
 * ```
 */
export const createSpinner = (text?: string, options: SpinnerOptions = {}): Spinner => {
    const spinner = new Spinner(options);

    if (text !== undefined) {
        spinner.text = text;
    }

    return spinner;
};

/**
 * Run a promise (or async function) while showing a spinner, resolving to the
 * promise's value. Mirrors `oraPromise`.
 *
 * The spinner starts immediately, then `succeed`s with `successText` on resolution or
 * `failed`s with `failText` on rejection (re-throwing the original error).
 * @param action The promise, or a function returning one.
 * @param options Spinner + result-text configuration. A bare string is treated as the in-progress text.
 * @param interactiveManager Optional interactive manager for coordinated output.
 * @returns The resolved value of `action`.
 * @example
 * ```typescript
 * import { spinnerPromise } from "@visulima/spinner";
 *
 * const data = await spinnerPromise(fetchData(), {
 *   text: "Fetching...",
 *   successText: "Fetched!",
 *   failText: (error) => `Failed: ${String(error)}`,
 * });
 * ```
 */
export const spinnerPromise = async <T>(
    action: Promise<T> | (() => Promise<T>),
    options: SpinnerPromiseOptions | string = {},
    interactiveManager?: InteractiveManager,
): Promise<T> => {
    const resolvedOptions: SpinnerPromiseOptions = typeof options === "string" ? { text: options } : options;

    const { failText, successText, text, ...spinnerOptions } = resolvedOptions;

    const spinner = new Spinner(spinnerOptions, interactiveManager);

    spinner.start(text);

    try {
        const result = await (typeof action === "function" ? action() : action);

        spinner.succeed(resolveText(successText, result));

        return result;
    } catch (error) {
        spinner.failed(resolveText(failText, error));

        throw error;
    }
};
