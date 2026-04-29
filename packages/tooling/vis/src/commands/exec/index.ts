import type { Command, CreateOptions } from "@visulima/cerebro";

const exec: Command = {
    argument: {
        description: "Command to execute followed by arguments",
        name: "command",
        type: String,
    },
    description: "Execute a local node_modules/.bin command (no remote fallback)",
    examples: [
        ["vis exec eslint .", "Run local eslint"],
        ["vis exec tsc --noEmit", "Run local TypeScript check"],
        ["vis exec -r -- eslint .", "Run in all workspace packages"],
        ["vis exec -c 'echo $PATH'", "Shell mode"],
    ],
    group: "Run & Execute",
    loader: () => import("./handler"),
    name: "exec",
    options: [
        { alias: "c", defaultValue: false, description: "Execute within shell environment", name: "shell-mode", type: Boolean },
        { alias: "r", defaultValue: false, description: "Run in every workspace package", name: "recursive", type: Boolean },
        { alias: "w", defaultValue: false, description: "Run on workspace root only", name: "workspace-root", type: Boolean },
        { alias: "F", description: "Filter packages by name pattern", multiple: true, name: "filter", type: String },
        { defaultValue: false, description: "Run concurrently without topological ordering", name: "parallel", type: Boolean },
        { defaultValue: false, description: "Reverse topological execution order", name: "reverse", type: Boolean },
    ],
};

export default exec;

export type ExecOptions = CreateOptions<{
    "shell-mode": boolean | undefined;
    "recursive": boolean | undefined;
    "workspace-root": boolean | undefined;
    "filter": string[] | undefined;
    "parallel": boolean | undefined;
    "reverse": boolean | undefined;
}>;
