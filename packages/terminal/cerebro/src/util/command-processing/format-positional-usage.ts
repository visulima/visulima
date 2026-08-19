import type { ArgumentDefinition, Command as ICommand } from "../../types/command";

/**
 * Which usage convention to render.
 *
 * `help` is the fenced usage line — names as declared, required wrapped in
 * angle brackets. `readme` is the markdown heading, which predates named
 * positionals: uppercase names, required left bare. Both are kept as they were
 * so existing output does not shift.
 */
type PositionalStyle = "help" | "readme";

/**
 * Renders one positional's label.
 * @param argument The positional to render.
 * @param style Which usage convention to render.
 * @returns The rendered label.
 */
const formatOne = (argument: ArgumentDefinition, style: PositionalStyle): string => {
    const name = style === "readme" ? argument.name.toUpperCase() : argument.name;
    const label = `${name}${argument.multiple === true ? "..." : ""}`;

    if (argument.required === true) {
        // The readme heading has always left a required positional bare.
        return style === "readme" ? label : `<${label}>`;
    }

    return `[${label}]`;
};

/**
 * Renders the positional segment of a usage line.
 *
 * Named positionals are spelled out — `&lt;source> [targets...]` — so the reader
 * learns the slot order from the usage line itself. A single unnamed `argument`
 * keeps the generic placeholder, since it has no per-slot structure to show.
 * Hidden positionals are omitted, matching how options and env vars are treated.
 * @param command The command being documented.
 * @param command.argument Its single unnamed positional, if any.
 * @param command.arguments Its named positionals, if any.
 * @param style Which usage convention to render.
 * @returns The usage fragment, prefixed with a space, or an empty string.
 */
const formatPositionalUsage = (command: Pick<ICommand, "argument" | "arguments">, style: PositionalStyle = "help"): string => {
    // A lone `argument` has no per-slot structure to show, so it keeps the
    // generic placeholder it has always rendered in the help usage line.
    if (command.argument) {
        if (command.argument.hidden) {
            return "";
        }

        return style === "readme" ? ` ${formatOne(command.argument, style)}` : " [positional arguments]";
    }

    if (!command.arguments || command.arguments.length === 0) {
        return "";
    }

    return command.arguments
        .filter((argument: ArgumentDefinition) => !argument.hidden)
        .map((argument: ArgumentDefinition) => ` ${formatOne(argument, style)}`)
        .join("");
};

export type { PositionalStyle };
export default formatPositionalUsage;
