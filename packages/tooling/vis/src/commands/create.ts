import { spawnSync } from "node:child_process";

import type { Command } from "@visulima/cerebro";

import { detectPm, runInteractive } from "../pm-runner";
import { loadNativeBindings } from "../native-binding";

const create: Command = {
    argument: {
        description: "Template or generator to use (e.g., create-vite, @company/generator)",
        name: "template",
        type: String,
    },
    description: "Create a new project from a template using dlx",
    examples: [
        ["vis create create-vite my-app", "Create a Vite project"],
        ["vis create create-vite -- --template react-ts", "With template options after --"],
        ["vis create create-next-app my-app", "Create a Next.js project"],
        ["vis create @company/generator -- --name my-lib", "Use custom generator"],
        ["vis create --list", "Show available templates"],
        ["vis create --dry-run create-vite my-app", "Preview without writing"],
    ],
    execute: async ({ argument, logger, options, workspaceRoot: wsRoot }) => {
        const args = argument as string[];

        if (options.list) {
            logger.info("Built-in templates:");
            logger.info("  create-vite         - Vite application scaffold");
            logger.info("  create-next-app     - Next.js application");
            logger.info("  create-vue          - Vue.js application");
            logger.info("  create-svelte       - SvelteKit application");
            logger.info("  create-astro        - Astro application");
            logger.info("\nUse any npm create-* package: vis create <package> [args...]");

            return;
        }

        if (!args || args.length === 0) {
            throw new Error("No template specified. Usage: vis create <template> [args...]\nUse --list to see available templates.");
        }

        const [template, ...rest] = args;
        const cwd = (options.cwd as string) ?? wsRoot ?? process.cwd();
        const pm = detectPm(cwd);
        const native = loadNativeBindings();

        if (!native) {
            throw new Error("Native bindings not available.");
        }

        // Use dlx to execute the template
        const resolved = native.resolveDlx(pm.name, pm.version, {
            additionalPackages: [],
            args: rest,
            package: template as string,
            shellMode: false,
            silent: false,
        });

        if (options["dry-run"]) {
            logger.info(`Would run: ${resolved.bin} ${resolved.args.join(" ")}`);

            return;
        }

        const code = runInteractive(resolved, cwd, logger);

        if (code !== 0) {
            process.exitCode = code;

            return;
        }

        // Post-creation: generate editor configs if requested
        if (options.editor === "vscode") {
            await generateVscodeConfig(cwd, logger);
        }
    },
    name: "create",
    options: [
        { defaultValue: false, description: "Show available templates", name: "list", type: Boolean },
        { defaultValue: false, description: "Preview without writing", name: "dry-run", type: Boolean },
        { description: "Generate editor configs (vscode)", name: "editor", type: String },
        { defaultValue: false, description: "Skip auto-migration", name: "no-migrate", type: Boolean },
        { description: "Target directory for monorepo", name: "directory", type: String },
    ],
};

async function generateVscodeConfig(cwd: string, logger: Console): Promise<void> {
    const { existsSync, mkdirSync, writeFileSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    const vscodeDir = join(cwd, ".vscode");

    if (!existsSync(vscodeDir)) {
        mkdirSync(vscodeDir, { recursive: true });
    }

    // settings.json
    const settingsPath = join(vscodeDir, "settings.json");
    const defaultSettings = {
        "editor.defaultFormatter": "oxc.oxc-vscode",
        "editor.formatOnSave": true,
    };

    if (existsSync(settingsPath)) {
        try {
            const existing = JSON.parse(readFileSync(settingsPath, "utf8"));
            const merged = { ...defaultSettings, ...existing };

            writeFileSync(settingsPath, JSON.stringify(merged, null, 4) + "\n");
            logger.info("Merged .vscode/settings.json");
        } catch {
            logger.warn("Could not merge .vscode/settings.json, skipping");
        }
    } else {
        writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 4) + "\n");
        logger.info("Created .vscode/settings.json");
    }

    // extensions.json
    const extensionsPath = join(vscodeDir, "extensions.json");
    const defaultExtensions = {
        recommendations: ["oxc.oxc-vscode"],
    };

    if (existsSync(extensionsPath)) {
        try {
            const existing = JSON.parse(readFileSync(extensionsPath, "utf8"));
            const merged = {
                ...existing,
                recommendations: [...new Set([...(existing.recommendations || []), ...defaultExtensions.recommendations])],
            };

            writeFileSync(extensionsPath, JSON.stringify(merged, null, 4) + "\n");
            logger.info("Merged .vscode/extensions.json");
        } catch {
            logger.warn("Could not merge .vscode/extensions.json, skipping");
        }
    } else {
        writeFileSync(extensionsPath, JSON.stringify(defaultExtensions, null, 4) + "\n");
        logger.info("Created .vscode/extensions.json");
    }
}

export default create;
