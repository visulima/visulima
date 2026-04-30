import type { Command, CreateOptions } from "@visulima/cerebro";

const devcontainer: Command = {
    alias: "dc",
    description: "Create or update .devcontainer/devcontainer.json interactively",
    examples: [
        ["vis devcontainer", "Launch interactive devcontainer config editor"],
        ["vis dc", "Alias for devcontainer"],
        ["vis devcontainer --template node-pnpm", "Start from Node.js + pnpm template"],
    ],
    group: "Scaffold & Config",
    loader: () => import("./handler"),
    name: "devcontainer",
    options: [
        {
            alias: "t",
            description: "Start from a template: node, node-pnpm, node-postgres, node-dind, fullstack, python, go, rust, java, devops, minimal, custom",
            name: "template",
            type: String,
        },
        {
            alias: "o",
            description: "Output path (default: .devcontainer/devcontainer.json)",
            name: "output",
            type: String,
        },
    ],
};

export default devcontainer;

export type DevcontainerOptions = CreateOptions<{
    output: string | undefined;
    template: string | undefined;
}>;
