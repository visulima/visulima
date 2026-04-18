/**
 * Variable-schema → interactive prompts.
 *
 * Builds on the same `node:readline` helpers `vis create` uses (see
 * src/commands/create/prompts.ts). The implementation is minimal — no
 * fancy multi-line UI, no spinner, no terminal control codes — to
 * stay consistent with the rest of the vis CLI surface.
 */

import { createInterface } from "node:readline";

import { bold, cyan, dim } from "../output";
import type { Options, Variable, VariableMap } from "./types";

type RL = ReturnType<typeof createInterface>;

const ask = (rl: RL, question: string): Promise<string> =>
    new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });

const confirm = async (rl: RL, question: string, defaultYes: boolean): Promise<boolean> => {
    const hint = defaultYes ? "[Y/n]" : "[y/N]";
    const answer = await ask(rl, `  ${question} ${dim(hint)} `);

    if (answer === "") {
        return defaultYes;
    }

    return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
};

const selectOne = async (rl: RL, question: string, choices: string[], defaultValue?: string): Promise<string> => {
    process.stderr.write(`  ${question}\n`);

    for (const [index, choice] of choices.entries()) {
        const prefix = bold(cyan(`  ${String(index + 1)}.`));
        const star = choice === defaultValue ? dim(" (default)") : "";

        process.stderr.write(`${prefix} ${choice}${star}\n`);
    }

    while (true) {
        const answer = await ask(rl, `\n  ${dim(`Enter choice (1-${String(choices.length)}):`)} `);

        if (answer === "" && defaultValue !== undefined) {
            return defaultValue;
        }

        const number_ = Number.parseInt(answer, 10);

        if (Number.isInteger(number_) && number_ >= 1 && number_ <= choices.length) {
            return choices[number_ - 1]!;
        }

        const match = choices.find((c) => c === answer);

        if (match) {
            return match;
        }

        process.stderr.write(`  ${dim("Invalid choice. Try again.")}\n`);
    }
};

const selectMany = async (rl: RL, question: string, choices: string[], defaultValues: string[]): Promise<string[]> => {
    process.stderr.write(`  ${question} ${dim("(comma-separated numbers)")}\n`);

    for (const [index, choice] of choices.entries()) {
        const prefix = bold(cyan(`  ${String(index + 1)}.`));
        const star = defaultValues.includes(choice) ? dim(" (default)") : "";

        process.stderr.write(`${prefix} ${choice}${star}\n`);
    }

    while (true) {
        const answer = await ask(rl, `\n  ${dim(`Enter choices:`)} `);

        if (answer === "" && defaultValues.length > 0) {
            return defaultValues;
        }

        const indices = answer
            .split(",")
            .map((part) => Number.parseInt(part.trim(), 10))
            .filter((n) => Number.isInteger(n) && n >= 1 && n <= choices.length);

        if (indices.length > 0) {
            return indices.map((index) => choices[index - 1]!);
        }

        process.stderr.write(`  ${dim("Invalid choice. Try again.")}\n`);
    }
};

const promptText = (label: string): string => `  ${dim(`${label}:`)} `;

const variableLabel = (name: string, variable: Variable): string => variable.prompt ?? name;

const sortVariables = (variables: VariableMap): [string, Variable][] =>
    Object.entries(variables).sort(([nameA, a], [nameB, b]) => {
        const orderA = a.order ?? 0;
        const orderB = b.order ?? 0;

        if (orderA !== orderB) {
            return orderA - orderB;
        }

        return nameA.localeCompare(nameB);
    });

interface CollectOptions {
    /** When true, skip prompts and use defaults / overrides only. */
    defaults: boolean;
    /** When false, never prompt — error on missing required values. */
    interactive: boolean;
    /** CLI overrides — variable name → unparsed string from `--name=value`. */
    overrides: Record<string, string>;
    /** Variable schema. */
    variables: VariableMap;
}

const parseValue = (variable: Variable, raw: string): unknown => {
    switch (variable.type) {
        case "array": {
            return raw
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
        }
        case "boolean": {
            return raw === "true" || raw === "1" || raw === "yes" || raw === "y";
        }
        case "enum": {
            if (variable.multiple) {
                return raw
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
            }

            return raw;
        }
        case "number": {
            const parsed = Number(raw);

            if (Number.isNaN(parsed)) {
                throw new TypeError(`Expected a number, got "${raw}"`);
            }

            return parsed;
        }
        default: {
            return raw;
        }
    }
};

const validateValue = (name: string, variable: Variable, value: unknown): void => {
    if (variable.type === "enum") {
        const values = Array.isArray(value) ? value : [value];

        for (const candidate of values) {
            if (typeof candidate !== "string" || !variable.values.includes(candidate)) {
                throw new Error(`Variable "${name}" must be one of: ${variable.values.join(", ")} (got "${String(candidate)}")`);
            }
        }
    }
};

/**
 * Collect option values from prompts + CLI overrides + defaults, then
 * validate them.
 */
export const collectOptions = async (collectOptionsArguments: CollectOptions): Promise<Options> => {
    const { defaults, interactive, overrides, variables } = collectOptionsArguments;
    const result: Options = {};
    const rl = interactive ? createInterface({ input: process.stdin, output: process.stderr }) : null;

    try {
        for (const [name, variable] of sortVariables(variables)) {
            // 1. CLI override wins
            if (Object.hasOwn(overrides, name)) {
                const value = parseValue(variable, overrides[name] ?? "");

                validateValue(name, variable, value);
                result[name] = value;
                continue;
            }

            // 2. Defaults / non-interactive: use declared default
            if (defaults || !interactive || variable.internal) {
                if (variable.default !== undefined) {
                    validateValue(name, variable, variable.default);
                    result[name] = variable.default;
                    continue;
                }

                if (variable.required) {
                    throw new Error(`Required variable "${name}" not provided. Pass --${name}=<value> or remove --defaults.`);
                }

                continue;
            }

            // 3. Interactive prompt
            const label = variableLabel(name, variable);
            let value: unknown;

            if (variable.type === "boolean") {
                value = await confirm(rl!, label, Boolean(variable.default ?? false));
            } else if (variable.type === "enum") {
                if (variable.multiple) {
                    const defaultValues = Array.isArray(variable.default) ? variable.default : [];

                    value = await selectMany(rl!, label, variable.values, defaultValues);
                } else {
                    const defaultValue = typeof variable.default === "string" ? variable.default : undefined;

                    value = await selectOne(rl!, label, variable.values, defaultValue);
                }
            } else {
                const defaultHint = variable.default === undefined ? "" : ` (${String(variable.default)})`;
                const raw = await ask(rl!, promptText(`${label}${defaultHint}`));

                if (raw === "" && variable.default !== undefined) {
                    value = variable.default;
                } else if (raw === "") {
                    if (variable.required) {
                        throw new Error(`Variable "${name}" is required`);
                    }

                    continue;
                } else {
                    value = parseValue(variable, raw);
                }
            }

            validateValue(name, variable, value);
            result[name] = value;
        }

        return result;
    } finally {
        rl?.close();
    }
};
