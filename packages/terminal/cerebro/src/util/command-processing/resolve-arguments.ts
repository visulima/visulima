import type { ArgumentDefinition } from "../../types/command";

/**
 * The same fold the option parser applies to option names: a hyphen folds into
 * the following character only when it is an ASCII lowercase letter.
 *
 * Deliberately identical to `command-line-args`' `/-([a-z])/g` rather than a
 * general-purpose camelCase, so `toolbox.args` and `toolbox.options` key their
 * names the same way and a single inference type (`FoldName`) describes both.
 */
const FOLD_PATTERN = /-([a-z])/g;

const foldName = (name: string): string => name.replaceAll(FOLD_PATTERN, (_, letter: string) => letter.toUpperCase());

/**
 * The outcome of mapping positional tokens onto named slots. Missing required
 * slots are reported rather than thrown, so the throwing stays with the other
 * command validation instead of inside toolbox assembly.
 */
interface ResolvedArguments {
    /** Slots whose supplied value was not one of their declared `choices`. */
    invalid: { choices: ReadonlyArray<string>; name: string; value: string }[];

    /** Names of `required` slots that were not supplied. */
    missing: string[];

    /** Positional values keyed by their folded name. */
    resolved: Record<string, unknown>;

    /** Supplied tokens beyond the declared slots, in order. */
    surplus: ReadonlyArray<string>;
}

/**
 * Applies a positional's `type` transform to a raw token. Untyped positionals
 * stay raw strings, matching how the parser treats untyped options.
 * @param definition The positional definition.
 * @param value The raw token.
 * @returns The transformed value.
 */
const transform = (definition: ArgumentDefinition, value: string): unknown => {
    if (definition.type === undefined) {
        return value;
    }

    return definition.type(value);
};

/**
 * Collects the tokens a slot rejects because they fall outside its `choices`.
 * @param definition The positional definition.
 * @param tokens The raw tokens assigned to the slot.
 * @returns One entry per offending token; empty when the slot declares no choices.
 */
const offendingChoices = (definition: ArgumentDefinition, tokens: ReadonlyArray<string>): ResolvedArguments["invalid"] => {
    const { choices } = definition;

    if (!choices || choices.length === 0) {
        return [];
    }

    const offending: ResolvedArguments["invalid"] = [];

    for (const value of tokens) {
        if (!choices.includes(value)) {
            offending.push({ choices, name: definition.name, value });
        }
    }

    return offending;
};

/**
 * Resolves the value for a slot that received no tokens.
 * @param definition The positional definition.
 * @param isVariadic Whether the slot collects the remaining tokens.
 * @returns The declared default, wrapped for a variadic slot.
 */
const emptySlotValue = (definition: ArgumentDefinition, isVariadic: boolean): unknown => {
    // `Collected` types a variadic slot as an array, so a scalar `defaultValue`
    // must not leak through as one.
    if (isVariadic && definition.defaultValue !== undefined && !Array.isArray(definition.defaultValue)) {
        return [definition.defaultValue];
    }

    return definition.defaultValue;
};

/**
 * Maps the flat list of positional tokens onto the command's named `arguments`,
 * in declaration order.
 *
 * The final positional may declare `multiple: true` to collect every remaining
 * token; every other slot takes exactly one. Missing slots fall back to
 * `defaultValue`.
 * @param definitions The command's positional definitions, in slot order.
 * @param positionals The raw positional tokens as parsed from argv, with any
 * `--` passthrough segment already removed by the caller.
 * @returns The resolved values plus anything the caller should reject.
 */
const resolveArguments = (definitions: ReadonlyArray<ArgumentDefinition>, positionals: ReadonlyArray<string>): ResolvedArguments => {
    const resolved: Record<string, unknown> = {};
    const missing: string[] = [];
    const invalid: ResolvedArguments["invalid"] = [];
    const lastIndex = definitions.length - 1;

    let consumed = 0;

    for (const [index, definition] of definitions.entries()) {
        const key = foldName(definition.name);
        const isVariadic = index === lastIndex && definition.multiple === true;
        const tokens = isVariadic ? positionals.slice(index) : positionals.slice(index, index + 1);

        if (tokens.length === 0) {
            if (definition.required === true) {
                missing.push(definition.name);
            }

            resolved[key] = emptySlotValue(definition, isVariadic);

            continue;
        }

        invalid.push(...offendingChoices(definition, tokens));

        consumed = index + tokens.length;
        resolved[key] = isVariadic ? tokens.map((token) => transform(definition, token)) : transform(definition, tokens[0] as string);
    }

    return { invalid, missing, resolved, surplus: positionals.slice(consumed) };
};

export { foldName };
export type { ResolvedArguments };
export default resolveArguments;
