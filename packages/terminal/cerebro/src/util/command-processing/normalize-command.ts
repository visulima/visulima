import type { CommandInput, EnvDefinition } from "../../types/command";

type DefinitionRecord<T> = Record<string, Omit<T, "name">>;

/**
 * Converts a record keyed by definition name into the array form, moving each
 * key into the `name` field. Returns the input unchanged when it is already an
 * array or absent, so callers can tell whether anything was converted.
 * @param definitions The record or array form as authored by the caller.
 * @returns A fresh, mutable array of definitions, or the input unchanged.
 */
const toDefinitionArray = <T extends { name: string }>(definitions: DefinitionRecord<T> | T[] | undefined): DefinitionRecord<T> | T[] | undefined => {
    if (definitions === undefined || Array.isArray(definitions)) {
        return definitions;
    }

    // A mutable array is required: `addNegatableOptions` pushes auto-generated
    // counterparts onto `command.options` after normalization.
    return Object.entries(definitions).map(([name, definition]) => ({ ...definition, name }) as T);
};

/**
 * Returns a command whose `options` and `env` are in the array form every other
 * consumer (parser, validation, help, readme, completion) reads.
 *
 * The result is a shallow copy rather than an in-place rewrite: `addCommand` does annotate the
 * command it registers (`__conflictingOptions__`, `addNegatableOptions`), but
 * those add fields — converting a record to an array *changes the shape of a
 * field the caller still holds a reference to*, which would make
 * `defineCommand`'s record-typed `options` a lie the moment the command was
 * registered, and would throw outright on a frozen command or one exposing
 * `options` through a getter.
 *
 * Copying also makes registration idempotent for free: the same command object
 * can be handed to two CLI instances without the second one seeing the first's
 * annotations. `Cli.clone()` copies the registry directly and never re-enters
 * `addCommand`, so it is unaffected either way.
 * @param command The command as passed to `addCommand`.
 * @returns The command, copied only if something needed converting.
 */
const normalizeCommandDefinitions = <C extends Pick<CommandInput, "env" | "options">>(command: C): C => {
    const options = toDefinitionArray(command.options);
    const environment = toDefinitionArray(command.env as DefinitionRecord<EnvDefinition> | EnvDefinition[] | undefined);

    if (options === command.options && environment === command.env) {
        return command;
    }

    // A bare spread would drop the prototype, so a class-based command would
    // lose its `execute()` method and fail registration with a message pointing
    // at the wrong thing. Copy onto the same prototype instead.
    return Object.assign(Object.create(Object.getPrototypeOf(command) as object | null) as C, command, { env: environment, options });
};

export default normalizeCommandDefinitions;
