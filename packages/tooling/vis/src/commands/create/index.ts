import type { CreateOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const createOptionDefinitions = {
    editor: {
        description: "Generate editor configs (vscode)",
        type: String,
    },
    "git-init": {
        defaultValue: false,
        description: "Initialize a git repository",
        type: Boolean,
    },
    list: {
        defaultValue: false,
        description: "Show available templates",
        type: Boolean,
    },
    "no-interactive": {
        defaultValue: false,
        description: "Skip interactive prompts",
        type: Boolean,
    },
} as const;

const create = defineCommand({
    argument: {
        description: "Template to use (e.g., vis:app, create-vite, user/repo) — omit for interactive mode",
        name: "template",
        type: String,
    },
    description: "Create a new project from a template",
    examples: [
        ["vis create", "Interactive project scaffolding"],
        ["vis create vis:monorepo my-workspace", "Create a monorepo workspace"],
        ["vis create vis:app my-app", "Scaffold a Vite application"],
        ["vis create vis:library my-lib", "Create a TypeScript library"],
        ["vis create vite my-app -- --template react-ts", "Use create-vite with React TypeScript"],
        ["vis create user/repo my-project", "Clone a GitHub template"],
        ["vis create --list", "Show available templates"],
    ],
    group: "Scaffold & Config",
    loader: () => import("./handler"),
    name: "create",
    options: createOptionDefinitions,
});

export default create;

export type CreateCommandOptions = CreateOptions<{
    editor: string | undefined;
    "git-init": boolean | undefined;
    list: boolean | undefined;
    "no-interactive": boolean | undefined;
}>;
