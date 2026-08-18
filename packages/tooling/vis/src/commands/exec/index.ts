import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const execOptionDefinitions = {
    filter: {
        alias: "F",
        description: "Filter packages by name pattern",
        multiple: true,
        type: String,
    },
    parallel: {
        defaultValue: false,
        description: "Run concurrently without topological ordering",
        type: Boolean,
    },
    recursive: {
        alias: "r",
        defaultValue: false,
        description: "Run in every workspace package",
        type: Boolean,
    },
    reverse: {
        defaultValue: false,
        description: "Reverse topological execution order",
        type: Boolean,
    },
    "shell-mode": {
        alias: "c",
        defaultValue: false,
        description: "Execute within shell environment",
        type: Boolean,
    },
    "workspace-root": {
        alias: "w",
        defaultValue: false,
        description: "Run on workspace root only",
        type: Boolean,
    },
} as const;

const exec = defineCommand({
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
    options: execOptionDefinitions,
});

export default exec;

export type ExecOptions = InferOptions<typeof execOptionDefinitions>;
