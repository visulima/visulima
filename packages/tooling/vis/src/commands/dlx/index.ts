import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const dlxOptionDefinitions = {
    info: {
        description: "Always show the first-run info panel (size, security score, permissions, changelog), even for an approved package",
        type: Boolean,
    },
    "no-info": {
        defaultValue: false,
        description: "Disable the first-run info panel entirely (also via VIS_DLX_NO_INFO)",
        type: Boolean,
    },
    offline: {
        defaultValue: false,
        description: "Resolve from local store only — fail rather than fetch from the registry. Pair with `vis install` for hardened npx-style workflows.",
        type: Boolean,
    },
    package: {
        alias: "p",
        description: "Additional packages to install (repeatable)",
        multiple: true,
        type: String,
    },
    "shell-mode": {
        alias: "c",
        defaultValue: false,
        description: "Execute within shell environment",
        type: Boolean,
    },
    silent: {
        alias: "s",
        defaultValue: false,
        description: "Suppress output except command results",
        type: Boolean,
    },
    yes: {
        alias: "y",
        defaultValue: false,
        description: "Skip the first-run info panel and confirmation prompt (also via VIS_DLX_YES — note this auto-approves every package)",
        type: Boolean,
    },
} as const;

const dlx = defineCommand({
    argument: {
        description: "Package to execute (optionally with @version)",
        name: "package",
        type: String,
    },
    description: "Execute a remote package without permanent installation",
    examples: [
        ["vis dlx create-vite my-app", "Scaffold a new project"],
        ["vis dlx typescript@5.5.4 tsc --version", "Run specific version"],
        ["vis dlx -p cowsay -p lolcatjs -c 'echo hi | cowsay | lolcatjs'", "Multiple packages with shell"],
        ["vis install && vis dlx --offline typescript tsc --version", "Hardened: pre-install + offline (no registry fetch on dlx)"],
        ["vis dlx --info create-vite", "Always show the first-run panel (size, score, permissions, changelog)"],
        ["vis dlx --yes create-vite my-app", "Skip the first-run panel and confirmation"],
    ],
    group: "Run & Execute",
    loader: () => import("./handler"),
    name: "dlx",
    options: dlxOptionDefinitions,
});

export default dlx;

export type DlxOptions = InferOptions<typeof dlxOptionDefinitions>;
