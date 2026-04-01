import type { Command } from "@visulima/cerebro";

import { detectPm, runDlx } from "../pm-runner";

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
        ["vis create --list", "Show available templates"],
    ],
    execute: async ({ argument, logger, options, workspaceRoot: wsRoot }) => {
        const args = argument;

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
        const cwd = wsRoot ?? process.cwd();
        const pm = detectPm(cwd);

        const code = runDlx(
            pm,
            {
                additionalPackages: [],
                args: rest,
                package: template as string,
                shellMode: false,
                silent: false,
            },
            cwd,
            logger,
        );

        if (code !== 0) {
            process.exitCode = code;

            return;
        }

        // Post-creation: generate editor configs if requested
        if (options.editor === "vscode") {
            // Determine the created project directory from the template args
            const projectDir = rest[0] ? (await import("node:path")).resolve(cwd, rest[0]) : cwd;

            await generateVscodeConfig(projectDir, logger);
        }
    },
    name: "create",
    options: [
        { defaultValue: false, description: "Show available templates", name: "list", type: Boolean },
        { description: "Generate editor configs (vscode)", name: "editor", type: String },
    ],
};

async function generateVscodeConfig(projectDir: string, logger: Console): Promise<void> {
    const { existsSync, mkdirSync, readFileSync, writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    const vscodeDir = join(projectDir, ".vscode");

    if (!existsSync(vscodeDir)) {
        mkdirSync(vscodeDir, { recursive: true });
    }

    const settingsPath = join(vscodeDir, "settings.json");
    const defaultSettings = {
        "editor.defaultFormatter": "oxc.oxc-vscode",
        "editor.formatOnSave": true,
    };

    if (existsSync(settingsPath)) {
        try {
            const existing = JSON.parse(readFileSync(settingsPath, "utf8"));

            writeFileSync(settingsPath, `${JSON.stringify({ ...defaultSettings, ...existing }, null, 4)}\n`);
            logger.info("Merged .vscode/settings.json");
        } catch {
            logger.warn("Could not merge .vscode/settings.json, skipping");
        }
    } else {
        writeFileSync(settingsPath, `${JSON.stringify(defaultSettings, null, 4)}\n`);
        logger.info("Created .vscode/settings.json");
    }

    const extensionsPath = join(vscodeDir, "extensions.json");
    const defaultExtensions = { recommendations: ["oxc.oxc-vscode"] };

    if (existsSync(extensionsPath)) {
        try {
            const existing = JSON.parse(readFileSync(extensionsPath, "utf8"));

            writeFileSync(
                extensionsPath,
                `${JSON.stringify(
                    {
                        ...existing,
                        recommendations: [...new Set([...existing.recommendations || [], ...defaultExtensions.recommendations])],
                    },
                    null,
                    4,
                )}\n`,
            );
            logger.info("Merged .vscode/extensions.json");
        } catch {
            logger.warn("Could not merge .vscode/extensions.json, skipping");
        }
    } else {
        writeFileSync(extensionsPath, `${JSON.stringify(defaultExtensions, null, 4)}\n`);
        logger.info("Created .vscode/extensions.json");
    }
}

export default create;
