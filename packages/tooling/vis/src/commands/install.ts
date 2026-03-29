import type { Command } from "@visulima/cerebro";

import { loadNativeBindings } from "../native-binding";
import { detectPm, runInteractive } from "../pm-runner";

const install: Command = {
    alias: "i",
    description: "Install dependencies using the detected package manager",
    examples: [
        ["vis install", "Install all dependencies"],
        ["vis i --frozen-lockfile", "Install with frozen lockfile (CI mode)"],
        ["vis install --prod", "Install production dependencies only"],
        ["vis install --filter app", "Install for specific workspace package"],
        ["vis install --ignore-scripts", "Install without running lifecycle scripts"],
    ],
    execute: async ({ logger, options, workspaceRoot: wsRoot }) => {
        const cwd = (options.cwd as string) ?? wsRoot ?? process.cwd();
        const pm = detectPm(cwd);
        const native = loadNativeBindings();

        if (!native) {
            throw new Error("Native bindings not available. Rebuild with: napi build --platform --release --manifest-path native/Cargo.toml --output-dir .");
        }

        const resolved = native.resolveInstall(pm.name, pm.version, {
            dev: (options.dev as boolean) || false,
            filter: options.filter ? [].concat(options.filter as never) : [],
            force: (options.force as boolean) || false,
            frozenLockfile: (options["frozen-lockfile"] as boolean) || false,
            ignoreScripts: (options["ignore-scripts"] as boolean) || false,
            lockfileOnly: (options["lockfile-only"] as boolean) || false,
            noOptional: (options["no-optional"] as boolean) || false,
            offline: (options.offline as boolean) || false,
            prod: (options.prod as boolean) || false,
            recursive: (options.recursive as boolean) || false,
            silent: (options.silent as boolean) || false,
            workspaceRoot: (options["workspace-root"] as boolean) || false,
        });

        const code = runInteractive(resolved, cwd, logger);

        if (code !== 0) {
            process.exitCode = code;
        }
    },
    name: "install",
    options: [
        { alias: "P", defaultValue: false, description: "Skip devDependencies", name: "prod", type: Boolean },
        { alias: "D", defaultValue: false, description: "Install devDependencies only", name: "dev", type: Boolean },
        { defaultValue: false, description: "Use frozen lockfile (CI mode, maps to npm ci)", name: "frozen-lockfile", type: Boolean },
        { alias: "f", defaultValue: false, description: "Force reinstall all dependencies", name: "force", type: Boolean },
        { defaultValue: false, description: "Skip lifecycle scripts", name: "ignore-scripts", type: Boolean },
        { defaultValue: false, description: "Update lockfile without installing", name: "lockfile-only", type: Boolean },
        { defaultValue: false, description: "Skip optional dependencies", name: "no-optional", type: Boolean },
        { defaultValue: false, description: "Use only cached packages", name: "offline", type: Boolean },
        { alias: "s", defaultValue: false, description: "Suppress output", name: "silent", type: Boolean },
        { alias: "r", defaultValue: false, description: "Install in all workspace packages", name: "recursive", type: Boolean },
        { alias: "w", defaultValue: false, description: "Target workspace root", name: "workspace-root", type: Boolean },
        { alias: "F", description: "Filter by workspace package name", multiple: true, name: "filter", type: String },
    ],
};

export default install;
