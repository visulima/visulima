export interface ErrorProperties {
    cause?: Error | unknown;
    hint?: ErrorHint;
    location?: ErrorLocation;
    message?: string;
    name: string;
    stack?: string;
    title?: string;
}

export interface ErrorLocation {
    column?: number;
    file?: string;
    line?: number;
}

/**
 * A message that explains to the user how they can fix the error.
 * @example
 * ```ts
 * const error = new VisulimaError({
 *    hint: "Try running `npm install` to install missing dependencies.",
 *    location: {
 *    file: "src/index.ts",
 *    line: 1,
 *    column: 1,
 *    },
 *    message: "Cannot find module 'react'",
 *    name: "ModuleNotFoundError",
 * });
 * ```
 *
 * For more complex hints, you can pass an array of strings or a single string in markdown format.
 */
export type ErrorHint = string[] | string;
