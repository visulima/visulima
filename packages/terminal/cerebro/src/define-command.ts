import type {
    ArgumentDefinition,
    CommandExecute,
    CommandInput,
    EnvDefinitionRecord,
    LazyCommandModule,
    OptionDefinition,
    OptionDefinitionRecord,
} from "./types/command";
import type { InferArguments, InferEnv, InferOptions } from "./types/infer";
import type { Toolbox as IToolbox } from "./types/toolbox";

/**
 * The toolbox a command declared through {@link defineCommand} receives, with
 * `options`, `env` and `args` inferred from the command's own definitions.
 */
type InferredToolbox<
    TOptions extends OptionDefinitionRecord,
    TEnv extends EnvDefinitionRecord,
    TArguments extends ReadonlyArray<ArgumentDefinition>,
    TLogger extends Console = Console,
> = IToolbox<TLogger, InferOptions<TOptions>, InferEnv<TEnv>, InferArguments<TArguments>>;

/**
 * A command whose `execute` / `loader` handler is typed from its own `options`,
 * `env` and `arguments` declarations.
 */
type DefinedCommand<
    TOptions extends OptionDefinitionRecord,
    TEnv extends EnvDefinitionRecord,
    TArguments extends ReadonlyArray<ArgumentDefinition>,
    TLogger extends Console = Console,
> = Omit<CommandInput<OptionDefinition<unknown>, TLogger>, "arguments" | "env" | "execute" | "loader" | "options"> & {
    arguments?: TArguments;
    env?: TEnv;
    // `NoInfer` keeps the handler out of inference: the toolbox shape is decided
    // by `options` / `env` / `arguments` alone. Without it a `loader` pointing at
    // a separately-typed handler module becomes a competing inference site and
    // collapses `TEnv` / `TArguments` / `TLogger` to `never`.
    execute?: CommandExecute<NoInfer<InferredToolbox<TOptions, TEnv, TArguments, TLogger>>>;
    loader?: () => Promise<LazyCommandModule<NoInfer<InferredToolbox<TOptions, TEnv, TArguments, TLogger>>>>;
    options?: TOptions;
};

/**
 * Declares a command with a single source of truth for its options and
 * environment variables.
 *
 * `options` and `env` are records keyed by name, and the `execute` handler's
 * `toolbox.options` / `toolbox.env` are inferred from them — no second type
 * declaration, no `Toolbox&lt;...>` annotation, and a renamed option becomes a
 * compile error at every use site instead of a silent `undefined`.
 *
 * Identity at runtime: it exists only to capture the literal types of the
 * definitions, so it costs nothing beyond the call itself.
 * @param command The command definition.
 * @returns The same object, with its definition types preserved.
 * @example
 * ```typescript
 * import { defineCommand } from "@visulima/cerebro";
 *
 * const build = defineCommand({
 *     name: "build",
 *     options: {
 *         "output-dir": { required: true, type: String },
 *         verbose: { defaultValue: false, type: Boolean },
 *     },
 *     env: {
 *         API_KEY: { type: String },
 *     },
 *     arguments: [{ name: "entry", required: true, type: String }],
 *     execute: ({ args, env, options }) => {
 *         args.entry; // string
 *         options.outputDir; // string
 *         options.verbose; // boolean
 *         env.apiKey; // string | undefined
 *     },
 * });
 *
 * cli.addCommand(build);
 * ```
 */
/* eslint-disable @typescript-eslint/no-empty-object-type */
const defineCommand = <
    TOptions extends OptionDefinitionRecord = {},
    TEnv extends EnvDefinitionRecord = {},
    const TArguments extends ReadonlyArray<ArgumentDefinition> = [],
    TLogger extends Console = Console,
>(
    command: DefinedCommand<TOptions, TEnv, TArguments, TLogger>,
): DefinedCommand<TOptions, TEnv, TArguments, TLogger> => command;
/* eslint-enable @typescript-eslint/no-empty-object-type */

export type { DefinedCommand, InferredToolbox };
export default defineCommand;
