/**
 * `vis generate &lt;template>` — in-repo scaffolding command.
 *
 * Discovers templates from `.vis/templates/`, `.moon/templates/`, and
 * `vis.config.ts` `generator.templates`, then runs the selected
 * template through prompts → produce → write.
 */

import type { Command, CreateOptions } from "@visulima/cerebro";

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
        ["vis generate --list --json", "Machine-readable template list"],
        ["vis generate package --describe --json", "Print template metadata (variables, destination) as JSON"],
    ],
    group: "Scaffold & Config",
    loader: () => import("./handler"),
    name: "generate",
    options: [
        { defaultValue: false, description: "List discovered templates", name: "list", type: Boolean },
        {
            defaultValue: false,
            description: "Print template metadata (about, destination, variables) without running produce",
            name: "describe",
            type: Boolean,
        },
        { defaultValue: false, description: "Emit JSON output (with --list or --describe)", name: "json", type: Boolean },
        { description: "Destination directory", name: "to", type: String },
        { defaultValue: false, description: "Print planned writes without touching disk", name: "dry-run", type: Boolean },
        { defaultValue: false, description: "Overwrite existing files without prompting", name: "force", type: Boolean },
        { defaultValue: false, description: "Skip prompts; use template defaults", name: "defaults", type: Boolean },
        { defaultValue: false, description: "Skip running post-generation scripts", name: "skip-scripts", type: Boolean },
        { defaultValue: false, description: "Skip interactive prompts (errors on missing required values)", name: "no-interactive", type: Boolean },
        { defaultValue: false, description: "Prefer locally cached remote templates over re-downloading", name: "prefer-offline", type: Boolean },
    ],
};

export default generate;

export type GenerateOptions = CreateOptions<{
    defaults: boolean | undefined;
    describe: boolean | undefined;
    "dry-run": boolean | undefined;
    force: boolean | undefined;
    json: boolean | undefined;
    list: boolean | undefined;
    "no-interactive": boolean | undefined;
    "prefer-offline": boolean | undefined;
    "skip-scripts": boolean | undefined;
    to: string | undefined;
}>;
