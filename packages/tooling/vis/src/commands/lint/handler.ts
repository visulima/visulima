import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { bold, cyan, dim, green, red, yellow } from "@visulima/colorize";
import { relative } from "@visulima/path";

import type { BannedDepIssue } from "../../util/banned-deps-lint";
import { lintBannedDeps } from "../../util/banned-deps-lint";
import { readCatalogs } from "../../util/catalog";
import type { CatalogProposal } from "../../util/catalog-proposals";
import { applyCatalogProposals, proposeCatalogAdditions, renderCatalogProposalsDiff } from "../../util/catalog-proposals";
import type { RedefineRootIssue } from "../../util/redefine-root-lint";
import { lintRedefineRoot } from "../../util/redefine-root-lint";
import { iterateWorkspaceDeps } from "../../util/workspace-deps";
import type { WorkspaceProtocolIssue } from "../../util/workspace-protocol-lint";
import { applyWorkspaceProtocolFixes, lintWorkspaceProtocol } from "../../util/workspace-protocol-lint";
import type { WorkspaceVersionDriftIssue, WorkspaceVersionsResolveStrategy } from "../../util/workspace-versions-lint";
import { applyWorkspaceVersionsFixes, lintWorkspaceVersions } from "../../util/workspace-versions-lint";
import type { LintOptions } from "./index";

interface LintReport {
    bannedDeps?: BannedDepIssue[];
    catalogProposals?: CatalogProposal[];
    redefineRoot?: RedefineRootIssue[];
    workspaceProtocol?: WorkspaceProtocolIssue[];
    workspaceVersions?: WorkspaceVersionDriftIssue[];
}

interface LintSelection {
    bannedDeps: boolean;
    redefineRoot: boolean;
    workspaceProtocol: boolean;
    workspaceVersions: boolean;
}

/**
 * Tracks whether `--fix` actually rewrote files for each rule. A rule with
 * `policy.&lt;rule>.autofix === false` reports `false` here even when `--fix`
 * was passed — so human / JSON output can correctly say "Found" instead of
 * "Fixed" when the policy disabled the rewrite.
 */
interface FixState {
    catalogProposals: boolean;
    workspaceProtocol: boolean;
    workspaceVersions: boolean;
}

const groupBy = <T, K>(items: T[], key: (item: T) => K): Map<K, T[]> => {
    const out = new Map<K, T[]>();

    for (const item of items) {
        const k = key(item);
        const list = out.get(k);

        if (list) {
            list.push(item);
        } else {
            out.set(k, [item]);
        }
    }

    return out;
};

const printWorkspaceProtocolHuman = (issues: WorkspaceProtocolIssue[], workspaceRoot: string, didFix: boolean, logger: Toolbox["logger"]): void => {
    if (issues.length === 0) {
        logger.info(green("✓ workspace-protocol: no violations"));

        return;
    }

    const verb = didFix ? "Fixed" : "Found";
    const colour = didFix ? cyan : yellow;

    logger.info(colour(bold(`${verb} ${String(issues.length)} workspace-protocol violation${issues.length === 1 ? "" : "s"}`)));

    for (const [packageKey, packageIssues] of groupBy(issues, (i) => i.packageName ?? i.packageJsonPath)) {
        const path = relative(workspaceRoot, (packageIssues[0] as WorkspaceProtocolIssue).packageJsonPath);

        logger.info(`  ${bold(packageKey)} ${dim(`(${path})`)}`);

        for (const issue of packageIssues) {
            const arrow = didFix ? cyan("→") : yellow("→");

            logger.info(`    ${dim(issue.depType)} ${issue.depName}: ${red(issue.specifier)} ${arrow} ${green(issue.fix)}`);
        }
    }

    if (!didFix) {
        logger.info(dim("  Run with --fix to rewrite specifiers in place."));
    }
};

const printRedefineRootHuman = (issues: RedefineRootIssue[], workspaceRoot: string, logger: Toolbox["logger"]): void => {
    if (issues.length === 0) {
        logger.info(green("✓ redefine-root: no violations"));

        return;
    }

    logger.info(yellow(bold(`Found ${String(issues.length)} dep${issues.length === 1 ? "" : "s"} re-declared from root`)));

    for (const [packageKey, packageIssues] of groupBy(issues, (i) => i.packageName ?? i.packageJsonPath)) {
        const path = relative(workspaceRoot, (packageIssues[0] as RedefineRootIssue).packageJsonPath);

        logger.info(`  ${bold(packageKey)} ${dim(`(${path})`)}`);

        for (const issue of packageIssues) {
            logger.info(
                `    ${dim(issue.depType)} ${issue.depName}: ${red(issue.childSpecifier)} ${dim(`(root ${issue.rootDepType}: ${issue.rootSpecifier})`)}`,
            );
        }
    }

    logger.info(dim("  Remove these from child package.json files — root pin will resolve."));
};

const printWorkspaceVersionsHuman = (issues: WorkspaceVersionDriftIssue[], workspaceRoot: string, didFix: boolean, logger: Toolbox["logger"]): void => {
    if (issues.length === 0) {
        logger.info(green("✓ workspace-versions: no drift"));

        return;
    }

    const verb = didFix ? "Fixed" : "Found";
    const colour = didFix ? cyan : yellow;

    logger.info(colour(bold(`${verb} ${String(issues.length)} workspace-version drift${issues.length === 1 ? "" : "s"}`)));

    // Group by dep first — easier to scan than per-package for drift.
    for (const [depName, depIssues] of groupBy(issues, (i) => i.depName)) {
        const canonical = (depIssues[0] as WorkspaceVersionDriftIssue).fix;
        const source = (depIssues[0] as WorkspaceVersionDriftIssue).canonicalSource;

        logger.info(`  ${bold(depName)} ${dim(`canonical: ${canonical} (from ${source})`)}`);

        for (const issue of depIssues) {
            const path = relative(workspaceRoot, issue.packageJsonPath);
            const packageKey = issue.packageName ?? path;
            const arrow = didFix ? cyan("→") : yellow("→");

            logger.info(`    ${packageKey} ${dim(`(${path})`)} ${dim(issue.depType)}: ${red(issue.specifier)} ${arrow} ${green(issue.fix)}`);
        }
    }

    if (!didFix) {
        logger.info(dim("  Run with --fix to align drifting specifiers."));
    }
};

const printBannedDepsHuman = (issues: BannedDepIssue[], workspaceRoot: string, logger: Toolbox["logger"]): void => {
    if (issues.length === 0) {
        logger.info(green("✓ banned-deps: no violations"));

        return;
    }

    logger.info(red(bold(`Found ${String(issues.length)} banned dep${issues.length === 1 ? "" : "s"}`)));

    for (const [packageKey, packageIssues] of groupBy(issues, (i) => i.packageName ?? i.packageJsonPath)) {
        const path = relative(workspaceRoot, (packageIssues[0] as BannedDepIssue).packageJsonPath);

        logger.info(`  ${bold(packageKey)} ${dim(`(${path})`)}`);

        for (const issue of packageIssues) {
            const replacement = issue.replacement ? ` ${dim("→")} ${green(issue.replacement)}` : "";

            logger.info(`    ${dim(issue.depType)} ${red(issue.depName)}${replacement}`);
            logger.info(`      ${dim(issue.reason)}`);
        }
    }
};

const printCatalogProposalsHuman = (proposals: CatalogProposal[], workspaceRoot: string, didFix: boolean, logger: Toolbox["logger"]): void => {
    if (proposals.length === 0) {
        logger.info(green("✓ catalog-proposals: nothing worth promoting"));

        return;
    }

    const verb = didFix ? "Added" : "Would add";
    const colour = didFix ? cyan : yellow;

    logger.info(colour(bold(`${verb} ${String(proposals.length)} catalog entr${proposals.length === 1 ? "y" : "ies"}`)));

    for (const proposal of proposals) {
        logger.info(`  ${bold(proposal.depName)}: ${green(proposal.specifier)} ${dim(`(${String(proposal.instanceCount)} packages agree)`)}`);
    }

    if (!didFix) {
        const diff = renderCatalogProposalsDiff(workspaceRoot, proposals);

        if (diff) {
            logger.info("");
            logger.info(dim("Proposed pnpm-workspace.yaml changes:"));

            for (const line of diff.split("\n")) {
                if (line.startsWith("+")) {
                    logger.info(green(line));
                } else if (line.startsWith("-")) {
                    logger.info(red(line));
                } else {
                    logger.info(dim(line));
                }
            }
        }

        logger.info(dim("  Run with --fix to write these entries to pnpm-workspace.yaml."));
    }
};

const printHuman = (report: LintReport, workspaceRoot: string, fixState: FixState, selection: LintSelection, logger: Toolbox["logger"]): void => {
    let firstSection = true;

    const section = (run: () => void): void => {
        if (!firstSection) {
            logger.info("");
        }

        firstSection = false;
        run();
    };

    if (selection.workspaceProtocol) {
        section(() => {
            printWorkspaceProtocolHuman(report.workspaceProtocol ?? [], workspaceRoot, fixState.workspaceProtocol, logger);
        });
    }

    if (selection.redefineRoot) {
        section(() => {
            printRedefineRootHuman(report.redefineRoot ?? [], workspaceRoot, logger);
        });
    }

    if (selection.workspaceVersions) {
        section(() => {
            printWorkspaceVersionsHuman(report.workspaceVersions ?? [], workspaceRoot, fixState.workspaceVersions, logger);
        });
    }

    if (report.catalogProposals !== undefined) {
        section(() => {
            printCatalogProposalsHuman(report.catalogProposals ?? [], workspaceRoot, fixState.catalogProposals, logger);
        });
    }

    if (selection.bannedDeps) {
        section(() => {
            printBannedDepsHuman(report.bannedDeps ?? [], workspaceRoot, logger);
        });
    }
};

const printMinimal = (report: LintReport, workspaceRoot: string): void => {
    for (const issue of report.workspaceProtocol ?? []) {
        const path = relative(workspaceRoot, issue.packageJsonPath);

        process.stdout.write(`workspace-protocol\t${path}\t${issue.depType}\t${issue.depName}\t${issue.specifier} → ${issue.fix}\n`);
    }

    for (const issue of report.redefineRoot ?? []) {
        const path = relative(workspaceRoot, issue.packageJsonPath);

        process.stdout.write(`redefine-root\t${path}\t${issue.depType}\t${issue.depName}\t${issue.childSpecifier}\n`);
    }

    for (const issue of report.workspaceVersions ?? []) {
        const path = relative(workspaceRoot, issue.packageJsonPath);

        process.stdout.write(`workspace-versions\t${path}\t${issue.depType}\t${issue.depName}\t${issue.specifier} → ${issue.fix}\n`);
    }

    for (const issue of report.bannedDeps ?? []) {
        const path = relative(workspaceRoot, issue.packageJsonPath);

        process.stdout.write(`banned-deps\t${path}\t${issue.depType}\t${issue.depName}\t${issue.reason}\n`);
    }

    for (const proposal of report.catalogProposals ?? []) {
        process.stdout.write(`catalog-proposal\t${proposal.catalogName}\t${proposal.depName}\t${proposal.specifier}\t${String(proposal.instanceCount)}\n`);
    }
};

const printJson = (report: LintReport, workspaceRoot: string, fixState: FixState, selection: LintSelection): void => {
    const relativize = <T extends { packageJsonPath: string }>(issue: T): T => {
        return {
            ...issue,
            packageJsonPath: relative(workspaceRoot, issue.packageJsonPath),
        };
    };

    const out: Record<string, unknown> = { fixed: fixState };

    if (selection.workspaceProtocol) {
        const issues = (report.workspaceProtocol ?? []).map((i) => relativize(i));

        out.workspaceProtocol = { issues, total: issues.length };
    }

    if (selection.redefineRoot) {
        const issues = (report.redefineRoot ?? []).map((i) => relativize(i));

        out.redefineRoot = { issues, total: issues.length };
    }

    if (selection.workspaceVersions) {
        const issues = (report.workspaceVersions ?? []).map((i) => relativize(i));

        out.workspaceVersions = { issues, total: issues.length };
    }

    if (selection.bannedDeps) {
        const issues = (report.bannedDeps ?? []).map((i) => relativize(i));

        out.bannedDeps = { issues, total: issues.length };
    }

    if (report.catalogProposals !== undefined) {
        const proposals = report.catalogProposals;

        out.catalogProposals = { proposals, total: proposals.length };
    }

    process.stdout.write(`${JSON.stringify(out, undefined, 2)}\n`);
};

const resolveSelection = (options: LintOptions): LintSelection => {
    // `--ban` / `--pin` implicitly target their respective lints, so users
    // can run a one-off check without also passing `--banned-deps` /
    // `--workspace-versions`.
    const hasBan = (options.ban?.length ?? 0) > 0;
    const hasPin = (options.pin?.length ?? 0) > 0;

    // No selectors set → run the default suite (currently every lint).
    const anySelected
        = (options.workspaceProtocol ?? false)
            || (options.redefineRoot ?? false)
            || (options.bannedDeps ?? false)
            || (options.workspaceVersions ?? false)
            || hasBan
            || hasPin;

    if (!anySelected) {
        return { bannedDeps: true, redefineRoot: true, workspaceProtocol: true, workspaceVersions: true };
    }

    return {
        bannedDeps: (options.bannedDeps ?? false) || hasBan,
        redefineRoot: options.redefineRoot ?? false,
        workspaceProtocol: options.workspaceProtocol ?? false,
        workspaceVersions: (options.workspaceVersions ?? false) || hasPin,
    };
};

/**
 * Parse `--pin name@&lt;specifier>` entries into a Map. A specifier is everything
 * after the last `@` (so scoped names like `@scope/pkg@^1.0.0` work). Throws on
 * malformed input — better to abort the lint than silently ignore typos.
 */
const parsePinFlags = (raw: string[] | undefined): Map<string, string> => {
    const pinned = new Map<string, string>();

    for (const entry of raw ?? []) {
        const at = entry.lastIndexOf("@");

        if (at <= 0 || at === entry.length - 1) {
            throw new Error(`Invalid --pin "${entry}". Use: name@<specifier> (e.g. react@^18.2.0).`);
        }

        const name = entry.slice(0, at);
        const specifier = entry.slice(at + 1);

        pinned.set(name, specifier);
    }

    return pinned;
};

const RESOLVE_STRATEGIES = new Set<WorkspaceVersionsResolveStrategy>(["catalog", "highest", "lowest"]);

const parseResolveStrategy = (value: string | undefined): WorkspaceVersionsResolveStrategy => {
    if (value === undefined) {
        return "highest";
    }

    if (!RESOLVE_STRATEGIES.has(value as WorkspaceVersionsResolveStrategy)) {
        throw new Error(`Invalid --resolve "${value}". Use: highest, lowest, or catalog.`);
    }

    return value as WorkspaceVersionsResolveStrategy;
};

/**
 * Resolve a per-rule `autofix` policy setting against the global `--fix` flag.
 *
 * Returns `true` only when the rule is allowed to actually rewrite files. A
 * `false` policy disables the rewrite for that rule even when `--fix` is set;
 * `"prompt"` is reserved for an interactive flow and currently behaves like
 * `false` (with a one-time notice elsewhere).
 */
const isAutofixAllowed = (fix: boolean, autofix: "prompt" | boolean | undefined): boolean => {
    if (!fix) {
        return false;
    }

    // Explicit allowlist — anything not `true` / `undefined` blocks the rewrite.
    // Guards against typos like `autofix: "ask"` getting silently treated as
    // truthy and rewriting files the user didn't expect.
    return autofix === undefined || autofix === true;
};

/**
 * Tell the user *why* a rule's violations weren't rewritten, with a hint
 * pointing at the config knob they can flip. Used for both `autofix: false`
 * and `autofix: "prompt"` (the latter is documented as report-only until
 * interactive mode lands).
 */
const warnAutofixDenied = (
    logger: Toolbox["logger"],
    rule: "workspace-protocol" | "workspace-versions",
    autofix: "prompt" | boolean | undefined,
    issueCount: number,
): void => {
    const configPath = rule === "workspace-protocol" ? "policy.workspaceProtocol.autofix" : "policy.workspaceVersions.autofix";
    const reason = autofix === "prompt"
        ? `${configPath} = "prompt" (interactive mode not yet implemented; report-only)`
        : `${configPath} = false`;
    const hint = `Set "${configPath}": true (or remove it) to enable rewrites.`;

    logger.warn(`${rule}: ${String(issueCount)} issue${issueCount === 1 ? "" : "s"} not rewritten — ${reason}. ${hint}`);
};

const execute = async ({ logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, LintOptions>): Promise<void> => {
    if (!wsRoot) {
        throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
    }

    const workspaceRoot = wsRoot;
    const fix = options.fix ?? false;
    const format = options.format ?? "human";
    const quiet = options.quiet ?? false;

    if (!["human", "json", "minimal"].includes(format)) {
        throw new Error(`Invalid --format "${format}". Use: human, json, or minimal.`);
    }

    const selection = resolveSelection(options);
    const policy = visConfig?.policy ?? {};
    const pinned = parsePinFlags(options.pin);
    const bans = options.ban ?? [];

    if ((options.dep !== undefined || options.resolve !== undefined) && !selection.workspaceVersions && !quiet) {
        logger.warn("--dep / --resolve only apply to --workspace-versions; ignored.");
    }

    const instances = iterateWorkspaceDeps(workspaceRoot);
    const report: LintReport = {};
    const fixState: FixState = { catalogProposals: false, workspaceProtocol: false, workspaceVersions: false };
    let totalIssues = 0;

    if (selection.workspaceProtocol) {
        const issues = lintWorkspaceProtocol(instances, { fixSpecifier: options.fixSpecifier });
        const autofixAllowed = isAutofixAllowed(fix, policy.workspaceProtocol?.autofix);

        if (autofixAllowed && issues.length > 0) {
            applyWorkspaceProtocolFixes(issues);
            fixState.workspaceProtocol = true;
        }

        report.workspaceProtocol = issues;

        // Issues count toward CI failure unless they were actually rewritten —
        // policy.workspaceProtocol.autofix === false means "report only" so
        // the violations should still fail the run.
        if (!autofixAllowed) {
            totalIssues += issues.length;
        }

        if (fix && !autofixAllowed && issues.length > 0 && !quiet) {
            warnAutofixDenied(logger, "workspace-protocol", policy.workspaceProtocol?.autofix, issues.length);
        }
    }

    if (selection.redefineRoot) {
        const issues = lintRedefineRoot(instances, { ignoreDeps: policy.redefineRoot?.ignore });

        report.redefineRoot = issues;
        totalIssues += issues.length;
    }

    if (selection.workspaceVersions) {
        const resolve = parseResolveStrategy(options.resolve ?? policy.workspaceVersions?.resolve);
        const catalogs = resolve === "catalog" ? readCatalogs(workspaceRoot) : undefined;

        if (resolve === "catalog" && (!catalogs || catalogs.size === 0) && !quiet) {
            logger.warn("--resolve catalog: no catalog found in pnpm-workspace.yaml or root package.json — nothing to align.");
        }

        const issues = lintWorkspaceVersions(instances, {
            catalogs,
            dep: options.dep,
            ignoreDeps: policy.workspaceVersions?.ignore,
            pinned: pinned.size > 0 ? pinned : undefined,
            resolve,
        });

        const autofixAllowed = isAutofixAllowed(fix, policy.workspaceVersions?.autofix);

        if (autofixAllowed && issues.length > 0) {
            applyWorkspaceVersionsFixes(issues);
            fixState.workspaceVersions = true;
        }

        report.workspaceVersions = issues;

        if (!autofixAllowed) {
            totalIssues += issues.length;
        }

        if (fix && !autofixAllowed && issues.length > 0 && !quiet) {
            warnAutofixDenied(logger, "workspace-versions", policy.workspaceVersions?.autofix, issues.length);
        }

        if (options.proposeMin !== undefined) {
            if (resolve !== "catalog" && !quiet) {
                logger.warn("--propose-min only runs under --resolve catalog; ignored.");
            } else if (resolve === "catalog") {
                // Proposals scan the whole workspace — `--dep` only scopes the
                // drift report. A user running `--dep react --propose-min 3`
                // should still see all eligible proposals, not just react.
                const proposals = proposeCatalogAdditions(instances, {
                    catalogs,
                    ignoreDeps: policy.workspaceVersions?.ignore,
                    min: options.proposeMin,
                });

                if (autofixAllowed && proposals.length > 0) {
                    applyCatalogProposals(workspaceRoot, proposals);
                    fixState.catalogProposals = true;
                }

                report.catalogProposals = proposals;

                // Proposals are *suggestions*, not violations — don't fail CI.
                // Drift count above already covers genuine issues.
            }
        }
    }

    if (selection.bannedDeps) {
        const config = { ...policy.bannedDeps };

        for (const name of bans) {
            // CLI bans win over config in the rare case both target the same
            // dep — the user is asking to ban it *now*, regardless of policy.
            config[name] = { reason: "banned via --ban CLI flag" };
        }

        if (Object.keys(config).length === 0 && options.bannedDeps && !quiet) {
            logger.warn("--banned-deps: no policy.bannedDeps in vis config, nothing to check.");
        }

        const issues = lintBannedDeps(instances, config);

        report.bannedDeps = issues;
        totalIssues += issues.length;
    }

    if (!quiet) {
        if (format === "json") {
            printJson(report, workspaceRoot, fixState, selection);
        } else if (format === "minimal") {
            printMinimal(report, workspaceRoot);
        } else {
            printHuman(report, workspaceRoot, fixState, selection, logger);
        }
    }

    if (totalIssues > 0) {
        process.exitCode = 1;
    }
};

export default execute as CommandExecute<Toolbox>;
