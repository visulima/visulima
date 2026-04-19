/**
 * `vis generate &lt;template>` — in-repo scaffolding command.
 *
 * Discovers templates from `.vis/templates/`, `.moon/templates/`, and
 * `vis.config.ts` `generator.templates`, then runs the selected
 * template through prompts → produce → write.
 */

import type { Command } from "@visulima/cerebro";
import { isAbsolute, resolve } from "@visulima/path";

import { discoverTemplates } from "../generate/discover";
import { collectOptions } from "../generate/prompts";
import { fetchRemoteTemplate, isRemoteSource } from "../generate/remote";
import { runTemplate } from "../generate/runner";
import type { DiscoveredTemplate, Template } from "../generate/types";
import { bold, cyan, dim, info, note, success, warn } from "../output";

const printList = (templates: DiscoveredTemplate[]): void => {
    if (templates.length === 0) {
        info("No templates found.");
        note("Create one at .vis/templates/<name>.ts (programmatic) or .vis/templates/<name>/ (moon-format with template.yml).");

        return;
    }

    info("Available templates:");

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

const generate: Command = {
    argument: {
        description: "Template name (or remote source like git://… or npm://…) — omit for interactive picker",
        name: "template",
        type: String,
    },
    description: "Scaffold files from an in-repo template",
    examples: [
        ["vis generate", "Pick a template interactively"],
        ["vis generate package", "Run the 'package' template"],
        ["vis generate component -- --name=Button --style=primary", "Pre-fill option values"],
        ["vis generate package --to=./packages/new --force", "Custom destination + overwrite"],
        ["vis generate package --dry-run", "Print planned writes without touching disk"],
        ["vis generate git://github.com/org/template#main", "Fetch and run a remote template"],
        ["vis generate --list", "Show discovered templates"],
    ],
    execute: async ({ argument, options, rawUnknown, visConfig, workspaceRoot: wsRoot }) => {
        const cwd = (options.cwd as string) || wsRoot || process.cwd();
        const workspaceRoot = wsRoot ?? cwd;
        const generatorConfig = (visConfig as { generator?: { auth?: string; preferOffline?: boolean; templates?: string[] } } | undefined)?.generator;
        const args: string[] = Array.isArray(argument) ? argument : argument ? [argument] : [];

        // --list short-circuits before remote fetch.
        if (options.list) {
            const discovered = discoverTemplates({
                extraDirectories: generatorConfig?.templates ?? [],
                onWarning: warn,
                workspaceRoot,
            });

            printList(discovered);

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
                onWarning: warn,
                workspaceRoot,
            });

            if (discovered.length === 0) {
                throw new Error("No templates found. Create one at .vis/templates/<name>.ts or .vis/templates/<name>/template.yml.");
            }

            let wanted: string;

            if (input) {
                wanted = input;
            } else if (options.noInteractive || !process.stdin.isTTY) {
                throw new Error(
                    "No template specified. Pass a template name (see `vis generate --list`) or run interactively in a terminal.",
                );
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
        const toFlag = options.to as string | undefined;
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
        info(`Template: ${bold(cyan(templateName))}`);
        info(`Target:   ${dim(destination)}`);
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
                success(`Template '${templateName}' applied.`);
            }
        } finally {
            remoteCleanup?.();
        }
    },
    group: "Scaffold & Config",
    name: "generate",
    options: [
        { defaultValue: false, description: "List discovered templates", name: "list", type: Boolean },
        { description: "Destination directory", name: "to", type: String },
        { defaultValue: false, description: "Print planned writes without touching disk", name: "dry-run", type: Boolean },
        { defaultValue: false, description: "Overwrite existing files without prompting", name: "force", type: Boolean },
        { defaultValue: false, description: "Skip prompts; use template defaults", name: "defaults", type: Boolean },
        { defaultValue: false, description: "Skip running post-generation scripts", name: "skip-scripts", type: Boolean },
        { defaultValue: false, description: "Skip interactive prompts (errors on missing required values)", name: "no-interactive", type: Boolean },
        { defaultValue: false, description: "Prefer locally cached remote templates over re-downloading", name: "prefer-offline", type: Boolean },
    ],
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

export default generate;
