import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { dim, green, red, yellow } from "@visulima/colorize";
import { join } from "@visulima/path";

import { pail } from "../../io/logger";
import type { DetectedManager, RuntimeTool, ToolchainConfig, ToolchainStatus, ToolStatus, VersionManagerName } from "../../runtime/toolchain";
import {
    buildInstallInvocation,
    buildUseInvocation,
    findInstalledManagers,
    findOnPathByAlias,
    getToolchainStatus,
    parseUseArgument,
    pickPrimaryManager,
    resolveManagerFor,
    resolveToolBinary,
    SUPPORTED_MANAGERS,
    updateEnginesField,
    writePackageManagerField,
} from "../../runtime/toolchain";
import type { ToolchainOptions } from "./index";

const KNOWN_TOOLS: ReadonlyArray<RuntimeTool> = ["bun", "deno", "go", "node", "npm", "pnpm", "python", "ruby", "rust", "yarn"];

const isKnownTool = (value: string): value is RuntimeTool => (KNOWN_TOOLS as ReadonlyArray<string>).includes(value);

const icon = (ok: boolean): string => (ok ? green("✓") : red("✗"));
const warnIcon = yellow("⚠");

const renderManagerLine = (manager: DetectedManager): string => {
    if (manager.installed) {
        const ver = manager.version ? ` v${manager.version}` : "";
        const cfg = manager.configFiles.length > 0 ? ` (${manager.configFiles.join(", ")})` : "";

        return `${icon(true)} ${manager.name}${ver}${cfg}`;
    }

    // findInstalledManagers only emits uninstalled entries when the
    // manager was named by a config file, so configFiles is non-empty
    // on this branch.
    return `${warnIcon} ${manager.name} — referenced by ${manager.configFiles.join(", ")} but not installed`;
};

/**
 * The trailing "→ manager" hint on a tool row. Only shown when it adds
 * information — for matching tools and self-activate pins, the row
 * already tells the user everything they need.
 */
const renderToolManager = (tool: ToolStatus): string => {
    if (tool.matches) {
        return "";
    }

    const { manager } = tool;

    if (manager.name === "none") {
        return dim("→ (no manager)");
    }

    if (manager.name === "self-activate") {
        return "";
    }

    return manager.installed ? dim(`→ ${manager.name}`) : dim(`→ ${manager.name} (missing)`);
};

/**
 * Pick the icon for a tool row: green check when the actual version
 * satisfies the pin, warn when something's installed but drifted, red
 * cross when the tool isn't on PATH at all.
 */
const toolIcon = (tool: ToolStatus): string => {
    if (tool.matches) {
        return icon(true);
    }

    return tool.actual ? warnIcon : icon(false);
};

const printStatus = (status: ToolchainStatus): void => {
    pail.info("");
    pail.info(dim("── Toolchain ───────────────────────"));

    if (status.detected.length === 0) {
        pail.info(`  ${icon(false)} No version manager detected`);
        pail.notice(`  Install one of: ${SUPPORTED_MANAGERS.join(", ")}`);
    } else {
        for (const manager of status.detected) {
            pail.info(`  ${renderManagerLine(manager)}`);
        }
    }

    pail.info("");

    if (status.tools.length === 0) {
        pail.info(`  ${dim("No tool pins found — add engines.node, .nvmrc, or a manager config file.")}`);

        return;
    }

    pail.info(dim("── Tools ───────────────────────────"));

    for (const tool of status.tools) {
        const expected = `${tool.expected.tool} ${tool.expected.version}`;
        const actualText = tool.actual ? `actual ${tool.actual}` : "not installed";
        // Only emit the source tag when the row is actionable — for
        // green rows the source is noise.
        const source = tool.matches ? "" : dim(` [${tool.expected.source}]`);
        const managerText = renderToolManager(tool);
        const suffix = managerText === "" ? "" : ` ${managerText}`;

        pail.info(`  ${toolIcon(tool)} ${expected} — ${actualText}${source}${suffix}`);

        if (tool.manager.note) {
            pail.notice(`     ${tool.manager.note}`);
        }
    }
};

const executeStatus = (workspaceRoot: string, toolchainConfig: ToolchainConfig | undefined, options: Record<string, unknown>): void => {
    const status = getToolchainStatus(workspaceRoot, toolchainConfig);

    if (options.json) {
        process.stdout.write(
            `${JSON.stringify(
                {
                    detected: status.detected.map((m) => {
                        return {
                            binPath: m.binPath ?? null,
                            configFiles: m.configFiles,
                            installed: m.installed,
                            name: m.name,
                            version: m.version ?? null,
                        };
                    }),
                    tools: status.tools.map((t) => {
                        return {
                            actual: t.actual ?? null,
                            expected: t.expected.version,
                            manager: t.manager.name,
                            managerInstalled: t.manager.installed,
                            matches: t.matches,
                            note: t.manager.note ?? null,
                            source: t.expected.source,
                            tool: t.expected.tool,
                        };
                    }),
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
        pail.info("");
        pail.notice("  Run `vis toolchain install` to install pinned versions.");
    }

    if (options.exitCode && mismatches.length > 0) {
        process.exitCode = 1;
    }
};

/**
 * Groups mismatched tools by which manager will install them. proto /
 * mise / fnm / asdf each read their own config and install everything
 * in one shot, so one invocation per bucket is enough. volta and
 * corepack pin per-tool, so the caller iterates the bucket.
 */
const groupByManager = (tools: ReadonlyArray<ToolStatus>): Map<VersionManagerName, ToolStatus[]> => {
    const groups = new Map<VersionManagerName, ToolStatus[]>();

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

const runInvocation = (bin: string, args: ReadonlyArray<string>, cwd: string): number => {
    const result = spawnSync(bin, args as string[], { cwd, stdio: "inherit" });

    return result.status ?? 1;
};

const executeInstall = (workspaceRoot: string, toolchainConfig: ToolchainConfig | undefined, options: Record<string, unknown>): void => {
    const status = getToolchainStatus(workspaceRoot, toolchainConfig);
    const mismatches = status.tools.filter((t) => !t.matches);

    if (mismatches.length === 0) {
        pail.success("Everything already matches — nothing to install.");

        return;
    }

    // Only error when we have no manager AND there's at least one
    // mismatch that needs one. A workspace where every mismatched pin
    // is `self-activate` (pnpm/yarn from the packageManager field)
    // doesn't need a detected manager — vis writes packageManager
    // itself, then the PM activates on next invocation.
    const needsRealManager = mismatches.some((m) => m.manager.name !== "self-activate" && m.manager.name !== "none");

    if (status.detected.length === 0 && needsRealManager) {
        pail.error(`No version manager detected. Install one of: ${SUPPORTED_MANAGERS.join(", ")}.`);
        process.exitCode = 1;

        return;
    }

    const groups = groupByManager(mismatches);
    let ranAnything = false;
    let exitCode = 0;

    for (const [managerName, tools] of groups) {
        if (managerName === "self-activate") {
            // The pin is "real" when the packageManager field already
            // matches. If the source is `engines.pnpm` or vis.config.ts,
            // the field may not exist yet — write it so pnpm/yarn have
            // something to self-activate from.
            for (const { expected } of tools) {
                if (expected.source === "packageManager") {
                    pail.info(`${dim("$")} (${expected.tool} will self-activate from packageManager on next invocation)`);
                } else {
                    pail.info(`${dim("$")} Writing packageManager=${expected.tool}@${expected.version}`);

                    if (options.dryRun) {
                        ranAnything = true;
                    } else {
                        try {
                            writePackageManagerField(workspaceRoot, expected);
                            ranAnything = true;
                        } catch (error: unknown) {
                            pail.error((error as Error).message);
                            exitCode = 1;
                        }
                    }
                }

                pail.notice(`  ${expected.tool} ${expected.version} — no install needed`);
            }

            continue;
        }

        if (managerName === "none") {
            for (const { expected } of tools) {
                pail.warn(`Cannot install ${expected.tool} ${expected.version} — no manager can handle it.`);
            }

            exitCode = 1;
            continue;
        }

        const manager = status.detected.find((d) => d.name === managerName);

        if (!manager?.installed) {
            pail.error(`${managerName} is referenced but not on PATH — install it first, then rerun \`vis toolchain install\`.`);
            exitCode = 1;
            continue;
        }

        // volta and corepack pin per-tool, so invoke once per tool. The
        // rest (proto/mise/asdf/fnm) install everything from their config
        // in a single shot.
        // Always invoke per-tool with an explicit spec so proto/mise/
        // asdf install the exact pin instead of falling back to a
        // workspace config that may not exist (engines.<tool> with no
        // .prototools / .mise.toml / .tool-versions).
        const invocations = tools.map((t) => buildInstallInvocation(managerName, t.expected)).filter(Boolean);

        for (const invocation of invocations) {
            if (!invocation) {
                continue;
            }

            if (invocation.bin === "nvm" && invocation.args.length === 0) {
                pail.error("nvm is a shell function — run `nvm install` in your shell, then rerun `vis toolchain install`.");

                if (invocation.hint) {
                    pail.notice(`  ${invocation.hint}`);
                }

                exitCode = 1;
                continue;
            }

            pail.info(`${dim("$")} ${invocation.bin} ${invocation.args.join(" ")}`);

            if (invocation.hint) {
                pail.notice(`  ${invocation.hint}`);
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
        pail.success("Toolchain installed.");
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
        pail.error(`No manager can pin ${spec.tool}. Install one of: ${SUPPORTED_MANAGERS.join(", ")}.`);
        process.exitCode = 1;

        return;
    }

    if (!manager.installed) {
        // Note: `self-activate` is never reached here — `resolveManagerFor`
        // only returns it with `installed: true` (pnpm/yarn binary on
        // PATH). When neither is on PATH, resolution falls through to a
        // capable runtime manager (volta/proto/mise) with `installed: false`,
        // which is what this branch surfaces.
        pail.error(`The best manager for ${spec.tool} (${manager.name}) is not on PATH. ${manager.note ?? ""}`);
        process.exitCode = 1;

        return;
    }

    const invocation = buildUseInvocation(manager.name, spec);

    if (!invocation) {
        pail.error(`${manager.name} cannot pin ${spec.tool}. Use a different manager, or set \`toolchain.tools.${spec.tool}\` in vis.config.ts.`);
        process.exitCode = 1;

        return;
    }

    // self-activate: write packageManager ourselves so the pin is real,
    // not a suggestion. pnpm 10+ / yarn berry pick it up on next run.
    if (manager.name === "self-activate") {
        pail.info(`${dim("→")} Writing packageManager field to package.json...`);

        if (options.dryRun) {
            pail.notice(`  Would set packageManager: "${spec.tool}@${spec.version}"`);

            return;
        }

        try {
            const written = writePackageManagerField(workspaceRoot, spec);

            if (!written) {
                pail.error(`Refusing to pin non-package-manager tool ${spec.tool} via the packageManager field.`);
                process.exitCode = 1;

                return;
            }

            pail.success(`Set packageManager: "${written}" — ${spec.tool} will activate this version on next invocation.`);

            if (options.engines !== false) {
                const updated = updateEnginesField(workspaceRoot, spec);

                if (updated) {
                    pail.success(`Updated package.json engines.${spec.tool} → ${updated}.`);
                }
            }
        } catch (error: unknown) {
            pail.error((error as Error).message);
            process.exitCode = 1;
        }

        return;
    }

    // nvm is a shell function — we can't `nvm use` from a subprocess,
    // but we can still be useful: write `.nvmrc` so the next shell
    // reopen (or manual `nvm use`) picks up the pinned version.
    if (invocation.args.length === 0 && manager.name === "nvm" && spec.tool === "node") {
        const nvmrcPath = join(workspaceRoot, ".nvmrc");

        pail.info(`${dim("→")} Writing ${nvmrcPath}...`);

        if (options.dryRun) {
            pail.notice(`  Would write ${spec.version} to .nvmrc`);

            return;
        }

        try {
            writeFileSync(nvmrcPath, `${spec.version}\n`);
        } catch (error: unknown) {
            pail.error(`Failed to write .nvmrc: ${(error as Error).message}`);
            process.exitCode = 1;

            return;
        }

        pail.success(`Wrote ${spec.version} to .nvmrc.`);
        pail.notice("  nvm is a shell function — run `nvm use` to activate it in this shell.");

        return;
    }

    // Any other zero-args path is an unhandled manager — refuse
    // loudly rather than claiming success.
    if (invocation.args.length === 0) {
        pail.error(`${manager.name} cannot pin ${spec.tool} from a subprocess. ${invocation.configChange?.hint ?? ""}`);

        if (invocation.configChange) {
            pail.notice(`  Edit ${invocation.configChange.file} by hand and rerun \`vis toolchain status\` to verify.`);
        }

        process.exitCode = 1;

        return;
    }

    pail.info(`${dim("$")} ${invocation.bin} ${invocation.args.join(" ")}`);

    if (invocation.configChange) {
        pail.notice(`  Will update ${invocation.configChange.file} — ${invocation.configChange.hint}`);
    }

    if (options.dryRun) {
        return;
    }

    const status_ = runInvocation(invocation.bin, invocation.args, workspaceRoot);

    if (status_ !== 0) {
        process.exitCode = status_;

        return;
    }

    pail.success(`Pinned ${spec.tool} to ${spec.version}.`);

    // Mirror the pin into engines.<tool> when the project already
    // declares one — keeps the "engines is the source of truth" CI
    // story in sync with the manager-specific pin. Skipped when
    // `--no-engines` is passed.
    if (options.engines !== false) {
        try {
            const updated = updateEnginesField(workspaceRoot, spec);

            if (updated) {
                pail.success(`Updated package.json engines.${spec.tool} → ${updated}.`);
            }
        } catch (error: unknown) {
            pail.warn(`Could not update engines.${spec.tool}: ${(error as Error).message}`);
        }
    }
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
    const resolved = resolveManagerFor({ source: "vis.config.ts", tool: normalized, version: "*" }, detected, toolchainConfig);

    // For real, installed managers (proto/mise/asdf/volta/fnm), ask
    // the manager itself: it knows about shims and can resolve the
    // active version's binary correctly. For `self-activate` and
    // `none` (no manager involved), do a plain PATH lookup so users
    // running `vis toolchain which pnpm` on a workspace that
    // self-activates still get a useful answer.
    const manager
        = resolved.installed && resolved.name !== "self-activate" && resolved.name !== "none" ? detected.find((d) => d.name === resolved.name) : undefined;
    // Use findOnPathByAlias so users running `which rust` or `which
    // python` on a self-activate / no-manager workspace still get a
    // useful answer (rustc, python3) — same alias list as
    // queryToolVersion / resolveToolBinary.
    const binary = manager ? resolveToolBinary(manager, normalized) : findOnPathByAlias(normalized);

    if (!binary) {
        pail.error(`${rawTool} not found in PATH${manager ? ` or via ${manager.name}` : ""}.`);
        process.exitCode = 1;

        return;
    }

    process.stdout.write(`${binary}\n`);
};

const executeDetect = (workspaceRoot: string, toolchainConfig: ToolchainConfig | undefined): void => {
    const primary = pickPrimaryManager(workspaceRoot, toolchainConfig);

    process.stdout.write(`${primary.name}\n`);
};

const execute = async ({ argument, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, ToolchainOptions>): Promise<void> => {
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
};

export default execute as CommandExecute<Toolbox>;
