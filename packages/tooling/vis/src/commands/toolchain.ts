import { spawnSync } from "node:child_process";

import type { Command } from "@visulima/cerebro";
import { dim, green, red, yellow } from "@visulima/colorize";

import { error as errorOutput, info, note, success, warn } from "../output";
import {
    buildInstallInvocation,
    buildUseInvocation,
    findInstalledManagers,
    getToolchainStatus,
    parseUseArgument,
    resolveManagerFor,
    resolveToolBinary,
    type DetectedManager,
    type ResolvedManager,
    type RuntimeTool,
    type ToolchainConfig,
    type ToolchainStatus,
    type ToolStatus,
} from "../toolchain";

const KNOWN_TOOLS: readonly RuntimeTool[] = ["bun", "deno", "go", "node", "npm", "pnpm", "python", "ruby", "rust", "yarn"];

const isKnownTool = (value: string): value is RuntimeTool => (KNOWN_TOOLS as readonly string[]).includes(value);

const icon = (ok: boolean): string => (ok ? green("✓") : red("✗"));
const warnIcon = yellow("⚠");

const renderManagerLine = (manager: DetectedManager): string => {
    const ver = manager.version ? ` v${manager.version}` : "";
    const cfg = manager.configFiles.length > 0 ? ` (${manager.configFiles.join(", ")})` : "";

    if (manager.installed) {
        return `${icon(true)} ${manager.name}${ver}${cfg}`;
    }

    return `${warnIcon} ${manager.name} — referenced by ${manager.configFiles.join(", ") || "config"} but not installed`;
};

const renderToolManager = (manager: ResolvedManager): string => {
    if (manager.name === "self-activate") {
        return dim("→ self-activate");
    }

    if (manager.name === "none") {
        return dim("→ (no manager)");
    }

    return manager.installed ? dim(`→ ${manager.name}`) : dim(`→ ${manager.name} (missing)`);
};

const printStatus = (status: ToolchainStatus): void => {
    info("");
    info(dim("── Toolchain ───────────────────────"));

    if (status.detected.length === 0) {
        info(`  ${icon(false)} No version manager detected`);
        note("  Install one of: proto, mise, fnm, volta, asdf, nvm, corepack");
    } else {
        for (const manager of status.detected) {
            info(`  ${renderManagerLine(manager)}`);
        }
    }

    info("");

    if (status.tools.length === 0) {
        info(`  ${dim("No tool pins found — add engines.node, .nvmrc, or a manager config file.")}`);

        return;
    }

    info(dim("── Tools ───────────────────────────"));

    for (const tool of status.tools) {
        const expected = `${tool.expected.tool} ${tool.expected.version}`;
        const actualText = tool.actual ? `actual ${tool.actual}` : "not installed";
        const source = dim(`[${tool.expected.source}]`);
        const managerText = renderToolManager(tool.manager);

        if (tool.matches) {
            info(`  ${icon(true)} ${expected} — ${actualText} ${source} ${managerText}`);
        } else if (tool.actual) {
            info(`  ${warnIcon} ${expected} — ${actualText} ${source} ${managerText}`);
        } else {
            info(`  ${icon(false)} ${expected} — ${actualText} ${source} ${managerText}`);
        }

        if (tool.manager.note) {
            note(`     ${tool.manager.note}`);
        }
    }
};

const executeStatus = (workspaceRoot: string, toolchainConfig: ToolchainConfig | undefined, options: Record<string, unknown>): void => {
    const status = getToolchainStatus(workspaceRoot, toolchainConfig);

    if (options.json) {
        process.stdout.write(
            `${JSON.stringify(
                {
                    detected: status.detected.map((m) => ({
                        binPath: m.binPath ?? null,
                        configFiles: m.configFiles,
                        installed: m.installed,
                        name: m.name,
                        version: m.version ?? null,
                    })),
                    tools: status.tools.map((t) => ({
                        actual: t.actual ?? null,
                        expected: t.expected.version,
                        manager: t.manager.name,
                        managerInstalled: t.manager.installed,
                        matches: t.matches,
                        note: t.manager.note ?? null,
                        source: t.expected.source,
                        tool: t.expected.tool,
                    })),
                },
                undefined,
                2,
            )}\n`,
        );

        return;
    }

    printStatus(status);

    const mismatches = status.tools.filter((t) => !t.matches);

    if (mismatches.length > 0) {
        info("");
        note("  Run `vis toolchain install` to install pinned versions.");
    }

    if (options.exitCode && mismatches.length > 0) {
        process.exitCode = 1;
    }
};

/**
 * Groups mismatched tools by which manager will install them, so we
 * can run the install command once per manager (proto/mise/fnm/asdf
 * read their own config and don't need per-tool args) and per-tool
 * for volta/corepack (which pin individual tools).
 */
const groupByManager = (tools: readonly ToolStatus[]): Map<ResolvedManager["name"], ToolStatus[]> => {
    const groups = new Map<ResolvedManager["name"], ToolStatus[]>();

    for (const tool of tools) {
        const bucket = groups.get(tool.manager.name);

        if (bucket) {
            bucket.push(tool);
        } else {
            groups.set(tool.manager.name, [tool]);
        }
    }

    return groups;
};

const runInvocation = (bin: string, args: readonly string[], cwd: string): number => {
    const result = spawnSync(bin, args as string[], { cwd, stdio: "inherit" });

    return result.status ?? 1;
};

const executeInstall = (workspaceRoot: string, toolchainConfig: ToolchainConfig | undefined, options: Record<string, unknown>): void => {
    const status = getToolchainStatus(workspaceRoot, toolchainConfig);
    const mismatches = status.tools.filter((t) => !t.matches);

    if (mismatches.length === 0) {
        success("Everything already matches — nothing to install.");

        return;
    }

    if (status.detected.length === 0) {
        errorOutput("No version manager detected. Install one of: proto, mise, fnm, volta, asdf, nvm, corepack.");
        process.exitCode = 1;

        return;
    }

    const groups = groupByManager(mismatches);
    let ranAnything = false;
    let exitCode = 0;

    for (const [managerName, tools] of groups) {
        if (managerName === "self-activate") {
            for (const { expected } of tools) {
                info(`${dim("$")} (${expected.tool} will self-activate on next invocation)`);
                note(`  ${expected.tool} ${expected.version} — pinned via packageManager field, no install needed`);
            }

            continue;
        }

        if (managerName === "none") {
            for (const { expected } of tools) {
                warn(`Cannot install ${expected.tool} ${expected.version} — no manager can handle it.`);
            }

            exitCode = 1;
            continue;
        }

        const manager = status.detected.find((d) => d.name === managerName);

        if (!manager?.installed) {
            errorOutput(`${managerName} is referenced but not on PATH — install it first, then rerun \`vis toolchain install\`.`);
            exitCode = 1;
            continue;
        }

        // volta and corepack pin per-tool, so invoke once per tool. The
        // rest (proto/mise/asdf/fnm) install everything from their config
        // in a single shot.
        const perTool = managerName === "volta" || managerName === "corepack";
        const invocations = perTool
            ? tools.map((t) => buildInstallInvocation(managerName, t.expected)).filter(Boolean)
            : [buildInstallInvocation(managerName)].filter(Boolean);

        for (const invocation of invocations) {
            if (!invocation) {
                continue;
            }

            if (invocation.bin === "nvm" && invocation.args.length === 0) {
                errorOutput("nvm is a shell function — run `nvm install` in your shell, then rerun `vis toolchain install`.");

                if (invocation.hint) {
                    note(`  ${invocation.hint}`);
                }

                exitCode = 1;
                continue;
            }

            info(`${dim("$")} ${invocation.bin} ${invocation.args.join(" ")}`);

            if (invocation.hint) {
                note(`  ${invocation.hint}`);
            }

            if (options.dryRun) {
                ranAnything = true;
                continue;
            }

            const status_ = runInvocation(invocation.bin, invocation.args, workspaceRoot);

            ranAnything = true;

            if (status_ !== 0) {
                exitCode = status_;
                break;
            }
        }
    }

    if (exitCode !== 0) {
        process.exitCode = exitCode;

        return;
    }

    if (ranAnything) {
        success("Toolchain installed.");
    }
};

const executeUse = (
    workspaceRoot: string,
    toolchainConfig: ToolchainConfig | undefined,
    rawSpec: string | undefined,
    options: Record<string, unknown>,
): void => {
    if (!rawSpec) {
        throw new Error("Usage: vis toolchain use <tool>@<version> (e.g. vis toolchain use node@22.13.0)");
    }

    const spec = parseUseArgument(rawSpec);

    if (!spec) {
        throw new Error(`Could not parse "${rawSpec}". Expected "<tool>@<version>" where <tool> is one of ${KNOWN_TOOLS.join(", ")}.`);
    }

    const detected = findInstalledManagers(workspaceRoot);
    const manager = resolveManagerFor(spec, detected, toolchainConfig);

    if (manager.name === "none") {
        errorOutput(`No manager can pin ${spec.tool}. Install proto, mise, or volta first.`);
        process.exitCode = 1;

        return;
    }

    if (!manager.installed) {
        errorOutput(`The best manager for ${spec.tool} (${manager.name}) is not on PATH. ${manager.note ?? ""}`);
        process.exitCode = 1;

        return;
    }

    const invocation = buildUseInvocation(manager.name, spec);

    if (!invocation) {
        errorOutput(`${manager.name} cannot pin ${spec.tool}. Use a different manager, or set \`toolchain.tools.${spec.tool}\` in vis.config.ts.`);
        process.exitCode = 1;

        return;
    }

    if (invocation.args.length === 0) {
        // self-activate / nvm — no shell-out, user (or vis) edits config.
        info(`${dim("→")} ${invocation.configChange?.hint ?? `Edit ${invocation.configChange?.file ?? "config"} manually`}`);

        if (invocation.configChange) {
            note(`  ${invocation.configChange.file} update required.`);
        }

        if (manager.name === "self-activate") {
            // self-activate is "it just works" — nothing to do, just report.
            success(`No install needed — ${spec.tool} ${spec.version} will activate on next invocation.`);

            return;
        }

        process.exitCode = 1;

        return;
    }

    info(`${dim("$")} ${invocation.bin} ${invocation.args.join(" ")}`);

    if (invocation.configChange) {
        note(`  Will update ${invocation.configChange.file} — ${invocation.configChange.hint}`);
    }

    if (options.dryRun) {
        return;
    }

    const status_ = runInvocation(invocation.bin, invocation.args, workspaceRoot);

    if (status_ !== 0) {
        process.exitCode = status_;

        return;
    }

    success(`Pinned ${spec.tool} to ${spec.version}.`);
};

const executeWhich = (workspaceRoot: string, toolchainConfig: ToolchainConfig | undefined, rawTool: string | undefined): void => {
    if (!rawTool) {
        throw new Error("Usage: vis toolchain which <tool> (e.g. vis toolchain which node)");
    }

    const normalized = rawTool.toLowerCase();

    if (!isKnownTool(normalized)) {
        throw new Error(`Unknown tool "${rawTool}". Known: ${KNOWN_TOOLS.join(", ")}.`);
    }

    const detected = findInstalledManagers(workspaceRoot);
    const resolved = resolveManagerFor(
        { source: "vis.config.ts", tool: normalized, version: "*" },
        detected,
        toolchainConfig,
    );

    const manager = resolved.installed && resolved.name !== "self-activate" ? detected.find((d) => d.name === resolved.name) : undefined;
    const binary = manager ? resolveToolBinary(manager, normalized) : undefined;

    if (!binary) {
        errorOutput(`${rawTool} not found in PATH${manager ? ` or via ${manager.name}` : ""}.`);
        process.exitCode = 1;

        return;
    }

    process.stdout.write(`${binary}\n`);
};

const executeDetect = (workspaceRoot: string, toolchainConfig: ToolchainConfig | undefined): void => {
    const detected = findInstalledManagers(workspaceRoot);

    if (detected.length === 0) {
        process.stdout.write("none\n");

        return;
    }

    // Honour an explicit override if the user set one.
    if (toolchainConfig?.preferredManager && toolchainConfig.preferredManager !== "none") {
        process.stdout.write(`${toolchainConfig.preferredManager}\n`);

        return;
    }

    // Prefer a manager that has a workspace config and is installed.
    const primary
        = detected.find((d) => d.installed && d.configFiles.length > 0)
            ?? detected.find((d) => d.installed)
            ?? detected[0];

    process.stdout.write(`${primary?.name ?? "none"}\n`);
};

/**
 * `vis toolchain` — inspect and delegate to the workspace's version
 * managers. Unlike vite+ (which ships a managed runtime in `~/.vite-plus`),
 * vis finds whichever managers the developer already has and routes each
 * tool pin to the best one: proto/mise/fnm/volta/asdf/nvm for runtimes,
 * corepack for npm, and pnpm/yarn "self-activate" themselves from the
 * `packageManager` field (pnpm 10+, yarn berry) so no external manager
 * is needed for them.
 *
 * Subcommands:
 *
 *   status             Show every detected manager + expected-vs-actual versions.
 *   detect             Print the primary manager's name (for scripts).
 *   install            Install pinned versions — iterates per-tool, picking the right manager.
 *   use <tool>@<ver>   Pin a version via the best manager for that tool.
 *   which <tool>       Print the resolved binary path for a tool.
 */
const toolchain: Command = {
    argument: {
        description: "Subcommand: status | detect | install | use | which",
        name: "action",
        type: String,
    },
    description: "Inspect and delegate to the workspace version managers (proto, mise, fnm, volta, asdf, nvm, corepack)",
    examples: [
        ["vis toolchain status", "Show every detected manager + expected vs actual tool versions"],
        ["vis toolchain install", "Install pinned versions — per-tool delegation"],
        ["vis toolchain use node@22.13.0", "Pin node 22.13.0 via the best runtime manager"],
        ["vis toolchain use pnpm@10.32.1", "Update the packageManager field; pnpm self-activates"],
        ["vis toolchain which node", "Resolve the node binary the manager would launch"],
        ["vis toolchain detect", "Print the primary manager's name"],
    ],
    execute: async ({ argument, options, visConfig, workspaceRoot: wsRoot }) => {
        if (!wsRoot) {
            throw new Error("Could not determine workspace root. Run inside a monorepo.");
        }

        const action = argument[0] ?? "status";
        const toolchainConfig = visConfig?.toolchain;

        switch (action) {
            case "detect": {
                executeDetect(wsRoot, toolchainConfig);

                return;
            }

            case "install": {
                executeInstall(wsRoot, toolchainConfig, options);

                return;
            }

            case "status": {
                executeStatus(wsRoot, toolchainConfig, options);

                return;
            }

            case "use": {
                executeUse(wsRoot, toolchainConfig, argument[1], options);

                return;
            }

            case "which": {
                executeWhich(wsRoot, toolchainConfig, argument[1]);

                return;
            }

            default: {
                throw new Error(`Unknown toolchain action "${action}". Known: status, detect, install, use, which.`);
            }
        }
    },
    group: "Workspace",
    name: "toolchain",
    options: [
        { defaultValue: false, description: "With `status`: exit 1 if any tool mismatches", name: "exit-code", type: Boolean },
        { defaultValue: false, description: "Print the command that would run, but don't execute", name: "dry-run", type: Boolean },
        { defaultValue: false, description: "Emit JSON (status subcommand only)", name: "json", type: Boolean },
    ],
};

export default toolchain;
