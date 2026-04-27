import type { Command, CreateOptions } from "@visulima/cerebro";

const add: Command = {
    argument: {
        description: "Packages to add (e.g., react react-dom)",
        name: "packages",
        type: String,
    },
    description: "Add packages using the detected package manager",
    examples: [
        ["vis add react react-dom", "Add packages"],
        ["vis add -D typescript @types/react", "Add as dev dependencies"],
        ["vis add react --filter app", "Add to specific workspace package"],
        ["vis add -g typescript", "Add globally (uses npm)"],
        ["vis add lodash -w", "Add to workspace root"],
        ["vis add lodash --no-socket-check", "Add without Socket.dev check"],
        ["vis add lodash --no-typosquat-check", "Skip typosquat name check"],
    ],
    group: "Dependencies",
    loader: () => import("./handler"),
    name: "add",
    options: [
        { alias: "D", defaultValue: false, description: "Add as dev dependency", name: "save-dev", type: Boolean },
        { alias: "E", defaultValue: false, description: "Save exact version", name: "exact", type: Boolean },
        { alias: "P", defaultValue: false, description: "Add as peer dependency", name: "save-peer", type: Boolean },
        { alias: "O", defaultValue: false, description: "Add as optional dependency", name: "save-optional", type: Boolean },
        { alias: "g", defaultValue: false, description: "Install globally (uses npm)", name: "global", type: Boolean },
        { alias: "w", defaultValue: false, description: "Add to workspace root", name: "workspace-root", type: Boolean },
        { defaultValue: false, description: "Use workspace protocol (pnpm)", name: "workspace", type: Boolean },
        { alias: "F", description: "Filter by workspace package name", multiple: true, name: "filter", type: String },
        { defaultValue: false, description: "Skip typosquat name check before adding", name: "no-typosquat-check", type: Boolean },
        { defaultValue: false, description: "Skip Socket.dev security check before adding", name: "no-socket-check", type: Boolean },
    ],
};

export default add;

export type AddOptions = CreateOptions<{
    "save-dev": boolean | undefined;
    "exact": boolean | undefined;
    "save-peer": boolean | undefined;
    "save-optional": boolean | undefined;
    "global": boolean | undefined;
    "workspace-root": boolean | undefined;
    "workspace": boolean | undefined;
    "filter": string[] | undefined;
    "no-typosquat-check": boolean | undefined;
    "no-socket-check": boolean | undefined;
}>;
