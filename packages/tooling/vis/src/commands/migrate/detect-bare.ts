/**
 * Detects whether the user typed bare `vis migrate` (with only global flags,
 * no subcommand). Cerebro's nested-command parser matches shortest-prefix
 * first (see nested-command-parser.test.ts:47-60 in `@visulima/cerebro`), so a
 * flat `migrate` command can't coexist with nested `migrate &lt;name>` entries
 * without breaking their dispatch. We detect the bare form here, before
 * `cli.run()`, and route it to the interactive TUI.
 *
 * Returns `true` iff `migrate` is the only positional argument in `argv` and
 * no `--help`/`--version` is present (those should fall through to cerebro
 * so the user still gets help/version output).
 *
 * The parser only consumes a value after a flag when that flag is known to
 * take a string value (`--cwd`). All other flag-shaped tokens are treated as
 * boolean switches — matching cerebro's actual global-option definitions
 * (see default-options.ts in `@visulima/cerebro`) plus vis's only custom
 * global, `--cwd`. Command-specific options don't apply here because they
 * only bind after a subcommand is matched.
 */

const VALUE_TAKING_GLOBAL_FLAGS = new Set<string>(["--cwd"]);
const PASS_THROUGH_FLAGS = new Set<string>(["--help", "--version", "-h", "-V"]);

export const isBareMigrateInvocation = (argv: ReadonlyArray<string>): boolean => {
    const positional: string[] = [];

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];

        if (argument === undefined) {
            continue;
        }

        if (PASS_THROUGH_FLAGS.has(argument)) {
            return false;
        }

        if (argument.startsWith("-")) {
            const equalsIndex = argument.indexOf("=");
            const name = equalsIndex === -1 ? argument : argument.slice(0, equalsIndex);

            if (VALUE_TAKING_GLOBAL_FLAGS.has(name) && equalsIndex === -1) {
                // `--cwd value` form — skip the following token as the value.
                const next = argv[index + 1];

                if (next !== undefined && !next.startsWith("-")) {
                    index += 1;
                }
            }

            continue;
        }

        positional.push(argument);
    }

    return positional.length === 1 && positional[0] === "migrate";
};
