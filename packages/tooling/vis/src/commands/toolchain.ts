import { spawnSync } from "node:child_process";

import type { Command } from "@visulima/cerebro";
import { dim, green, red, yellow } from "@visulima/colorize";

import { error as errorOutput, info, note, success } from "../output";
import {
    buildInstallInvocation,
    buildUseInvocation,
    detectVersionManager,
    getToolchainStatus,
    parseUseArgument,
    resolveToolBinary,
    type RuntimeTool,
    type ToolchainConfig,
    type ToolchainStatus,
} from "../toolchain";

const KNOWN_TOOLS: readonly RuntimeTool[] = ["bun", "deno", "go", "node", "npm", "pnpm", "python", "ruby", "rust", "yarn"];

const isKnownTool = (value: string): value is RuntimeTool => (KNOWN_TOOLS as readonly string[]).includes(value);

const icon = (ok: boolean): string => (ok ? green("✓") : red("✗"));
const warnIcon = yellow("⚠");

const printStatus = (status: ToolchainStatus): void => {
    info("");
    info(dim("── Toolchain ───────────────────────"));

    if (status.manager.name === "none") {
        info(`  ${icon(false)} No version manager detected`);
        note("  Install one of: proto, mise, fnm, volta, asdf, nvm");
    } else if (!status.manager.installed) {
        info(`  ${warnIcon} ${status.manager.name} referenced by config (${status.manager.configFiles.join(", ")}) but not installed`);
    } else {
        const ver = status.manager.version ? ` v${status.manager.version}` : "";
        const cfg = status.manager.configFiles.length > 0 ? ` (${status.manager.configFiles.join(", ")})` : "";

        info(`  ${icon(true)} Manager: ${status.manager.name}${ver}${cfg}`);
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

        if (tool.matches) {
            info(`  ${icon(true)} ${expected} — ${actualText} ${source}`);
        } else if (tool.actual) {
            info(`  ${warnIcon} ${expected} — ${actualText} ${source}`);
        } else {
            info(`  ${icon(false)} ${expected} — ${actualText} ${source}`);
        }
    }
};

const executeStatus = (workspaceRoot: string, toolchainConfig: ToolchainConfig | undefined, options: Record<string, unknown>): void => {
    const status = getToolchainStatus(workspaceRoot, toolchainConfig);

    if (options.json) {
        process.stdout.write(
            `${JSON.stringify(
                {
                    manager: {
                        binPath: status.manager.binPath,
                        configFiles: status.manager.configFiles,
                        installed: status.manager.installed,
                        name: status.manager.name,
                        version: status.manager.version,
                    },
                    tools: status.tools.map((t) => ({
                        actual: t.actual ?? null,
                        expected: t.expected.version,
                        matches: t.matches,
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
        note(`  Run \`vis toolchain install\` to install pinned versions via ${status.manager.name === "none" ? "a version manager" : status.manager.name}`);
    }

    if (options.exitCode && mismatches.length > 0) {
        process.exitCode = 1;
    }
};

const executeInstall = (workspaceRoot: string, toolchainConfig: ToolchainConfig | undefined, options: Record<string, unknown>): void => {
    const status = getToolchainStatus(workspaceRoot, toolchainConfig);
    const manager = status.manager;

    if (manager.name === "none") {
        errorOutput("No version manager detected. Install one of: proto, mise, fnm, volta, asdf, nvm.");
        process.exitCode = 1;

        return;
    }

    if (!manager.installed) {
        errorOutput(`Manager "${manager.name}" was referenced by ${manager.configFiles.join(", ") || "config"} but is not on PATH.`);
        process.exitCode = 1;

        return;
    }

    // For volta we iterate per-tool because volta pins tools individually.
    if (manager.name === "volta") {
        const mismatches = status.tools.filter((t) => !t.matches);
        const toInstall = mismatches.length > 0 ? mismatches : status.tools;

        if (toInstall.length === 0) {
            success("Everything already matches — nothing to install.");

            return;
        }

        for (const { expected } of toInstall) {
            const invocation = buildInstallInvocation("volta", expected);

            if (!invocation) {
                continue;
            }

            info(`${dim("$")} ${invocation.bin} ${invocation.args.join(" ")}`);

            if (options.dryRun) {
                continue;
            }

            const result = spawnSync(invocation.bin, invocation.args as string[], { cwd: workspaceRoot, stdio: "inherit" });

            if (result.status !== 0) {
                process.exitCode = result.status ?? 1;

                return;
            }
        }

        success("Toolchain installed.");

        return;
    }

    // proto / mise / asdf / fnm all run a single command that reads their config.
    const invocation = buildInstallInvocation(manager.name);

    if (!invocation) {
        errorOutput(`vis does not know how to run an install for ${manager.name}.`);
        process.exitCode = 1;

        return;
    }

    if (invocation.bin === "nvm") {
        errorOutput("nvm is a shell function, not a program — run `nvm install` in your shell.");

        if (invocation.hint) {
            note(`  ${invocation.hint}`);
        }

        process.exitCode = 1;

        return;
    }

    info(`${dim("$")} ${invocation.bin} ${invocation.args.join(" ")}`);

    if (invocation.hint) {
        note(`  ${invocation.hint}`);
    }

    if (options.dryRun) {
        return;
    }

    const result = spawnSync(invocation.bin, invocation.args as string[], { cwd: workspaceRoot, stdio: "inherit" });

    if (result.status !== 0) {
        process.exitCode = result.status ?? 1;

        return;
    }

    success("Toolchain installed.");
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
        throw new Error(`Could not parse "${rawSpec}". Expected "<tool>@<version>" where <tool> is one of node, pnpm, npm, yarn, bun, python, rust, go, deno, ruby.`);
    }

    const manager = detectVersionManager(workspaceRoot, toolchainConfig);

    if (manager.name === "none") {
        errorOutput("No version manager detected. Install one of: proto, mise, fnm, volta, asdf, nvm.");
        process.exitCode = 1;

        return;
    }

    if (!manager.installed) {
        errorOutput(`Manager "${manager.name}" was referenced by config but is not on PATH.`);
        process.exitCode = 1;

        return;
    }

    const invocation = buildUseInvocation(manager.name, spec);

    if (!invocation) {
        errorOutput(`${manager.name} cannot pin ${spec.tool}. Use a different manager, or set \`toolchain.tools.${spec.tool}\` in vis.config.ts.`);
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

    if (invocation.args.length === 0) {
        // nvm fallback — nothing we can shell out to safely.
        errorOutput(`${manager.name} requires a manual edit. ${invocation.configChange?.hint ?? ""}`);
        process.exitCode = 1;

        return;
    }

    const result = spawnSync(invocation.bin, invocation.args as string[], { cwd: workspaceRoot, stdio: "inherit" });

    if (result.status !== 0) {
        process.exitCode = result.status ?? 1;

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

    const manager = detectVersionManager(workspaceRoot, toolchainConfig);
    const resolved = resolveToolBinary(manager, normalized);

    if (!resolved) {
        errorOutput(`${rawTool} not found in PATH${manager.installed ? ` or via ${manager.name}` : ""}.`);
        process.exitCode = 1;

        return;
    }

    process.stdout.write(`${resolved}\n`);
};

/**
 * `vis toolchain` — inspect and delegate to the workspace's version
 * manager. Unlike vite+ (which ships a managed runtime in ~/.vite-plus),
 * vis finds whichever manager (proto / mise / fnm / volta / asdf / nvm)
 * the developer already has and shells out to it.
 *
 * Subcommands:
 *
 *   status             Show detected manager + expected-vs-actual versions.
 *   detect             Print the detected manager's name (for scripts).
 *   install            Run `<manager> install` to match pinned versions.
 *   use <tool>@<ver>   Pin a version via the detected manager.
 *   which <tool>       Print the resolved binary path for a tool.
 */
const toolchain: Command = {
    argument: {
        description: "Subcommand: status | detect | install | use | which",
        name: "action",
        type: String,
    },
    description: "Inspect and delegate to the workspace version manager (proto / mise / fnm / volta / asdf / nvm)",
    examples: [
        ["vis toolchain status", "Show detected manager + expected vs actual tool versions"],
        ["vis toolchain install", "Install pinned versions via the detected manager"],
        ["vis toolchain use node@22.13.0", "Pin node 22.13.0 via the detected manager"],
        ["vis toolchain which node", "Resolve the node binary the manager would launch"],
        ["vis toolchain detect", "Print the detected manager's name (none | proto | mise | fnm | volta | asdf | nvm)"],
    ],
    execute: async ({ argument, options, visConfig, workspaceRoot: wsRoot }) => {
        if (!wsRoot) {
            throw new Error("Could not determine workspace root. Run inside a monorepo.");
        }

        const action = argument[0] ?? "status";
        const toolchainConfig = visConfig?.toolchain;

        switch (action) {
            case "detect": {
                const manager = detectVersionManager(wsRoot, toolchainConfig);

                process.stdout.write(`${manager.name}\n`);

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
