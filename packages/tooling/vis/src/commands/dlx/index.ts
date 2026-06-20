import type { Command, CreateOptions } from "@visulima/cerebro";

const dlx: Command = {
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
    options: [
        { alias: "p", description: "Additional packages to install (repeatable)", multiple: true, name: "package", type: String },
        { alias: "c", defaultValue: false, description: "Execute within shell environment", name: "shell-mode", type: Boolean },
        { alias: "s", defaultValue: false, description: "Suppress output except command results", name: "silent", type: Boolean },
        {
            defaultValue: false,
            description: "Resolve from local store only — fail rather than fetch from the registry. Pair with `vis install` for hardened npx-style workflows.",
            name: "offline",
            type: Boolean,
        },
        {
            alias: "y",
            defaultValue: false,
            description: "Skip the first-run info panel and confirmation prompt (also via VIS_DLX_YES — note this auto-approves every package)",
            name: "yes",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Always show the first-run info panel (size, security score, permissions, changelog), even for an approved package",
            name: "info",
            type: Boolean,
        },
        { defaultValue: false, description: "Disable the first-run info panel entirely (also via VIS_DLX_NO_INFO)", name: "no-info", type: Boolean },
    ],
};

export default dlx;

export type DlxOptions = CreateOptions<{
    info: boolean | undefined;
    "no-info": boolean | undefined;
    offline: boolean | undefined;
    package: string[] | undefined;
    "shell-mode": boolean | undefined;
    silent: boolean | undefined;
    yes: boolean | undefined;
}>;
