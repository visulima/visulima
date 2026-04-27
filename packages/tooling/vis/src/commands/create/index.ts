import type { Command, CreateOptions } from "@visulima/cerebro";

const create: Command = {
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
    options: [
        { defaultValue: false, description: "Show available templates", name: "list", type: Boolean },
        { description: "Generate editor configs (vscode)", name: "editor", type: String },
        { defaultValue: false, description: "Initialize a git repository", name: "git-init", type: Boolean },
        { defaultValue: false, description: "Skip interactive prompts", name: "no-interactive", type: Boolean },
    ],
};

export default create;

export type CreateCommandOptions = CreateOptions<{
    "list": boolean | undefined;
    "editor": string | undefined;
    "git-init": boolean | undefined;
    "no-interactive": boolean | undefined;
}>;
