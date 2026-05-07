import type { Command, CreateOptions } from "@visulima/cerebro";

const install: Command = {
    alias: "i",
    description: "Install dependencies using the detected package manager",
    examples: [
        ["vis install", "Install all dependencies (frozen-lockfile by default when a lockfile is present)"],
        ["vis i --no-frozen-lockfile", "Allow lockfile updates (escape hatch for the default)"],
        ["vis install --ci", "Clean install: wipe node_modules + frozen lockfile (mirrors npm ci / pnpm ci)"],
        ["vis install --prefer-offline", "Use cached packages when available, fall back to network"],
        ["vis install --prod", "Install production dependencies only"],
        ["vis install --filter app", "Install for specific workspace package"],
        [
            "vis install --run-scripts",
            "Run lifecycle scripts (opts out of vis's default block-by-default policy; allowlisted packages run via security.allowBuilds)",
        ],
        ["vis install --no-typosquat-check", "Skip typosquat name check"],
        ["vis install --installer aube", "Force aube as the installer (errors if not on PATH)"],
        ["vis install --no-aube", "Bypass aube; use the lockfile-detected PM"],
    ],
    group: "Dependencies",
    loader: () => import("./handler"),
    name: "install",
    options: [
        { alias: "P", conflicts: "dev", description: "Skip devDependencies", name: "prod", type: Boolean },
        { alias: "D", conflicts: "prod", description: "Install devDependencies only", name: "dev", type: Boolean },
        { defaultValue: false, description: "Use frozen lockfile (CI mode, maps to npm ci)", name: "frozen-lockfile", type: Boolean },
        {
            defaultValue: false,
            description: "Opt out of vis's default frozen-lockfile behavior and allow lockfile updates",
            name: "no-frozen-lockfile",
            type: Boolean,
        },
        { defaultValue: false, description: "Clean install: wipe node_modules then install with frozen lockfile", name: "ci", type: Boolean },
        { alias: "f", defaultValue: false, description: "Force reinstall all dependencies", name: "force", type: Boolean },
        {
            defaultValue: false,
            description: "Run lifecycle scripts (opts out of vis's default block-by-default policy; allowlisted packages run via security.allowBuilds)",
            name: "run-scripts",
            type: Boolean,
        },
        { defaultValue: false, description: "Update lockfile without installing", name: "lockfile-only", type: Boolean },
        { defaultValue: false, description: "Skip optional dependencies", name: "no-optional", type: Boolean },
        { defaultValue: false, description: "Use only cached packages", name: "offline", type: Boolean },
        { defaultValue: false, description: "Prefer cached packages, fall back to network when missing", name: "prefer-offline", type: Boolean },
        { alias: "s", defaultValue: false, description: "Suppress output", name: "silent", type: Boolean },
        { alias: "r", defaultValue: false, description: "Install in all workspace packages", name: "recursive", type: Boolean },
        { alias: "w", defaultValue: false, description: "Target workspace root", name: "workspace-root", type: Boolean },
        { alias: "F", description: "Filter by workspace package name", multiple: true, name: "filter", type: String },
        { defaultValue: false, description: "Skip typosquat name check", name: "no-typosquat-check", type: Boolean },
        {
            description: "Pick the installer explicitly. One of: auto, aube, pnpm, npm, yarn, bun. Overrides VIS_INSTALLER and install.backend in vis.config.",
            name: "installer",
            type: String,
        },
        {
            defaultValue: false,
            description: "Skip aube and use the lockfile-detected PM. Wins over --installer / VIS_INSTALLER / install.backend.",
            name: "no-aube",
            type: Boolean,
        },
    ],
};

export default install;

export type InstallOptions = CreateOptions<{
    ci: boolean | undefined;
    dev: boolean | undefined;
    filter: string[] | undefined;
    force: boolean | undefined;
    "frozen-lockfile": boolean | undefined;
    installer: string | undefined;
    "lockfile-only": boolean | undefined;
    "no-aube": boolean | undefined;
    "no-frozen-lockfile": boolean | undefined;
    "no-optional": boolean | undefined;
    "no-typosquat-check": boolean | undefined;
    offline: boolean | undefined;
    "prefer-offline": boolean | undefined;
    prod: boolean | undefined;
    recursive: boolean | undefined;
    "run-scripts": boolean | undefined;
    silent: boolean | undefined;
    "workspace-root": boolean | undefined;
}>;
