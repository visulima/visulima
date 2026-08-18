/**
 * Helper types for creating type-safe commands with autocomplete support.
 * These types help you define your options and environment variables with full TypeScript autocomplete.
 * Use these types to create type-safe Toolbox interfaces for your commands.
 * @example
 * ```typescript
 * import { CreateOptions, CreateEnv, type Toolbox } from '@visulima/cerebro';
 *
 * // Define options with their original names (they'll be converted to camelCase)
 * type BuildOptions = CreateOptions<{
 *   "output-dir": string | undefined;
 *   "verbose": boolean | undefined;
 *   "port": number | undefined;
 * }>;
 * // Result: { outputDir: string | undefined, verbose: boolean | undefined, port: number | undefined }
 *
 * // Define environment variables (UPPER_SNAKE_CASE -> camelCase)
 * type BuildEnv = CreateEnv<{
 *   "API_KEY": string | undefined;
 *   "DEBUG": boolean | undefined;
 * }>;
 * // Result: { apiKey: string | undefined, debug: boolean | undefined }
 *
 * // Use in your command
 * cli.addCommand({
 *   name: "build",
 *   options: [
 *     { name: "output-dir", type: String },
 *     { name: "verbose", type: Boolean },
 *     { name: "port", type: Number }
 *   ],
 *   env: [
 *     { name: "API_KEY", type: String },
 *     { name: "DEBUG", type: Boolean }
 *   ],
 *   execute: ({ options, env }: Toolbox<Console, BuildOptions, BuildEnv>) => {
 *     // Full autocomplete on options.outputDir, options.verbose, env.apiKey, etc.
 *     console.log(options.outputDir, options.verbose, env.apiKey);
 *   }
 * });
 * ```
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
 *
 * Prefer `defineCommand`, which infers this shape from the definitions
 * themselves instead of restating their names. Reach for `CreateOptions` when
 * you are annotating a `Toolbox` by hand — typically because the command uses
 * the array form of `options`, which carries no inferable key information.
 *
 * Note that this type lowercases a name with no separator in it (`outputDir`
 * becomes `outputdir`), which matches how environment variables are folded but
 * not* how the option parser folds option names.
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
 *
 * Prefer `defineCommand`, which infers this shape from the definitions
 * themselves. This type matches the env folding rules exactly.
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
