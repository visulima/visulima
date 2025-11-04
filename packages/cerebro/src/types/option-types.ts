/**
 * Helper types for creating type-safe commands with autocomplete support.
 * These types help you define your options and environment variables with full TypeScript autocomplete.
 */

/**
 * Converts option names to camelCase for the options object.
 * Options like "output-dir" become "outputDir" in the toolbox.
 * @example
 * ```typescript
 * // Option name: "output-dir" -> options.outputDir
 * // Option name: "api_key" -> options.apiKey
 * // Option name: "verbose" -> options.verbose
 * ```
 */
export type OptionNameToCamelCase<T extends string> = T extends `${infer Start}-${infer Rest}`
    ? `${Lowercase<Start>}${Capitalize<OptionNameToCamelCase<Rest>>}`
    : T extends `${infer Start}_${infer Rest}`
        ? `${Lowercase<Start>}${Capitalize<OptionNameToCamelCase<Rest>>}`
        : Lowercase<T>;

/**
 * Helper type to create a type-safe options object from option definitions.
 * @example
 * ```typescript
 * type MyOptions = CreateOptions<{
 *   "output-dir": string | undefined;
 *   "verbose": boolean | undefined;
 *   "port": number | undefined;
 * }>;
 * // Result: { outputDir: string | undefined, verbose: boolean | undefined, port: number | undefined }
 * ```
 */
export type CreateOptions<T extends Record<string, unknown>> = {
    [K in keyof T as OptionNameToCamelCase<K & string>]: T[K];
};

/**
 * Helper type to create a type-safe environment variables object from env definitions.
 * Environment variable names are converted from UPPER_SNAKE_CASE to camelCase.
 * @example
 * ```typescript
 * type MyEnv = CreateEnv<{
 *   "API_KEY": string | undefined;
 *   "DEBUG": boolean | undefined;
 * }>;
 * // Result: { apiKey: string | undefined, debug: boolean | undefined }
 * ```
 */
export type CreateEnv<T extends Record<string, unknown>> = {
    [K in keyof T as OptionNameToCamelCase<K & string>]: T[K];
};
