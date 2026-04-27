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
    ],
    group: "Run & Execute",
    loader: () => import("./handler"),
    name: "dlx",
    options: [
        { alias: "p", description: "Additional packages to install (repeatable)", multiple: true, name: "package", type: String },
        { alias: "c", defaultValue: false, description: "Execute within shell environment", name: "shell-mode", type: Boolean },
        { alias: "s", defaultValue: false, description: "Suppress output except command results", name: "silent", type: Boolean },
    ],
};

export default dlx;

export type DlxOptions = CreateOptions<{
    "package": string[] | undefined;
    "shell-mode": boolean | undefined;
    "silent": boolean | undefined;
}>;
