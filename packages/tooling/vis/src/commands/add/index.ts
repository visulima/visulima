import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const addOptionDefinitions = {
    "auto-install-peers": {
        defaultValue: false,
        description:
                "After adding, recursively install non-optional peer dependencies that aren't already in the workspace (matches nypm's installPeerDependencies)",
        type: Boolean,
    },
    exact: {
        alias: "E",
        defaultValue: false,
        description: "Save exact version",
        type: Boolean,
    },
    filter: {
        alias: "F",
        description: "Filter by workspace package name",
        multiple: true,
        type: String,
    },
    global: {
        alias: "g",
        defaultValue: false,
        description: "Install globally (uses npm)",
        type: Boolean,
    },
    "no-marshall-check": {
        defaultValue: false,
        description: "Skip the offline marshall pipeline (author, provenance, metadata, downloads, expired-domains, new-bin, signatures, archived-repo)",
        type: Boolean,
    },
    "no-socket-check": {
        defaultValue: false,
        description: "Skip Socket.dev security check before adding",
        type: Boolean,
    },
    "no-typosquat-check": {
        defaultValue: false,
        description: "Skip typosquat name check before adding",
        type: Boolean,
    },
    "run-scripts": {
        defaultValue: false,
        description:
                "Run lifecycle scripts during add (opts out of vis's default block-by-default policy; allowlisted packages run via security.policies.installScripts.allow)",
        type: Boolean,
    },
    "save-dev": {
        alias: "D",
        defaultValue: false,
        description: "Add as dev dependency",
        type: Boolean,
    },
    "save-optional": {
        alias: "O",
        defaultValue: false,
        description: "Add as optional dependency",
        type: Boolean,
    },
    "save-peer": {
        alias: "P",
        defaultValue: false,
        description: "Add as peer dependency",
        type: Boolean,
    },
    to: {
        description: "Target a single workspace package and auto-conform the version to existing catalogs / sibling deps (syncpack#285)",
        type: String,
    },
    workspace: {
        defaultValue: false,
        description: "Use workspace protocol (pnpm)",
        type: Boolean,
    },
    "workspace-root": {
        alias: "w",
        defaultValue: false,
        description: "Add to workspace root",
        type: Boolean,
    },
} as const;

const add = defineCommand({
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
        ["vis add lodash --no-marshall-check", "Skip the offline marshall pipeline (author, downloads, etc.)"],
        ["vis add lodash --run-scripts", "Run lifecycle scripts (opts out of vis's default block-by-default policy)"],
    ],
    group: "Dependencies",
    loader: () => import("./handler"),
    name: "add",
    options: addOptionDefinitions,
});

export default add;

export type AddOptions = InferOptions<typeof addOptionDefinitions>;
