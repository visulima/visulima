/**
 * `vis generate &lt;template>` — in-repo scaffolding command.
 *
 * Discovers templates from `.vis/templates/`, `.moon/templates/`, and
 * `vis.config.ts` `generator.templates`, then runs the selected
 * template through prompts → produce → write.
 */

import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const generateOptionDefinitions = {
    defaults: {
        defaultValue: false,
        description: "Skip prompts; use template defaults",
        type: Boolean,
    },
    describe: {
        defaultValue: false,
        description: "Print template metadata (about, destination, variables) without running produce",
        type: Boolean,
    },
    "dry-run": {
        defaultValue: false,
        description: "Print planned writes without touching disk",
        type: Boolean,
    },
    force: {
        defaultValue: false,
        description: "Overwrite existing files without prompting",
        type: Boolean,
    },
    json: {
        defaultValue: false,
        description: "Emit JSON output (with --list or --describe)",
        type: Boolean,
    },
    list: {
        defaultValue: false,
        description: "List discovered templates",
        type: Boolean,
    },
    "no-interactive": {
        defaultValue: false,
        description: "Skip interactive prompts (errors on missing required values)",
        type: Boolean,
    },
    "prefer-offline": {
        defaultValue: false,
        description: "Prefer locally cached remote templates over re-downloading",
        type: Boolean,
    },
    "skip-scripts": {
        defaultValue: false,
        description: "Skip running post-generation scripts",
        type: Boolean,
    },
    to: {
        description: "Destination directory",
        type: String,
    },
} as const;

const generate = defineCommand({
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
    options: generateOptionDefinitions,
});

export default generate;

export type GenerateOptions = InferOptions<typeof generateOptionDefinitions>;
