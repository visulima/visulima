/**
 * `vis create` — full-featured project scaffolding command.
 *
 * Supports built-in templates (monorepo, app, library, generator),
 * remote npm create-* packages, and git repository templates
 * (GitHub, GitLab, Bitbucket, Sourcehut) via giget.
 *
 * Interactive mode guides users through template selection, naming,
 * directory choice, and post-creation setup.
 */

import { spawnSync } from "node:child_process";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { ensureDirSync, isAccessibleSync, readJsonSync, writeFileSync } from "@visulima/fs";
import { isAbsolute, join, relative, resolve, sep } from "@visulima/path";

import { bold, cyan, dim, info, note, success, warn } from "../../output";
import { detectPm, runInstall } from "../../pm-runner";
import { discoverTemplate, inferParentDir } from "./discovery";
import type { CreateCommandOptions } from "./index";
import { runInteractivePrompts } from "./prompts";
import { executeTemplate } from "./templates";
import { canSafelyOverwrite, isValidPackageName, resolveTargetDir, toValidPackageName } from "./utils";

// ── Post-creation helpers ─────────────────────────────────────────

/**
 * Create or merge `.vscode/settings.json` and `.vscode/extensions.json`
 * with vis defaults (oxc formatter, format-on-save).
 *
 * If files exist, existing values take precedence over defaults.
 * Creates the `.vscode` directory if missing.
 * @param projectDir Absolute path to the scaffolded project.
 */
const generateVscodeConfig = (projectDir: string): void => {
    const vscodeDir = join(projectDir, ".vscode");

    ensureDirSync(vscodeDir);

    const settingsPath = join(vscodeDir, "settings.json");
    const defaultSettings = {
        "editor.defaultFormatter": "oxc.oxc-vscode",
        "editor.formatOnSave": true,
    };

    if (isAccessibleSync(settingsPath)) {
        try {
            const existing = readJsonSync(settingsPath) as Record<string, unknown>;

            writeFileSync(settingsPath, `${JSON.stringify({ ...defaultSettings, ...existing }, null, 4)}\n`);
            success("Merged .vscode/settings.json");
        } catch {
            warn("Could not merge .vscode/settings.json, skipping");
        }
    } else {
        writeFileSync(settingsPath, `${JSON.stringify(defaultSettings, null, 4)}\n`);
        success("Created .vscode/settings.json");
    }

    const extensionsPath = join(vscodeDir, "extensions.json");
    const defaultExtensions = { recommendations: ["oxc.oxc-vscode"] };

    if (isAccessibleSync(extensionsPath)) {
        try {
            const existing = readJsonSync(extensionsPath) as { recommendations?: string[] };

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

const generateAiInstructions = (projectDir: string, pmName: string): void => {
    const aiDir = join(projectDir, ".ai");

    ensureDirSync(aiDir);

    const instructionsPath = join(aiDir, "instructions");

    // Skip if the template already provided AI instructions
    if (isAccessibleSync(instructionsPath)) {
        return;
    }

    const content = `# Project Instructions

This project was scaffolded with vis create.

## Development

- Package manager: ${pmName}
- Build: \`${pmName} run build\`
- Test: \`${pmName} run test\`
- Lint: \`${pmName} run lint\`

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

/**
 * Install project dependencies using the detected package manager's native bindings.
 * @returns `true` if installation succeeded, `false` otherwise.
 */
const installDependencies = (
    projectDir: string,
    pm: { name: "bun" | "npm" | "pnpm" | "yarn"; version: string },
    logger: Console,
    preferOffline: boolean = false,
): boolean => {
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
            offline: preferOffline,
            prod: false,
            recursive: false,
            silent: false,
            workspaceRoot: false,
        },
        projectDir,
        logger,
    );

    if (code === 0) {
        success("Dependencies installed");

        return true;
    }

    warn("Dependency installation failed (you can run install manually)");

    return false;
};

// ── Fallback name from git URLs ───────────────────────────────────

/**
 * Extract a sensible project name from a git URL or provider string.
 * e.g., "https://github.com/user/repo" → "repo"
 *       "github:user/repo/subdir#main" → "subdir"
 *       "user/repo" → "repo"
 */
const extractRepoName = (input: string): string => {
    // Strip fragment (#branch)
    const withoutFragment = input.split("#")[0] as string;

    // Strip query params
    const withoutQuery = withoutFragment.split("?")[0] as string;

    // Strip trailing slashes and .git
    const cleaned = withoutQuery.replace(/\/+$/, "").replace(/\.git$/, "");

    // Take the last path segment
    const segments = cleaned.split("/").filter(Boolean);
    const last = segments.at(-1) ?? "";

    // Strip provider prefix (e.g., "github:" from "github:user")
    const withoutPrefix = last.includes(":") ? (last.split(":").pop() ?? last) : last;

    return toValidPackageName(withoutPrefix) || "my-project";
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

const execute = async ({ argument, logger, options, rawUnknown, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, CreateCommandOptions>): Promise<void> => {
    const args: string[] = Array.isArray(argument) ? argument : argument ? [argument] : [];
    const createConfig = visConfig?.create;

    // --list: show available templates (including config aliases)
    if (options.list) {
        listTemplates(createConfig?.templates);

        return;
    }

    const cwd = ((options as Record<string, unknown>).cwd as string | undefined) || wsRoot || process.cwd();
    const inMonorepo = Boolean(wsRoot);
    const isTTY = Boolean(process.stdin.isTTY);
    const detectedPm = detectPm(cwd);

    let templateInput: string | undefined;
    let projectName: string | undefined;
    let targetDir: string | undefined;
    let editor: "vscode" | undefined = createConfig?.defaultEditor;
    let gitInit = createConfig?.gitInit ?? false;
    let extraArgs: string[] = [];
    // Use detected PM by default; interactive mode or config can override
    let pm = detectedPm;
    // Tracks whether the user already confirmed overwriting a non-empty directory
    let userConfirmedOverwrite = false;

    if (args.length === 0 && isTTY && !options.noInteractive) {
        // ── Interactive mode ──────────────────────────────────
        const answers = await runInteractivePrompts({
            cwd,
            defaultEditor: createConfig?.defaultEditor,
            defaultGitInit: createConfig?.gitInit,
            // Only seed defaultPm when config explicitly sets it —
            // otherwise show the PM picker so the user can choose.
            defaultPm: createConfig?.defaultPm,
            inMonorepo,
        });

        templateInput = answers.template;
        projectName = answers.projectName;
        targetDir = resolve(cwd, answers.targetDir);
        editor = answers.editor ?? editor;
        gitInit = answers.gitInit;
        userConfirmedOverwrite = answers.overwrite;

        // Use the PM the user chose in interactive mode
        if (answers.pm) {
            pm = { name: answers.pm, version: detectedPm.version };
        }
    } else if (args.length === 0) {
        throw new Error(
            "No template specified. Usage: vis create <template> [name] [-- args...]\nUse --list to see available templates, or run interactively in a terminal.",
        );
    } else {
        // ── Non-interactive mode ─────────────────────────────
        // Split args on "--" separator — everything after it is
        // forwarded to the underlying create-* package. `rawUnknown`
        // is cerebro's native buffer for tokens that command-line-args
        // couldn't assign; we still fall back to `process.argv` so
        // the command works on older cerebro builds.
        let passthroughArgv: string[] = [...(rawUnknown ?? [])];

        if (passthroughArgv.length === 0) {
            const rawArgv = process.argv.slice(2);
            const argvDashIndex = rawArgv.indexOf("--");

            if (argvDashIndex !== -1) {
                passthroughArgv = rawArgv.slice(argvDashIndex + 1);
            }
        }

        const legacyDashIndex = args.indexOf("--");
        const ownArgs = legacyDashIndex === -1 ? args : args.slice(0, legacyDashIndex);
        const legacyExtras = legacyDashIndex === -1 ? [] : args.slice(legacyDashIndex + 1);

        extraArgs = [...legacyExtras, ...passthroughArgv];

        templateInput = ownArgs[0] as string;
        projectName = ownArgs[1] as string | undefined;

        if (!projectName) {
            // Extract a sensible name: "user/repo" → "repo", URL → last path segment
            projectName = extractRepoName(templateInput);
        }

        editor = options.editor === "vscode" ? "vscode" : editor;
        gitInit = Boolean(options.gitInit) || gitInit;
    }

    // Validate
    if (!templateInput) {
        throw new Error("No template specified.");
    }

    // Resolve config template aliases BEFORE discovery and parent dir inference
    const resolvedInput = createConfig?.templates?.[templateInput] ?? templateInput;

    // Discover template type from the resolved input
    const config = discoverTemplate(resolvedInput, extraArgs);

    // For non-interactive mode, resolve target directory with parent inference
    if (!targetDir) {
        const parentDir = inMonorepo ? inferParentDir(config.type) : ".";
        const resolved = resolveTargetDir(projectName, resolve(cwd, parentDir));

        targetDir = resolved.targetDir;
        projectName = resolved.packageName;
    }

    const sanitizedName = toValidPackageName(projectName ?? "");

    if (!isValidPackageName(sanitizedName)) {
        throw new Error(`Invalid project name: "${projectName}". Use lowercase alphanumeric characters and hyphens.`);
    }

    projectName = sanitizedName;

    // Guard against path traversal — target must be within or equal to cwd.
    // Uses path.relative instead of startsWith to prevent sibling-folder
    // bypass (e.g., /home/user vs /home/username).
    const resolvedTarget = resolve(targetDir);
    const rel = relative(resolve(cwd), resolvedTarget);

    if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
        throw new Error(`Target directory "${targetDir}" is outside the working directory. Use a name without "../" path segments.`);
    }

    // Check target directory (skip if the user already confirmed overwrite in interactive mode)
    if (!userConfirmedOverwrite && !canSafelyOverwrite(targetDir)) {
        throw new Error(`Target directory "${targetDir}" is not empty.\nUse a different name or clear the directory first.`);
    }

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
        generateVscodeConfig(targetDir);
    }

    // AI instructions
    if (isAccessibleSync(targetDir)) {
        generateAiInstructions(targetDir, pm.name);
    }

    // Git init (standalone projects only)
    if (gitInit && !inMonorepo) {
        initGitRepo(targetDir);
    }

    // Install dependencies (unless disabled in config)
    let depsInstalled = false;
    const shouldInstall = createConfig?.install !== false;

    if (shouldInstall && isAccessibleSync(join(targetDir, "package.json"))) {
        depsInstalled = installDependencies(targetDir, pm, logger, createConfig?.preferOffline);
    }

    printNextSteps(targetDir, cwd, pm.name, depsInstalled);
};

export default execute as CommandExecute<Toolbox>;
