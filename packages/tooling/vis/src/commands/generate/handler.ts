import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { bold, cyan, dim } from "@visulima/colorize";
import { isAbsolute, resolve } from "@visulima/path";

import { discoverTemplates } from "../../generate/discover";
import { collectOptions } from "../../generate/prompts";
import { fetchRemoteTemplate, isRemoteSource } from "../../generate/remote";
import { runTemplate } from "../../generate/runner";
import type { DiscoveredTemplate, Template, Variable } from "../../generate/types";
import { pail } from "../../io/logger";
import type { GenerateOptions } from "./index";

interface TemplateListEntry {
    description?: string;
    name: string;
    path: string;
    source: DiscoveredTemplate["source"];
}

const toListEntry = async (template: DiscoveredTemplate): Promise<TemplateListEntry> => {
    let description: string | undefined;

    try {
        const loaded = await template.load();

        description = loaded.about?.description;
    } catch {
        // Best-effort — listing must not fail if a single template throws on load.
    }

    return { description, name: template.name, path: template.path, source: template.source };
};

interface VariableSummary {
    default?: boolean | number | string | string[];
    multiple?: boolean;
    name: string;
    order?: number;
    prompt?: string;
    required?: boolean;
    type: Variable["type"];
    values?: string[];
}

const summarizeVariable = (name: string, variable: Variable): VariableSummary => {
    const summary: VariableSummary = {
        default: variable.default,
        name,
        order: variable.order,
        prompt: variable.prompt,
        required: variable.required,
        type: variable.type,
    };

    if (variable.type === "enum") {
        summary.multiple = variable.multiple;
        summary.values = variable.values;
    }

    return summary;
};

const describeTemplate = async (
    discovered: DiscoveredTemplate,
): Promise<{
    description: string;
    destination?: string;
    name: string;
    path: string;
    source: DiscoveredTemplate["source"];
    variables: VariableSummary[];
}> => {
    const loaded = await discovered.load();
    // Match the prompt sort: missing order behaves as 0, then alphabetical.
    const variables = Object.entries(loaded.options ?? {})
        .sort(([nameA, a], [nameB, b]) => {
            const orderA = a.order ?? 0;
            const orderB = b.order ?? 0;

            return orderA === orderB ? nameA.localeCompare(nameB) : orderA - orderB;
        })
        .map(([name, variable]) => summarizeVariable(name, variable));

    return {
        description: loaded.about?.description ?? "",
        destination: loaded.destination,
        name: discovered.name,
        path: discovered.path,
        source: discovered.source,
        variables,
    };
};

const printList = (templates: DiscoveredTemplate[]): void => {
    if (templates.length === 0) {
        pail.info("No templates found.");
        pail.notice("Create one at .vis/templates/<name>.ts (programmatic) or .vis/templates/<name>/ (moon-format with template.yml).");

        return;
    }

    pail.info("Available templates:");

    for (const template of templates) {
        const tag = dim(`(${template.source})`);

        process.stderr.write(`  ${bold(cyan(template.name))} ${tag}\n`);
    }
};

const parsePassthroughOverrides = (extraArguments: string[]): { overrides: Record<string, string>; remaining: string[] } => {
    const overrides: Record<string, string> = {};
    const remaining: string[] = [];

    for (const argument of extraArguments) {
        if (!argument.startsWith("--")) {
            remaining.push(argument);
            continue;
        }

        const equalsIndex = argument.indexOf("=");

        if (equalsIndex === -1) {
            // Boolean flag: `--name`
            const key = argument.slice(2);

            if (key.startsWith("no-")) {
                overrides[key.slice(3)] = "false";
            } else {
                overrides[key] = "true";
            }

            continue;
        }

        const key = argument.slice(2, equalsIndex);
        const value = argument.slice(equalsIndex + 1);

        overrides[key] = value;
    }

    return { overrides, remaining };
};

const pickInteractive = async (templates: DiscoveredTemplate[]): Promise<string> => {
    const { createInterface } = await import("node:readline");
    const rl = createInterface({ input: process.stdin, output: process.stderr });

    try {
        process.stderr.write(`  ${bold(cyan("vis generate"))} ${dim("— pick a template")}\n\n`);

        for (const [index, template] of templates.entries()) {
            const prefix = bold(cyan(`  ${String(index + 1)}.`));

            process.stderr.write(`${prefix} ${template.name} ${dim(`(${template.source})`)}\n`);
        }

        return new Promise((resolveValue, reject) => {
            rl.question(`\n  ${dim(`Enter choice (1-${String(templates.length)}):`)} `, (answer) => {
                const number_ = Number.parseInt(answer.trim(), 10);

                if (Number.isInteger(number_) && number_ >= 1 && number_ <= templates.length) {
                    resolveValue(templates[number_ - 1]!.name);
                } else {
                    reject(new Error("Invalid choice."));
                }
            });
        });
    } finally {
        rl.close();
    }
};

const execute = async ({ argument, options, rawUnknown, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, GenerateOptions>): Promise<void> => {
    const cwd = ((options as Record<string, unknown>).cwd as string | undefined) || wsRoot || process.cwd();
    const workspaceRoot = wsRoot ?? cwd;
    const generatorConfig = visConfig?.generator;
    const args: string[] = Array.isArray(argument) ? argument : argument ? [argument] : [];

    // --list short-circuits before remote fetch.
    if (options.list) {
        const discovered = discoverTemplates({
            extraDirectories: generatorConfig?.templates ?? [],
            onWarning: (message: string) => {
                pail.warn(message);
            },
            workspaceRoot,
        });

        if (options.json) {
            const entries = await Promise.all(discovered.map((t) => toListEntry(t)));

            process.stdout.write(`${JSON.stringify(entries, null, 2)}\n`);

            return;
        }

        printList(discovered);

        return;
    }

    // --describe short-circuits before remote fetch / produce.
    if (options.describe) {
        const wanted = args[0];

        if (!wanted) {
            throw new Error("`--describe` requires a template name. Run `vis generate --list` to see available templates.");
        }

        const discovered = discoverTemplates({
            extraDirectories: generatorConfig?.templates ?? [],
            onWarning: (message: string) => {
                pail.warn(message);
            },
            workspaceRoot,
        });
        const match = discovered.find((t) => t.name === wanted);

        if (!match) {
            throw new Error(`Template "${wanted}" not found. Run \`vis generate --list\` to see available templates.`);
        }

        const described = await describeTemplate(match);

        if (options.json) {
            process.stdout.write(`${JSON.stringify(described, null, 2)}\n`);

            return;
        }

        pail.info(`Template: ${bold(cyan(described.name))} ${dim(`(${described.source})`)}`);

        if (described.description) {
            pail.info(described.description);
        }

        if (described.destination) {
            pail.info(`Destination: ${dim(described.destination)}`);
        }

        if (described.variables.length === 0) {
            pail.info("No variables.");
        } else {
            pail.info("Variables:");

            for (const variable of described.variables) {
                const flags: string[] = [variable.type];

                if (variable.required) flags.push("required");

                if (variable.default !== undefined) flags.push(`default=${JSON.stringify(variable.default)}`);

                if (variable.values) flags.push(`values=${variable.values.join("|")}`);

                process.stderr.write(`  ${bold(cyan(variable.name))} ${dim(`(${flags.join(", ")})`)}\n`);
            }
        }

        return;
    }

    // `rawUnknown` is cerebro's buffer of tokens command-line-args
    // couldn't assign — populated from the `--`-separated tail
    // (`vis generate pkg -- --foo=bar`). Fall back to an argv walk
    // on older cerebro versions that don't surface the field yet.
    let passthrough: string[] = [...(rawUnknown ?? [])];

    if (passthrough.length === 0) {
        const rawArgv = process.argv.slice(2);
        const argvDashIndex = rawArgv.indexOf("--");

        if (argvDashIndex !== -1) {
            passthrough = rawArgv.slice(argvDashIndex + 1);
        }
    }

    // Legacy safety net: if a future cerebro ever started forwarding
    // the tail into `args`, keep honoring it.
    const legacyDashIndex = args.indexOf("--");
    const legacyExtras = legacyDashIndex === -1 ? [] : args.slice(legacyDashIndex + 1);
    const ownArgs = legacyDashIndex === -1 ? args : args.slice(0, legacyDashIndex);
    const { overrides } = parsePassthroughOverrides([...legacyExtras, ...passthrough]);

    let template: Template | undefined;
    let templateName: string | undefined;
    let templateDestination: string | undefined;

    const input = ownArgs[0];

    // ── Remote source ────────────────────────────────────────
    let remoteCleanup: (() => void) | undefined;

    if (input && isRemoteSource(input)) {
        const fetched = await fetchRemoteTemplate(input, {
            auth: generatorConfig?.auth,
            preferOffline: Boolean(options.preferOffline) || generatorConfig?.preferOffline,
        });

        remoteCleanup = fetched.cleanup;

        try {
            const discovered = discoverTemplates({ extraDirectories: [fetched.directory], workspaceRoot });
            const remoteTemplate = discovered.find((t) => t.path.startsWith(fetched.directory));

            if (!remoteTemplate) {
                throw new Error(`Downloaded template at ${fetched.directory} contains no template.yml or *.ts entrypoint.`);
            }

            // Load into memory BEFORE we let the tmp dir go — the moon
            // adapter pre-reads every template file at load time, so
            // the Template returned by `load()` is fully self-contained.
            template = await remoteTemplate.load();
            templateName = remoteTemplate.name;
            templateDestination = template.destination;
        } catch (error) {
            remoteCleanup();
            remoteCleanup = undefined;
            throw error;
        }
    } else {
        const discovered = discoverTemplates({
            extraDirectories: generatorConfig?.templates ?? [],
            onWarning: (message: string) => {
                pail.warn(message);
            },
            workspaceRoot,
        });

        if (discovered.length === 0) {
            throw new Error("No templates found. Create one at .vis/templates/<name>.ts or .vis/templates/<name>/template.yml.");
        }

        let wanted: string;

        if (input) {
            wanted = input;
        } else if (options.noInteractive || !process.stdin.isTTY) {
            throw new Error("No template specified. Pass a template name (see `vis generate --list`) or run interactively in a terminal.");
        } else {
            wanted = await pickInteractive(discovered);
        }

        const match = discovered.find((t) => t.name === wanted);

        if (!match) {
            throw new Error(`Template "${wanted}" not found. Run 'vis generate --list' to see available templates.`);
        }

        template = await match.load();
        templateName = match.name;
        templateDestination = template.destination;
    }

    // ── Destination ──────────────────────────────────────────
    const toFlag = options.to;
    const dryRun = Boolean(options.dryRun);
    const force = Boolean(options.force);
    const useDefaults = Boolean(options.defaults);
    const skipScripts = Boolean(options.skipScripts);
    const isInteractive = !options.noInteractive && Boolean(process.stdin.isTTY) && !useDefaults;

    let destinationInput: string;

    if (toFlag) {
        destinationInput = toFlag;
    } else if (templateDestination) {
        destinationInput = templateDestination;
    } else {
        destinationInput = ".";
    }

    const destination = isAbsolute(destinationInput) ? destinationInput : resolve(cwd, destinationInput);

    // ── Options collection ───────────────────────────────────
    pail.info(`Template: ${bold(cyan(templateName))}`);
    pail.info(`Target:   ${dim(destination)}`);
    process.stderr.write("\n");

    const collectedOptions = await collectOptions({
        defaults: useDefaults,
        interactive: isInteractive,
        overrides,
        variables: template.options ?? {},
    });

    // ── Run ──────────────────────────────────────────────────
    try {
        await runTemplate(template, {
            cwd,
            destination,
            dryRun,
            force,
            options: collectedOptions,
            skipScripts,
            workspaceRoot,
        });

        if (!dryRun) {
            process.stderr.write("\n");
            pail.success(`Template '${templateName}' applied.`);
        }
    } finally {
        remoteCleanup?.();
    }
};

export default execute as CommandExecute<Toolbox>;
