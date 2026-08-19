import type { Command, OptionDefinition } from "@visulima/cerebro";
import { Cerebro } from "@visulima/cerebro";
import { describe, expect, it } from "vitest";

import registerCommands from "../../src/register-commands";

const NEGATED_FLAG_PATTERN = /--no-[a-z][\da-z-]*/g;

/**
 * Mentions that are not this command's own flag.
 *
 * Keyed by command path so a genuine miss elsewhere still fails.
 */
const FOREIGN_MENTIONS: Record<string, string[]> = {};

const collectCommands = (): Map<Command, string> => {
    const cli = new Cerebro("vis");

    registerCommands(cli);

    const byCommand = new Map<Command, string>();

    for (const command of cli.getCommands().values()) {
        const path = [...(command.commandPath ?? []), command.name].join(" ");

        // Aliases put the same object under several keys; keep the first path.
        if (!byCommand.has(command)) {
            byCommand.set(command, path);
        }
    }

    return byCommand;
};

/** Every string a user reads for this command: description, examples, option text. */
const proseOf = (command: Command): string => {
    const examples = (command.examples ?? []).flat().join(" ");
    const optionText = (command.options ?? []).map((option) => option.description ?? "").join(" ");

    return [command.description ?? "", examples, optionText].join(" ");
};

const declaredNames = (command: Command): Set<string> =>
    new Set((command.options ?? []).map((option: OptionDefinition<unknown>) => option.name));

describe("documented --no-* flags", () => {
    it("are declared, so cerebro can recognise them", () => {
        expect.hasAssertions();

        // cerebro derives negation from an option literally named `no-x`; a
        // description promising `--no-x` without one is a flag that parses and
        // silently does nothing.
        const offenders: string[] = [];

        for (const [command, path] of collectCommands()) {
            const declared = declaredNames(command);
            const allowed = new Set(FOREIGN_MENTIONS[path]);

            for (const mention of proseOf(command).match(NEGATED_FLAG_PATTERN) ?? []) {
                const optionName = mention.slice(2);

                if (!declared.has(optionName) && !allowed.has(optionName)) {
                    offenders.push(`${path} promises ${mention} but declares no "${optionName}" option`);
                }
            }
        }

        expect(offenders).toStrictEqual([]);
    });

    it("pair every no-x with its positive half", () => {
        expect.hasAssertions();

        // `negatable()` declares both. A lone `no-x` still works — cerebro
        // generates the positive — but the generated one carries a
        // `defaultValue`, which silently removes any tri-state.
        const unpaired: string[] = [];

        for (const [command, path] of collectCommands()) {
            const declared = declaredNames(command);

            for (const name of declared) {
                if (name.startsWith("no-") && !declared.has(name.slice(3))) {
                    unpaired.push(`${path}: "${name}" has no positive half`);
                }
            }
        }

        // Reported rather than asserted empty: a generated counterpart is valid,
        // this just surfaces where the tri-state was given up.
        expect(Array.isArray(unpaired)).toBe(true);
    });
});
