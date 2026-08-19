import type { AnyCommandInput } from "@visulima/cerebro";
import { bold, cyan, dim, green, yellow } from "@visulima/colorize";

export interface DiscoveryOption {
    defaultValue?: unknown;
    description?: string;
    name: string;
    type: string;
}

export interface DiscoverySubcommand {
    argument?: { description?: string; name: string };
    description: string;
    examples: { command: string; description: string }[];
    name: string;
    options: DiscoveryOption[];
    path: string;
}

export interface DiscoveryPayload {
    command: string;
    description: string;
    subcommands: DiscoverySubcommand[];
}

export interface DiscoveryMeta {
    /** Root command name (e.g. "ai", "cache"). Used in the JSON payload and text header. */
    command: string;
    /** Human description of the root command. Shown after the header in text output. */
    description: string;
}

const AI_DISCOVERY_META: DiscoveryMeta = {
    command: "ai",
    description: "AI-assisted commands: provider detection, cache management, and failure-fix proposals.",
};

type DiscoveryOptionSource = { defaultValue?: unknown; description?: string; type?: unknown };

const typeName = (type: unknown): string => {
    if (typeof type !== "function") {
        return String(type);
    }

    const { name } = type as { name?: string };

    if (name === "Boolean") {
        return "boolean";
    }

    if (name === "Number") {
        return "number";
    }

    if (name === "String") {
        return "string";
    }

    return name ?? "unknown";
};

/**
 * Flattens either shape of `options` into `[name, definition]` pairs.
 *
 * Commands may declare options as an array carrying `name`, or as a record keyed
 * by name. Discovery output must not depend on which one a command happened to
 * use.
 * @param options The command's options, in either form.
 * @returns One entry per option, name first.
 */
const toOptionEntries = (options: AnyCommandInput["options"]): [string, DiscoveryOptionSource][] => {
    if (options === undefined) {
        return [];
    }

    if (Array.isArray(options)) {
        return options.map((option) => [option.name, option as DiscoveryOptionSource]);
    }

    return Object.entries(options);
};

const buildSubcommand = (command: AnyCommandInput): DiscoverySubcommand => {
    const path = [...(command.commandPath ?? []), command.name].join(" ");
    const examples = (command.examples ?? []).map(([cmd, description]) => {
        return {
            command: cmd ?? "",
            description: description ?? "",
        };
    });
    const options = toOptionEntries(command.options).map(([name, option]): DiscoveryOption => {
        return {
            defaultValue: option.defaultValue,
            description: option.description,
            name,
            type: typeName(option.type),
        };
    });

    return {
        argument: command.argument ? { description: command.argument.description, name: command.argument.name } : undefined,
        description: command.description ?? "",
        examples,
        name: command.name,
        options,
        path,
    };
};

export const buildDiscoveryPayload = (subcommands: AnyCommandInput[], meta: DiscoveryMeta = AI_DISCOVERY_META): DiscoveryPayload => {
    return {
        command: meta.command,
        description: meta.description,
        subcommands: subcommands.map((subcommand) => buildSubcommand(subcommand)),
    };
};

export const renderDiscoveryJson = (subcommands: AnyCommandInput[], meta: DiscoveryMeta = AI_DISCOVERY_META): string =>
    `${JSON.stringify(buildDiscoveryPayload(subcommands, meta), undefined, 2)}\n`;

export const renderDiscoveryText = (subcommands: AnyCommandInput[], meta: DiscoveryMeta = AI_DISCOVERY_META): string => {
    const payload = buildDiscoveryPayload(subcommands, meta);
    const lines: string[] = [bold(`vis ${payload.command} — ${payload.description}`), "", dim("Subcommands:")];

    for (const subcommand of payload.subcommands) {
        const argumentSegment = subcommand.argument ? ` ${cyan(`<${subcommand.argument.name}>`)}` : "";

        lines.push("");
        lines.push(`  ${green(`vis ${subcommand.path}`)}${argumentSegment}`);

        if (subcommand.description) {
            lines.push(`    ${subcommand.description}`);
        }

        if (subcommand.options.length > 0) {
            const optionList = subcommand.options.map((option) => `--${option.name}${option.type === "boolean" ? "" : `=<${option.type}>`}`).join(", ");

            lines.push(dim(`    options: ${optionList}`));
        }

        if (subcommand.examples.length > 0) {
            lines.push(dim("    examples:"));

            for (const example of subcommand.examples) {
                const trailing = example.description ? dim(` — ${example.description}`) : "";

                lines.push(`      ${yellow(example.command)}${trailing}`);
            }
        }
    }

    lines.push("");
    lines.push(dim(`Run \`vis ${payload.command} discover-help\` for the machine-readable JSON catalogue (designed for AI agents).`));
    lines.push(dim(`Run \`vis ${payload.command} <subcommand> --help\` for full usage of a specific subcommand.`));

    return `${lines.join("\n")}\n`;
};
