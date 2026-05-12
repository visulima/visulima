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
        ["vis add react --to web", "Add to one package, auto-conforming the version to existing catalogs / sibling deps"],
        ["vis add -g typescript", "Add globally (uses npm)"],
        ["vis add lodash -w", "Add to workspace root"],
        ["vis add lodash --no-socket-check", "Add without Socket.dev check"],
        ["vis add lodash --no-typosquat-check", "Skip typosquat name check"],
        ["vis add lodash --run-scripts", "Run lifecycle scripts (opts out of vis's default block-by-default policy)"],
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
        {
            description: "Target a single workspace package and auto-conform the version to existing catalogs / sibling deps (syncpack#285)",
            name: "to",
            type: String,
        },
        { defaultValue: false, description: "Skip typosquat name check before adding", name: "no-typosquat-check", type: Boolean },
        { defaultValue: false, description: "Skip Socket.dev security check before adding", name: "no-socket-check", type: Boolean },
        {
            defaultValue: false,
            description:
                "Run lifecycle scripts during add (opts out of vis's default block-by-default policy; allowlisted packages run via security.policies.install_scripts.allow)",
            name: "run-scripts",
            type: Boolean,
        },
        {
            defaultValue: false,
            description:
                "After adding, recursively install non-optional peer dependencies that aren't already in the workspace (matches nypm's installPeerDependencies)",
            name: "auto-install-peers",
            type: Boolean,
        },
    ],
};

export default add;

export type AddOptions = CreateOptions<{
    "auto-install-peers": boolean | undefined;
    exact: boolean | undefined;
    filter: string[] | undefined;
    global: boolean | undefined;
    "no-socket-check": boolean | undefined;
    "no-typosquat-check": boolean | undefined;
    "run-scripts": boolean | undefined;
    "save-dev": boolean | undefined;
    "save-optional": boolean | undefined;
    "save-peer": boolean | undefined;
    to: string | undefined;
    workspace: boolean | undefined;
    "workspace-root": boolean | undefined;
}>;
