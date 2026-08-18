import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const installOptionDefinitions = {
    ci: {
        defaultValue: false,
        description: "Clean install: wipe node_modules then install with frozen lockfile",
        type: Boolean,
    },
    dev: {
        alias: "D",
        conflicts: "prod",
        description: "Install devDependencies only (no positional args) / add as dev (with positional args, npm-style)",
        type: Boolean,
    },
    exact: {
        alias: "E",
        defaultValue: false,
        description: "Save exact version (only with positional args; mirrors `npm install -E`)",
        type: Boolean,
    },
    filter: {
        alias: "F",
        description: "Filter by workspace package name",
        multiple: true,
        type: String,
    },
    force: {
        alias: "f",
        defaultValue: false,
        description: "Force reinstall all dependencies",
        type: Boolean,
    },
    "frozen-lockfile": {
        defaultValue: false,
        description: "Use frozen lockfile (CI mode, maps to npm ci)",
        type: Boolean,
    },
    installer: {
        description: "Pick the installer explicitly. One of: auto, aube, pnpm, npm, yarn, bun. Overrides VIS_INSTALLER and install.backend in vis.config.",
        type: String,
    },
    "lockfile-only": {
        defaultValue: false,
        description: "Update lockfile without installing",
        type: Boolean,
    },
    "no-aube": {
        defaultValue: false,
        description: "Skip aube and use the lockfile-detected PM. Wins over --installer / VIS_INSTALLER / install.backend.",
        type: Boolean,
    },
    "no-frozen-lockfile": {
        defaultValue: false,
        description: "Opt out of vis's default frozen-lockfile behavior and allow lockfile updates",
        type: Boolean,
    },
    "no-marshall-check": {
        defaultValue: false,
        description: "Skip the offline marshall pipeline (only with positional args; mirrors `vis add --no-marshall-check`)",
        type: Boolean,
    },
    "no-optional": {
        defaultValue: false,
        description: "Skip optional dependencies",
        type: Boolean,
    },
    "no-socket-check": {
        defaultValue: false,
        description: "Skip Socket.dev security check (only with positional args; mirrors `vis add --no-socket-check`)",
        type: Boolean,
    },
    "no-typosquat-check": {
        defaultValue: false,
        description: "Skip typosquat name check",
        type: Boolean,
    },
    offline: {
        defaultValue: false,
        description: "Use only cached packages",
        type: Boolean,
    },
    "prefer-offline": {
        defaultValue: false,
        description: "Prefer cached packages, fall back to network when missing",
        type: Boolean,
    },
    prod: {
        alias: "P",
        conflicts: "dev",
        description: "Skip devDependencies (no positional args) / add as peer (with positional args, npm-style)",
        type: Boolean,
    },
    recursive: {
        alias: "r",
        defaultValue: false,
        description: "Install in all workspace packages",
        type: Boolean,
    },
    "run-scripts": {
        defaultValue: false,
        description:
                "Run lifecycle scripts (opts out of vis's default block-by-default policy; allowlisted packages run via security.policies.installScripts.allow)",
        type: Boolean,
    },
    "save-optional": {
        defaultValue: false,
        description: "Add as optional dependency (only with positional args; mirrors `npm install -O`)",
        type: Boolean,
    },
    silent: {
        alias: "s",
        defaultValue: false,
        description: "Suppress output",
        type: Boolean,
    },
    "workspace-root": {
        alias: "w",
        defaultValue: false,
        description: "Target workspace root",
        type: Boolean,
    },
} as const;

const install = defineCommand({
    alias: "i",
    argument: {
        description: "Optional package names. When provided, delegates to `vis add` (enables npm-style `alias npm='vis install'` wrappers).",
        name: "packages",
        type: String,
    },
    description: "Install dependencies using the detected package manager",
    examples: [
        ["vis install", "Install all dependencies (frozen-lockfile by default when a lockfile is present)"],
        ["vis install react react-dom", "Delegates to `vis add` — enables shell aliases like `alias npm='vis install'`"],
        ["vis i --no-frozen-lockfile", "Allow lockfile updates (escape hatch for the default)"],
        ["vis install --ci", "Clean install: wipe node_modules + frozen lockfile (mirrors npm ci / pnpm ci)"],
        ["vis install --prefer-offline", "Use cached packages when available, fall back to network"],
        ["vis install --prod", "Install production dependencies only"],
        ["vis install --filter app", "Install for specific workspace package"],
        [
            "vis install --run-scripts",
            "Run lifecycle scripts (opts out of vis's default block-by-default policy; allowlisted packages run via security.policies.installScripts.allow)",
        ],
        ["vis install --no-typosquat-check", "Skip typosquat name check"],
        ["vis install --installer aube", "Force aube as the installer (errors if not on PATH)"],
        ["vis install --no-aube", "Bypass aube; use the lockfile-detected PM"],
    ],
    group: "Dependencies",
    loader: () => import("./handler"),
    name: "install",
    options: installOptionDefinitions,
});

export default install;

export type InstallOptions = InferOptions<typeof installOptionDefinitions>;
