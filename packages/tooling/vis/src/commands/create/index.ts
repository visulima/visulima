/**
 * `vis create` — full-featured project scaffolding command.
 *
 * Supports built-in templates (monorepo, app, library, generator),
 * remote npm create-* packages, and GitHub repository templates.
 *
 * Interactive mode guides users through template selection, naming,
 * directory choice, and post-creation setup.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import type { Command } from "@visulima/cerebro";

import { bold, cyan, dim, info, note, success, warn } from "../../output";
import { detectPm, runInstall } from "../../pm-runner";
import { discoverTemplate, inferParentDir } from "./discovery";
import { runInteractivePrompts } from "./prompts";
import { executeTemplate } from "./templates";
import { canSafelyOverwrite, isValidPackageName, resolveTargetDir, toValidPackageName } from "./utils";

// ── Post-creation helpers ─────────────────────────────────────────

const generateVscodeConfig = (projectDir: string, logger: Console): void => {
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
        success("Created .vscode/settings.json");
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
                        recommendations: [...new Set([...(existing.recommendations || []), ...defaultExtensions.recommendations])],
                    },
                    null,
                    4,
                )}\n`,
            );
            success("Merged .vscode/extensions.json");
        } catch {
            warn("Could not merge .vscode/extensions.json, skipping");
        }
    } else {
        writeFileSync(extensionsPath, `${JSON.stringify(defaultExtensions, null, 4)}\n`);
        success("Created .vscode/extensions.json");
    }
};

const generateAiInstructions = (projectDir: string): void => {
    const aiDir = join(projectDir, ".ai");

    mkdirSync(aiDir, { recursive: true });

    const instructionsPath = join(aiDir, "instructions");
    const content = `# Project Instructions

This project was scaffolded with vis create.

## Development

- Package manager: pnpm
- Build: \`pnpm build\`
- Test: \`pnpm test\`
- Lint: \`pnpm lint\`

## Conventions

- Use TypeScript strict mode
- ESM modules (\`"type": "module"\`)
- Follow Angular-style conventional commits
`;

    writeFileSync(instructionsPath, content);
    success("Created .ai/instructions");
};

const initGitRepo = (projectDir: string): void => {
    const result = spawnSync("git", ["init"], {
        cwd: projectDir,
        stdio: "pipe",
    });

    if (result.status === 0) {
        success("Initialized git repository");
    } else {
        warn("Failed to initialize git repository");
    }
};

const installDependencies = (projectDir: string, pm: { name: "bun" | "npm" | "pnpm" | "yarn"; version: string }, logger: Console): void => {
    info("Installing dependencies...");

    const code = runInstall(
        pm,
        {
            dev: false,
            filter: [],
            force: false,
            frozenLockfile: false,
            ignoreScripts: false,
            lockfileOnly: false,
            noOptional: false,
            offline: false,
        },
        projectDir,
        logger,
    );

    if (code === 0) {
        success("Dependencies installed");
    } else {
        warn("Dependency installation failed (you can run install manually)");
    }
};

// ── List templates ────────────────────────────────────────────────

const listTemplates = (aliases?: Record<string, string>): void => {
    info("");
    info("  Built-in templates:");
    info(`    ${bold(cyan("vis:monorepo"))}     ${dim("Full pnpm workspace setup")}`);
    info(`    ${bold(cyan("vis:app"))}          ${dim("Application scaffold via create-vite")}`);
    info(`    ${bold(cyan("vis:library"))}      ${dim("Reusable TypeScript library package")}`);
    info(`    ${bold(cyan("vis:generator"))}    ${dim("Code generator scaffold with bin entry")}`);

    if (aliases && Object.keys(aliases).length > 0) {
        info("");
        info("  Config aliases (vis.config.ts → create.templates):");

        for (const [name, source] of Object.entries(aliases)) {
            info(`    ${bold(cyan(name))}${" ".repeat(Math.max(1, 16 - name.length))}${dim(source)}`);
        }
    }

    info("");
    info("  Remote templates:");
    info(`    ${dim("Any npm create-* package:")}  vis create vite`);
    info(`    ${dim("GitHub repository:")}         vis create user/repo`);
    info(`    ${dim("GitLab / Bitbucket:")}        vis create gitlab:user/repo`);
    info(`    ${dim("Full URL:")}                  vis create https://github.com/user/repo`);
    info("");
    info(`  ${dim("Template args after --:")}      vis create vite -- --template react-ts`);
    info("");
};

// ── Print next steps ──────────────────────────────────────────────

const printNextSteps = (targetDir: string, cwd: string, pmName: string, depsInstalled: boolean): void => {
    const relative = resolve(cwd) === resolve(targetDir) ? "" : targetDir;

    process.stderr.write("\n");
    success("Project created successfully!");
    process.stderr.write("\n");
    note("Next steps:");

    if (relative) {
        info(`  cd ${relative}`);
    }

    if (!depsInstalled) {
        info(`  ${pmName} install`);
    }

    info(`  ${pmName} run dev`);
    process.stderr.write("\n");
};

// ── Command definition ────────────────────────────────────────────

const create: Command = {
    argument: {
        description: "Template to use (e.g., vis:app, create-vite, user/repo) — omit for interactive mode",
        name: "template",
        type: String,
    },
    description: "Create a new project from a template",
    examples: [
        ["vis create", "Interactive project scaffolding"],
        ["vis create vis:monorepo my-workspace", "Create a monorepo workspace"],
        ["vis create vis:app my-app", "Scaffold a Vite application"],
        ["vis create vis:library my-lib", "Create a TypeScript library"],
        ["vis create vite my-app -- --template react-ts", "Use create-vite with React TypeScript"],
        ["vis create user/repo my-project", "Clone a GitHub template"],
        ["vis create --list", "Show available templates"],
    ],
    execute: async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }) => {
        const args: string[] = Array.isArray(argument) ? argument : argument ? [argument] : [];
        const createConfig = visConfig?.create;

        // --list: show available templates (including config aliases)
        if (options.list) {
            listTemplates(createConfig?.templates);
            return;
        }

        const cwd = (options.cwd as string) || wsRoot || process.cwd();
        const inMonorepo = Boolean(wsRoot);
        const isTTY = Boolean(process.stdin.isTTY);
        const pm = detectPm(cwd);

        let templateInput: string | undefined;
        let projectName: string | undefined;
        let targetDir: string;
        let editor: "vscode" | undefined = createConfig?.defaultEditor;
        let gitInit = createConfig?.gitInit ?? false;
        let extraArgs: string[] = [];

        if (args.length === 0 && isTTY && !options["no-interactive"]) {
            // ── Interactive mode ──────────────────────────────────
            const answers = await runInteractivePrompts({
                cwd,
                defaultPm: pm.name,
                inMonorepo,
            });

            templateInput = answers.template;
            projectName = answers.projectName;
            targetDir = resolve(cwd, answers.targetDir);
            editor = answers.editor;
            gitInit = answers.gitInit;
        } else if (args.length === 0) {
            throw new Error("No template specified. Usage: vis create <template> [name] [-- args...]\nUse --list to see available templates, or run interactively in a terminal.");
        } else {
            // ── Non-interactive mode ─────────────────────────────
            // Split args on "--" separator — everything after it is forwarded to the template.
            const dashIndex = args.indexOf("--");
            const ownArgs = dashIndex === -1 ? args : args.slice(0, dashIndex);

            extraArgs = dashIndex === -1 ? [] : args.slice(dashIndex + 1);

            templateInput = ownArgs[0] as string;
            projectName = ownArgs[1] as string | undefined;

            if (!projectName) {
                projectName = toValidPackageName(templateInput);
            }

            editor = options.editor === "vscode" ? "vscode" : undefined;
            gitInit = Boolean(options["git-init"]);

            // Resolve target directory
            const templateType = discoverTemplate(templateInput).type;
            const parentDir = inMonorepo ? inferParentDir(templateType) : ".";
            const resolved = resolveTargetDir(projectName, resolve(cwd, parentDir));

            targetDir = resolved.targetDir;
            projectName = resolved.packageName;
        }

        // Validate
        if (!templateInput) {
            throw new Error("No template specified.");
        }

        const sanitizedName = toValidPackageName(projectName ?? "");

        if (!isValidPackageName(sanitizedName)) {
            throw new Error(`Invalid project name: "${projectName}". Must be a valid npm package name.`);
        }

        projectName = sanitizedName;

        // Guard against path traversal — target must be within cwd
        const resolvedCwd = resolve(cwd);

        if (!resolve(targetDir).startsWith(resolvedCwd)) {
            throw new Error(`Target directory "${targetDir}" is outside the working directory. Use a name without "../" path segments.`);
        }

        // Check target directory
        if (!canSafelyOverwrite(targetDir)) {
            throw new Error(
                `Target directory "${targetDir}" is not empty.\nUse a different name or clear the directory first.`,
            );
        }

        // Resolve config template aliases (e.g., "react" → "github:vitejs/vite/...")
        const resolvedInput = createConfig?.templates?.[templateInput] ?? templateInput;

        // Discover and execute template
        const config = discoverTemplate(resolvedInput, extraArgs);

        if (resolvedInput !== templateInput) {
            info(`Alias:    ${bold(cyan(templateInput))} → ${dim(resolvedInput)}`);
        }

        info(`Template: ${bold(cyan(resolvedInput))}`);
        info(`Project:  ${bold(projectName)}`);
        info(`Target:   ${dim(targetDir)}`);
        process.stderr.write("\n");

        const code = await executeTemplate(config, {
            createConfig,
            cwd,
            inMonorepo,
            logger,
            pm,
            projectName,
            targetDir,
        });

        if (code !== 0) {
            process.exitCode = code;
            return;
        }

        // ── Post-creation tasks ──────────────────────────────────

        // VS Code config
        if (editor === "vscode") {
            generateVscodeConfig(targetDir, logger);
        }

        // AI instructions
        if (existsSync(targetDir)) {
            generateAiInstructions(targetDir);
        }

        // Git init (standalone projects only)
        if (gitInit && !inMonorepo) {
            initGitRepo(targetDir);
        }

        // Install dependencies (unless disabled in config)
        let depsInstalled = false;
        const shouldInstall = createConfig?.install !== false;

        if (shouldInstall && existsSync(join(targetDir, "package.json"))) {
            installDependencies(targetDir, pm, logger);
            depsInstalled = true;
        }

        printNextSteps(targetDir, cwd, pm.name, depsInstalled);
    },
    name: "create",
    options: [
        { defaultValue: false, description: "Show available templates", name: "list", type: Boolean },
        { description: "Generate editor configs (vscode)", name: "editor", type: String },
        { defaultValue: false, description: "Initialize a git repository", name: "git-init", type: Boolean },
        { defaultValue: false, description: "Skip interactive prompts", name: "no-interactive", type: Boolean },
    ],
};

export default create;
