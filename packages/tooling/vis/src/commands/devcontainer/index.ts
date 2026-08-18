import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const devcontainerOptionDefinitions = {
    output: {
        alias: "o",
        description: "Output path (default: .devcontainer/devcontainer.json)",
        type: String,
    },
    template: {
        alias: "t",
        description: "Start from a template: node, node-pnpm, node-postgres, node-dind, fullstack, python, go, rust, java, devops, minimal, custom",
        type: String,
    },
} as const;

const devcontainer = defineCommand({
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
    options: devcontainerOptionDefinitions,
});

export default devcontainer;

export type DevcontainerOptions = InferOptions<typeof devcontainerOptionDefinitions>;
