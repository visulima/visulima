import type { OptionDefinition } from "@visulima/cerebro";

/**
 * Pair a boolean option with the hidden `--no-&lt;name>` twin that turns it off.
 *
 * cerebro only recognises `--no-x` when an option literally named `no-x` is
 * declared; it derives the mapping from the negated form, not the positive
 * one. Declaring just `{ name: "cache" }` and documenting "use --no-cache to
 * disable" therefore produces a flag that parses without complaint and
 * changes nothing — the same silent-no-op failure that makes a CI job pass
 * without running.
 *
 * Spread the result into an options array so the two can never drift:
 *
 * ```ts
 * options: [
 *     ...negatable({ defaultValue: true, description: "Enable caching (use --no-cache to disable)", name: "cache", type: Boolean }),
 * ]
 * ```
 *
 * The twin is `hidden` so help output stays as-is — `--no-x` is already
 * described by the positive option's own text.
 *
 * Leave `defaultValue` off the positive option when you need a tri-state
 * (`undefined` = "fall back to config"): neither flag present then leaves
 * the value `undefined` rather than collapsing it to a boolean.
 * @param option The positive boolean option.
 * @returns The option followed by its hidden negated twin.
 */
export const negatable = (option: OptionDefinition<boolean>): OptionDefinition<boolean>[] => [
    option,
    {
        description: `Disable --${option.name}.`,
        hidden: true,
        name: `no-${option.name}`,
        type: Boolean,
    },
];
