/**
 * First-class task arguments: a declarative schema per target that lets a
 * task define its named/positional arguments, validate what the user passes
 * on the CLI, and render a per-task `--help`. The validated values are also
 * exposed to the command as `VIS_ARG_&lt;NAME>` environment variables so the
 * underlying script can read them without re-parsing argv.
 *
 * This module is intentionally pure (no IO) so it is trivially unit-testable;
 * the run handler wires it to the forwarded-args vector and the task env.
 */

/** Value type a {@link TaskArgument} coerces to and validates against. */
export type TaskArgumentType = "boolean" | "enum" | "number" | "string";

/** A coerced task-argument value. */
export type TaskArgumentValue = boolean | number | string;

/** A single declared argument for a task target. */
export interface TaskArgument {
    /** Short single-character alias (e.g. `r` for `--reporter`, used as `-r`). */
    alias?: string;

    /** Allowed values when {@link TaskArgument.type} is `"enum"`. */
    choices?: string[];

    /** Value applied when the argument is omitted. Skips the required check. */
    default?: TaskArgumentValue;

    /** One-line help text surfaced by per-task `--help`. */
    description?: string;

    /** Canonical name, without the leading `--` (kebab-case by convention). */
    name: string;

    /**
     * Consume the value from the next free positional argument instead of a
     * `--flag`. Positional args are filled in declaration order.
     */
    positional?: boolean;

    /** Fail the task when the argument is absent and has no `default`. */
    required?: boolean;

    /** Value type for coercion + validation. Defaults to `"string"`. */
    type?: TaskArgumentType;
}

/** Result of {@link parseTaskArguments}. */
export interface ParsedTaskArguments {
    /** Human-readable validation errors. Empty when the input is valid. */
    errors: string[];

    /** Coerced values for declared arguments that were provided or defaulted. */
    values: Record<string, TaskArgumentValue>;
}

const asKebab = (name: string): string => name.replace(/^--?/u, "");

/** Tokens accepted as explicit boolean values (case-insensitive). */
const BOOLEAN_LITERALS = new Set(["0", "1", "false", "no", "true", "yes"]);

/**
 * A token is a *value* (not a flag) when it doesn't start with `-`, or when it
 * is a negative number (`-5`, `-1.5`) — so `--offset -5` consumes `-5` while
 * `--reporter -r` does not swallow the `-r` flag.
 */
const isValueToken = (token: string): boolean => !token.startsWith("-") || /^-(?:\d|\.\d)/u.test(token);

/**
 * Set `provided[name]` from either the inline `=value`, the next token, or a
 * presence-only `"true"`. Returns the number of *extra* tokens consumed (0 or
 * 1) so the caller can advance its loop counter. Boolean args only consume a
 * following token when it is a boolean literal, so `--watch true` works
 * without leaving `true` as a stray positional.
 */
const captureValue = (
    provided: Map<string, string>,
    name: string,
    argument: TaskArgument | undefined,
    inline: string | undefined,
    raw: string[],
    index: number,
): number => {
    if (inline !== undefined) {
        provided.set(name, inline);

        return 0;
    }

    const next = raw[index + 1];

    if ((argument?.type ?? "string") === "boolean") {
        if (next !== undefined && BOOLEAN_LITERALS.has(next.toLowerCase())) {
            provided.set(name, next.toLowerCase());

            return 1;
        }

        provided.set(name, "true");

        return 0;
    }

    if (next !== undefined && isValueToken(next)) {
        provided.set(name, next);

        return 1;
    }

    provided.set(name, "true");

    return 0;
};

const coerce = (
    argument: TaskArgument,
    raw: string,
): { error?: string; value?: TaskArgumentValue } => {
    const type = argument.type ?? "string";

    if (type === "number") {
        const trimmed = raw.trim();
        const value = Number(trimmed);

        // Reject empty (`Number("")` is 0) and non-finite (`Infinity`, `NaN`).
        if (trimmed === "" || !Number.isFinite(value)) {
            return { error: `--${argument.name} expects a number, got "${raw}"` };
        }

        return { value };
    }

    if (type === "boolean") {
        if (["1", "true", "yes"].includes(raw.toLowerCase())) {
            return { value: true };
        }

        if (["0", "false", "no"].includes(raw.toLowerCase())) {
            return { value: false };
        }

        return { error: `--${argument.name} expects a boolean, got "${raw}"` };
    }

    if (type === "enum") {
        const choices = argument.choices ?? [];

        if (!choices.includes(raw)) {
            return { error: `--${argument.name} must be one of [${choices.join(", ")}], got "${raw}"` };
        }

        return { value: raw };
    }

    return { value: raw };
};

/**
 * Parse + validate a raw forwarded-args vector against a task's argument
 * schema. Unknown tokens are left untouched (the command still receives the
 * full forwarded vector) — only declared arguments are validated, so a schema
 * never blocks passing extra flags straight through to the underlying tool.
 */
export const parseTaskArguments = (schema: TaskArgument[], raw: string[]): ParsedTaskArguments => {
    const byName = new Map<string, TaskArgument>();
    const byAlias = new Map<string, TaskArgument>();

    for (const argument of schema) {
        byName.set(argument.name, argument);

        if (argument.alias) {
            byAlias.set(argument.alias, argument);
        }
    }

    // Collect raw flag values + leftover positionals in one pass.
    const provided = new Map<string, string>();
    const positionals: string[] = [];

    for (let index = 0; index < raw.length; index += 1) {
        const token = raw[index] as string;

        if (token === "--") {
            // Everything after `--` is a positional pass-through.
            positionals.push(...raw.slice(index + 1));
            break;
        }

        if (token.startsWith("--no-")) {
            provided.set(asKebab(token.slice("--no-".length)), "false");

            continue;
        }

        const matchLong = /^--([^=]+)(?:=(.*))?$/su.exec(token);

        if (matchLong) {
            const name = matchLong[1] as string;

            index += captureValue(provided, name, byName.get(name), matchLong[2], raw, index);

            continue;
        }

        const matchShort = /^-([^=-])(?:=(.*))?$/su.exec(token);
        const shortName = matchShort?.[1];

        if (matchShort && shortName !== undefined) {
            const argument = byAlias.get(shortName);

            index += captureValue(provided, argument?.name ?? shortName, argument, matchShort[2], raw, index);

            continue;
        }

        positionals.push(token);
    }

    const values: Record<string, TaskArgumentValue> = {};
    const errors: string[] = [];
    let positionalIndex = 0;

    for (const argument of schema) {
        let rawValue: string | undefined = provided.get(argument.name);

        if (rawValue === undefined && argument.positional && positionalIndex < positionals.length) {
            rawValue = positionals[positionalIndex];
            positionalIndex += 1;
        }

        if (rawValue === undefined) {
            if (argument.default !== undefined) {
                values[argument.name] = argument.default;
            } else if (argument.required) {
                errors.push(`missing required argument --${argument.name}`);
            }

            continue;
        }

        const { error, value } = coerce(argument, rawValue);

        if (error) {
            errors.push(error);
        } else if (value !== undefined) {
            values[argument.name] = value;
        }
    }

    return { errors, values };
};

/**
 * `VIS_ARG_&lt;UPPER_SNAKE>` env-var name for a declared argument. Non-alphanumeric
 * runs collapse to `_`, so argument names should be unique after normalization
 * (`min-age` and `min_age` both map to `VIS_ARG_MIN_AGE`).
 */
export const taskArgumentEnvName = (name: string): string => `VIS_ARG_${asKebab(name).replaceAll(/[^a-zA-Z0-9]+/gu, "_").toUpperCase()}`;

/** Build the `{ VIS_ARG_*: value }` env block from validated values. */
export const taskArgumentEnv = (values: Record<string, TaskArgumentValue>): Record<string, string> => {
    const env: Record<string, string> = {};

    for (const [name, value] of Object.entries(values)) {
        env[taskArgumentEnvName(name)] = String(value);
    }

    return env;
};

/** Render a per-task `--help` block from the target's description + schema. */
export const renderTaskArgumentsHelp = (targetName: string, description: string | undefined, schema: TaskArgument[]): string => {
    const lines: string[] = [`Usage: vis run ${targetName} [-- <args>]`];

    if (description) {
        lines.push("", description);
    }

    if (schema.length === 0) {
        return lines.join("\n");
    }

    lines.push("", "Arguments:");

    const rows = schema.map((argument) => {
        const flag = argument.positional ? `<${argument.name}>` : `--${argument.name}`;
        const alias = argument.alias ? `, -${argument.alias}` : "";

        return { left: `${flag}${alias}`, right: argument };
    });

    const width = Math.max(...rows.map((row) => row.left.length));

    for (const { left, right } of rows) {
        const meta: string[] = [];
        const type = right.type ?? "string";

        meta.push(type === "enum" ? `enum(${(right.choices ?? []).join("|")})` : type);

        if (right.required) {
            meta.push("required");
        }

        if (right.default !== undefined) {
            meta.push(`default: ${String(right.default)}`);
        }

        const detail = `${right.description ?? ""}${right.description ? " " : ""}[${meta.join(", ")}]`;

        lines.push(`  ${left.padEnd(width)}  ${detail}`);
    }

    return lines.join("\n");
};
