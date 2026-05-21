import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { bold, cyan, dim, green, red, yellow } from "@visulima/colorize";
import { isAccessibleSync, readJsonSync } from "@visulima/fs";
import { join, relative } from "@visulima/path";

import type { BannedDepIssue } from "../../lint/banned-deps";
import { lintBannedDeps } from "../../lint/banned-deps";
import type { CatalogProposal } from "../../lint/catalog-proposals";
import { applyCatalogProposals, proposeCatalogAdditions, renderCatalogProposalsDiff } from "../../lint/catalog-proposals";
import type { CustomTypeDriftIssue } from "../../lint/custom-types";
import { applyCustomTypeFixes, iterateCustomTypeDeps, lintCustomTypes, validateExtraTypes } from "../../lint/custom-types";
import type { DeadWorkspacePatternIssue } from "../../lint/dead-workspace-pattern";
import { applyDeadWorkspacePatternFixes, lintDeadWorkspacePatterns } from "../../lint/dead-workspace-pattern";
import type { EmptyDepsIssue } from "../../lint/empty-deps";
import { applyEmptyDepsFixes, lintEmptyDeps } from "../../lint/empty-deps";
import type { MissingPackageJsonIssue } from "../../lint/missing-package-json";
import { lintMissingPackageJson } from "../../lint/missing-package-json";
import type { RedefineRootIssue } from "../../lint/redefine-root";
import { lintRedefineRoot } from "../../lint/redefine-root";
import type { RootDepsIssue } from "../../lint/root-deps";
import { applyRootDepsFixes, lintRootDeps } from "../../lint/root-deps";
import type { RootPackageManagerIssue } from "../../lint/root-package-manager";
import { applyRootPackageManagerFixes, lintRootPackageManager } from "../../lint/root-package-manager";
import type { RootPrivateIssue } from "../../lint/root-private";
import { applyRootPrivateFixes, lintRootPrivate } from "../../lint/root-private";
import type { SimilarDepsIssue } from "../../lint/similar-deps";
import { lintSimilarDeps } from "../../lint/similar-deps";
import type { TypesInDepsIssue } from "../../lint/types-in-deps";
import { applyTypesInDepsFixes, lintTypesInDeps } from "../../lint/types-in-deps";
import type { WorkspaceProtocolIssue } from "../../lint/workspace-protocol";
import { applyWorkspaceProtocolFixes, lintWorkspaceProtocol } from "../../lint/workspace-protocol";
import type { WorkspaceVersionDriftIssue, WorkspaceVersionsResolveStrategy } from "../../lint/workspace-versions";
import { applyWorkspaceVersionsFixes, lintWorkspaceVersions } from "../../lint/workspace-versions";
import { readCatalogs } from "../../util/catalog";
import { iterateWorkspaceDeps } from "../../util/workspace-deps";
import type { LintOptions } from "./index";

/** True when the current root looks like a workspace (npm/yarn/bun `workspaces` or pnpm yaml). */
const detectWorkspaceConfig = (workspaceRoot: string): boolean => {
    if (isAccessibleSync(join(workspaceRoot, "pnpm-workspace.yaml"))) {
        return true;
    }

    const pkgPath = join(workspaceRoot, "package.json");

    if (!isAccessibleSync(pkgPath)) {
        return false;
    }

    try {
        const pkg = readJsonSync(pkgPath) as { workspaces?: unknown };

        return pkg.workspaces !== undefined;
    } catch {
        return false;
    }
};

interface LintReport {
    bannedDeps?: BannedDepIssue[];
    catalogProposals?: CatalogProposal[];
    customTypes?: CustomTypeDriftIssue[];
    deadWorkspacePatterns?: DeadWorkspacePatternIssue[];
    emptyDeps?: EmptyDepsIssue[];
    missingPackageJson?: MissingPackageJsonIssue[];
    redefineRoot?: RedefineRootIssue[];
    rootDeps?: RootDepsIssue[];
    rootPackageManager?: RootPackageManagerIssue[];
    rootPrivate?: RootPrivateIssue[];
    similarDeps?: SimilarDepsIssue[];
    typesInDeps?: TypesInDepsIssue[];
    workspaceProtocol?: WorkspaceProtocolIssue[];
    workspaceVersions?: WorkspaceVersionDriftIssue[];
}

interface LintSelection {
    bannedDeps: boolean;
    customTypes: boolean;
    deadWorkspacePatterns: boolean;
    emptyDeps: boolean;
    missingPackageJson: boolean;
    redefineRoot: boolean;
    rootDeps: boolean;
    rootPackageManager: boolean;
    rootPrivate: boolean;
    similarDeps: boolean;
    typesInDeps: boolean;
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
    customTypes: boolean;
    deadWorkspacePatterns: boolean;
    emptyDeps: boolean;
    rootDeps: boolean;
    rootPackageManager: boolean;
    rootPrivate: boolean;
    typesInDeps: boolean;
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

const printCustomTypesHuman = (issues: CustomTypeDriftIssue[], workspaceRoot: string, didFix: boolean, logger: Toolbox["logger"]): void => {
    if (issues.length === 0) {
        logger.info(green("✓ custom-types: no engines / packageManager / volta drift"));

        return;
    }

    const verb = didFix ? "Fixed" : "Found";
    const colour = didFix ? cyan : yellow;

    logger.info(colour(bold(`${verb} ${String(issues.length)} custom-type drift${issues.length === 1 ? "" : "s"}`)));

    // Group by `${customType} ${depName}` so e.g. "engines.node" and
    // "volta.node" stack under separate headings — they're independently
    // tracked pins, not the same drift cluster.
    for (const [key, keyIssues] of groupBy(issues, (i) => `${i.customType} ${i.depName}`)) {
        const canonical = (keyIssues[0] as CustomTypeDriftIssue).fix;
        const source = (keyIssues[0] as CustomTypeDriftIssue).canonicalSource;

        logger.info(`  ${bold(key)} ${dim(`canonical: ${canonical} (from ${source})`)}`);

        for (const issue of keyIssues) {
            const path = relative(workspaceRoot, issue.packageJsonPath);
            const packageKey = issue.packageName ?? path;
            const arrow = didFix ? cyan("→") : yellow("→");

            logger.info(`    ${packageKey} ${dim(`(${path})`)}: ${red(issue.specifier)} ${arrow} ${green(issue.fix)}`);
        }
    }

    if (!didFix) {
        logger.info(dim("  Run with --fix to align engines/packageManager/volta versions."));
    }
};

const printEmptyDepsHuman = (issues: EmptyDepsIssue[], workspaceRoot: string, didFix: boolean, logger: Toolbox["logger"]): void => {
    if (issues.length === 0) {
        logger.info(green("✓ empty-deps: no empty dependency blocks"));

        return;
    }

    const verb = didFix ? "Removed" : "Found";
    const colour = didFix ? cyan : yellow;

    logger.info(colour(bold(`${verb} ${String(issues.length)} empty dependency block${issues.length === 1 ? "" : "s"}`)));

    for (const [packageKey, packageIssues] of groupBy(issues, (i) => i.packageName ?? i.packageJsonPath)) {
        const path = relative(workspaceRoot, (packageIssues[0] as EmptyDepsIssue).packageJsonPath);

        logger.info(`  ${bold(packageKey)} ${dim(`(${path})`)}`);

        for (const issue of packageIssues) {
            logger.info(`    ${dim(issue.depType)}: ${red("{}")}`);
        }
    }

    if (!didFix) {
        logger.info(dim("  Run with --fix to drop empty blocks."));
    }
};

const printRootPrivateHuman = (issues: RootPrivateIssue[], workspaceRoot: string, didFix: boolean, logger: Toolbox["logger"]): void => {
    if (issues.length === 0) {
        logger.info(green("✓ root-private: root package.json is \"private\": true"));

        return;
    }

    const verb = didFix ? "Set" : "Missing";
    const colour = didFix ? cyan : red;

    for (const issue of issues) {
        const path = relative(workspaceRoot, issue.packageJsonPath);

        logger.info(colour(bold(`${verb} "private": true on root ${dim(`(${path})`)}`)));

        if (!didFix) {
            const seen = issue.rawValue === undefined ? "absent" : JSON.stringify(issue.rawValue);

            logger.info(`    ${dim("current:")} ${red(seen)}`);
        }
    }

    if (!didFix) {
        logger.info(dim("  Run with --fix to set \"private\": true."));
    }
};

const printRootPackageManagerHuman = (issues: RootPackageManagerIssue[], workspaceRoot: string, didFix: boolean, logger: Toolbox["logger"]): void => {
    if (issues.length === 0) {
        logger.info(green("✓ root-package-manager: packageManager field present"));

        return;
    }

    const verb = didFix ? "Set" : "Missing";
    const colour = didFix ? cyan : red;

    for (const issue of issues) {
        const path = relative(workspaceRoot, issue.packageJsonPath);

        logger.info(colour(bold(`${verb} packageManager on root ${dim(`(${path})`)}`)));

        if (!didFix && !issue.suggested) {
            logger.info(dim("    no canonical specifier configured (set policy.rootPackageManager.suggested to enable --fix)"));
        }
    }

    if (!didFix) {
        logger.info(dim("  e.g. \"packageManager\": \"pnpm@10.32.1\""));
    }
};

const printRootDepsHuman = (issues: RootDepsIssue[], workspaceRoot: string, didFix: boolean, logger: Toolbox["logger"]): void => {
    if (issues.length === 0) {
        logger.info(green("✓ root-deps: no runtime dependencies on private root"));

        return;
    }

    const verb = didFix ? "Moved" : "Found";
    const colour = didFix ? cyan : yellow;

    for (const issue of issues) {
        const path = relative(workspaceRoot, issue.packageJsonPath);

        logger.info(
            colour(bold(`${verb} ${String(issue.depNames.length)} runtime dep${issue.depNames.length === 1 ? "" : "s"} on private root ${dim(`(${path})`)}`)),
        );

        for (const name of issue.depNames) {
            logger.info(`    ${red(name)}`);
        }
    }

    if (!didFix) {
        logger.info(dim("  Run with --fix to move them to devDependencies."));
    }
};

const printMissingPackageJsonHuman = (issues: MissingPackageJsonIssue[], logger: Toolbox["logger"]): void => {
    if (issues.length === 0) {
        logger.info(green("✓ missing-package-json: every workspace dir has a package.json"));

        return;
    }

    logger.info(yellow(bold(`Found ${String(issues.length)} workspace dir${issues.length === 1 ? "" : "s"} without a package.json`)));

    for (const issue of issues) {
        logger.info(`    ${red(issue.packageDir)}`);
    }

    logger.info(dim("  Either delete the directory or scaffold a package.json (vis create)."));
};

const printDeadWorkspacePatternsHuman = (issues: DeadWorkspacePatternIssue[], didFix: boolean, logger: Toolbox["logger"]): void => {
    if (issues.length === 0) {
        logger.info(green("✓ dead-workspace-pattern: every workspace pattern matches at least one package"));

        return;
    }

    const verb = didFix ? "Removed" : "Found";
    const colour = didFix ? cyan : yellow;

    logger.info(colour(bold(`${verb} ${String(issues.length)} unmatched workspace pattern${issues.length === 1 ? "" : "s"}`)));

    for (const [source, group] of groupBy(issues, (i) => i.source)) {
        logger.info(`  ${bold(source)}`);

        for (const issue of group) {
            logger.info(`    ${red(issue.pattern)}`);
        }
    }

    if (!didFix) {
        logger.info(dim("  Run with --fix to drop dead patterns."));
    }
};

const printTypesInDepsHuman = (issues: TypesInDepsIssue[], workspaceRoot: string, didFix: boolean, logger: Toolbox["logger"]): void => {
    if (issues.length === 0) {
        logger.info(green("✓ types-in-deps: no @types/* in dependencies of private packages"));

        return;
    }

    const verb = didFix ? "Moved" : "Found";
    const colour = didFix ? cyan : yellow;

    logger.info(colour(bold(`${verb} ${String(issues.length)} @types/* dep${issues.length === 1 ? "" : "s"} in dependencies`)));

    for (const [packageKey, packageIssues] of groupBy(issues, (i) => i.packageName ?? i.packageJsonPath)) {
        const path = relative(workspaceRoot, (packageIssues[0] as TypesInDepsIssue).packageJsonPath);

        logger.info(`  ${bold(packageKey)} ${dim(`(${path})`)}`);

        for (const issue of packageIssues) {
            logger.info(`    ${red(issue.depName)} ${dim(issue.childSpecifier)}`);
        }
    }

    if (!didFix) {
        logger.info(dim("  Run with --fix to move them to devDependencies."));
    }
};

const printSimilarDepsHuman = (issues: SimilarDepsIssue[], workspaceRoot: string, logger: Toolbox["logger"]): void => {
    if (issues.length === 0) {
        logger.info(green("✓ similar-deps: every related dep family is in sync"));

        return;
    }

    logger.info(yellow(bold(`Found ${String(issues.length)} family${issues.length === 1 ? "" : " families"} with version drift`)));

    for (const issue of issues) {
        logger.info(`  ${bold(issue.familyLabel)} ${dim(`(${issue.specifiers.join(", ")})`)}`);

        for (const member of issue.members) {
            const path = relative(workspaceRoot, member.packageJsonPath);
            const packageKey = member.packageName ?? path;

            logger.info(`    ${packageKey} ${dim(`(${path})`)} ${dim(member.depType)}: ${red(member.depName)}@${yellow(member.specifier)}`);
        }
    }

    logger.info(dim("  Pick a single specifier per family and align by hand — auto-fix is unsafe across name boundaries."));
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

    if (selection.customTypes) {
        section(() => {
            printCustomTypesHuman(report.customTypes ?? [], workspaceRoot, fixState.customTypes, logger);
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

    if (selection.emptyDeps) {
        section(() => {
            printEmptyDepsHuman(report.emptyDeps ?? [], workspaceRoot, fixState.emptyDeps, logger);
        });
    }

    if (selection.rootPrivate) {
        section(() => {
            printRootPrivateHuman(report.rootPrivate ?? [], workspaceRoot, fixState.rootPrivate, logger);
        });
    }

    if (selection.rootPackageManager) {
        section(() => {
            printRootPackageManagerHuman(report.rootPackageManager ?? [], workspaceRoot, fixState.rootPackageManager, logger);
        });
    }

    if (selection.rootDeps) {
        section(() => {
            printRootDepsHuman(report.rootDeps ?? [], workspaceRoot, fixState.rootDeps, logger);
        });
    }

    if (selection.missingPackageJson) {
        section(() => {
            printMissingPackageJsonHuman(report.missingPackageJson ?? [], logger);
        });
    }

    if (selection.deadWorkspacePatterns) {
        section(() => {
            printDeadWorkspacePatternsHuman(report.deadWorkspacePatterns ?? [], fixState.deadWorkspacePatterns, logger);
        });
    }

    if (selection.typesInDeps) {
        section(() => {
            printTypesInDepsHuman(report.typesInDeps ?? [], workspaceRoot, fixState.typesInDeps, logger);
        });
    }

    if (selection.similarDeps) {
        section(() => {
            printSimilarDepsHuman(report.similarDeps ?? [], workspaceRoot, logger);
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

    for (const issue of report.customTypes ?? []) {
        const path = relative(workspaceRoot, issue.packageJsonPath);

        process.stdout.write(`custom-types\t${path}\t${issue.customType}\t${issue.depName}\t${issue.specifier} → ${issue.fix}\n`);
    }

    for (const issue of report.bannedDeps ?? []) {
        const path = relative(workspaceRoot, issue.packageJsonPath);

        process.stdout.write(`banned-deps\t${path}\t${issue.depType}\t${issue.depName}\t${issue.reason}\n`);
    }

    for (const proposal of report.catalogProposals ?? []) {
        process.stdout.write(`catalog-proposal\t${proposal.catalogName}\t${proposal.depName}\t${proposal.specifier}\t${String(proposal.instanceCount)}\n`);
    }

    for (const issue of report.emptyDeps ?? []) {
        const path = relative(workspaceRoot, issue.packageJsonPath);

        process.stdout.write(`empty-deps\t${path}\t${issue.depType}\n`);
    }

    for (const issue of report.rootPrivate ?? []) {
        const path = relative(workspaceRoot, issue.packageJsonPath);

        process.stdout.write(`root-private\t${path}\n`);
    }

    for (const issue of report.rootPackageManager ?? []) {
        const path = relative(workspaceRoot, issue.packageJsonPath);

        process.stdout.write(`root-package-manager\t${path}\t${issue.suggested ?? ""}\n`);
    }

    for (const issue of report.rootDeps ?? []) {
        const path = relative(workspaceRoot, issue.packageJsonPath);

        for (const name of issue.depNames) {
            process.stdout.write(`root-deps\t${path}\t${name}\n`);
        }
    }

    for (const issue of report.missingPackageJson ?? []) {
        process.stdout.write(`missing-package-json\t${issue.packageDir}\n`);
    }

    for (const issue of report.deadWorkspacePatterns ?? []) {
        process.stdout.write(`dead-workspace-pattern\t${issue.source}\t${issue.pattern}\n`);
    }

    for (const issue of report.typesInDeps ?? []) {
        const path = relative(workspaceRoot, issue.packageJsonPath);

        process.stdout.write(`types-in-deps\t${path}\t${issue.depName}\t${issue.childSpecifier}\n`);
    }

    for (const issue of report.similarDeps ?? []) {
        for (const member of issue.members) {
            const path = relative(workspaceRoot, member.packageJsonPath);

            process.stdout.write(`similar-deps\t${issue.family}\t${path}\t${member.depType}\t${member.depName}\t${member.specifier}\n`);
        }
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

    if (selection.customTypes) {
        const issues = (report.customTypes ?? []).map((i) => relativize(i));

        out.customTypes = { issues, total: issues.length };
    }

    if (selection.bannedDeps) {
        const issues = (report.bannedDeps ?? []).map((i) => relativize(i));

        out.bannedDeps = { issues, total: issues.length };
    }

    if (report.catalogProposals !== undefined) {
        const proposals = report.catalogProposals;

        out.catalogProposals = { proposals, total: proposals.length };
    }

    if (selection.emptyDeps) {
        const issues = (report.emptyDeps ?? []).map((i) => relativize(i));

        out.emptyDeps = { issues, total: issues.length };
    }

    if (selection.rootPrivate) {
        const issues = (report.rootPrivate ?? []).map((i) => relativize(i));

        out.rootPrivate = { issues, total: issues.length };
    }

    if (selection.rootPackageManager) {
        const issues = (report.rootPackageManager ?? []).map((i) => relativize(i));

        out.rootPackageManager = { issues, total: issues.length };
    }

    if (selection.rootDeps) {
        const issues = (report.rootDeps ?? []).map((i) => relativize(i));

        out.rootDeps = { issues, total: issues.length };
    }

    if (selection.missingPackageJson) {
        const issues = report.missingPackageJson ?? [];

        out.missingPackageJson = { issues, total: issues.length };
    }

    if (selection.deadWorkspacePatterns) {
        const issues = report.deadWorkspacePatterns ?? [];

        out.deadWorkspacePatterns = { issues, total: issues.length };
    }

    if (selection.typesInDeps) {
        const issues = (report.typesInDeps ?? []).map((i) => relativize(i));

        out.typesInDeps = { issues, total: issues.length };
    }

    if (selection.similarDeps) {
        const issues = (report.similarDeps ?? []).map((issue) => {
            return {
                ...issue,
                members: issue.members.map((member) => {
                    return { ...member, packageJsonPath: relative(workspaceRoot, member.packageJsonPath) };
                }),
            };
        });

        out.similarDeps = { issues, total: issues.length };
    }

    process.stdout.write(`${JSON.stringify(out, undefined, 2)}\n`);
};

/**
 * Cerebro converts `--workspace-protocol` to `options.workspaceProtocol`,
 * but unit tests sometimes hand the handler raw kebab-case keys to avoid
 * round-tripping through the CLI parser. Read both forms so neither
 * caller pays a translation tax.
 */
const flag = (options: Record<string, unknown>, camel: string, kebab: string): boolean => {
    const fromCamel = options[camel];

    if (typeof fromCamel === "boolean") {
        return fromCamel;
    }

    return options[kebab] === true;
};

const resolveSelection = (options: LintOptions): LintSelection => {
    const raw = options as unknown as Record<string, unknown>;
    // `--ban` / `--pin` implicitly target their respective lints, so users
    // can run a one-off check without also passing `--banned-deps` /
    // `--workspace-versions`.
    const hasBan = (options.ban?.length ?? 0) > 0;
    const hasPin = (options.pin?.length ?? 0) > 0;

    const workspaceProtocol = flag(raw, "workspaceProtocol", "workspace-protocol");
    const redefineRoot = flag(raw, "redefineRoot", "redefine-root");
    const bannedDeps = flag(raw, "bannedDeps", "banned-deps");
    const workspaceVersions = flag(raw, "workspaceVersions", "workspace-versions");
    const customTypes = flag(raw, "customTypes", "custom-types");
    const emptyDeps = flag(raw, "emptyDeps", "empty-deps");
    const rootPrivate = flag(raw, "rootPrivate", "root-private");
    const rootPackageManager = flag(raw, "rootPackageManager", "root-package-manager");
    const rootDeps = flag(raw, "rootDeps", "root-deps");
    const missingPackageJson = flag(raw, "missingPackageJson", "missing-package-json");
    const deadWorkspacePatterns = flag(raw, "deadWorkspacePatterns", "dead-workspace-patterns");
    const typesInDeps = flag(raw, "typesInDeps", "types-in-deps");
    const similarDeps = flag(raw, "similarDeps", "similar-deps");

    // Prettier reflows this chain to trailing operators with an 8-space
    // continuation indent; @stylistic/indent-binary-ops expects 12 (one indent
    // past `const anySelected`). Leading `||` plus the manual indent is the form
    // both tools agree on once prettier leaves it alone.
    // prettier-ignore
    const anySelected
        = workspaceProtocol
            || redefineRoot
            || bannedDeps
            || workspaceVersions
            || customTypes
            || emptyDeps
            || rootPrivate
            || rootPackageManager
            || rootDeps
            || missingPackageJson
            || deadWorkspacePatterns
            || typesInDeps
            || similarDeps
            || hasBan
            || hasPin;

    if (!anySelected) {
        return {
            bannedDeps: true,
            customTypes: true,
            deadWorkspacePatterns: true,
            emptyDeps: true,
            missingPackageJson: true,
            redefineRoot: true,
            rootDeps: true,
            rootPackageManager: true,
            rootPrivate: true,
            similarDeps: true,
            typesInDeps: true,
            workspaceProtocol: true,
            workspaceVersions: true,
        };
    }

    return {
        bannedDeps: bannedDeps || hasBan,
        customTypes,
        deadWorkspacePatterns,
        emptyDeps,
        missingPackageJson,
        redefineRoot,
        rootDeps,
        rootPackageManager,
        rootPrivate,
        similarDeps,
        typesInDeps,
        workspaceProtocol,
        workspaceVersions: workspaceVersions || hasPin,
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
const AUTOFIX_CONFIG_PATHS: Record<"custom-types" | "workspace-protocol" | "workspace-versions", string> = {
    "custom-types": "policy.customTypes.autofix",
    "workspace-protocol": "policy.workspaceProtocol.autofix",
    "workspace-versions": "policy.workspaceVersions.autofix",
};

const warnAutofixDenied = (
    logger: Toolbox["logger"],
    rule: "custom-types" | "workspace-protocol" | "workspace-versions",
    autofix: "prompt" | boolean | undefined,
    issueCount: number,
): void => {
    const configPath = AUTOFIX_CONFIG_PATHS[rule];
    const reason = autofix === "prompt" ? `${configPath} = "prompt" (interactive mode not yet implemented; report-only)` : `${configPath} = false`;
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
    const useEditorconfig = visConfig?.editorconfig ?? true;
    const pinned = parsePinFlags(options.pin);
    const bans = options.ban ?? [];

    if ((options.dep !== undefined || options.resolve !== undefined) && !selection.workspaceVersions && !quiet) {
        logger.warn("--dep / --resolve only apply to --workspace-versions; ignored.");
    }

    const instances = iterateWorkspaceDeps(workspaceRoot);
    const report: LintReport = {};
    const fixState: FixState = {
        catalogProposals: false,
        customTypes: false,
        deadWorkspacePatterns: false,
        emptyDeps: false,
        rootDeps: false,
        rootPackageManager: false,
        rootPrivate: false,
        typesInDeps: false,
        workspaceProtocol: false,
        workspaceVersions: false,
    };
    const hasWorkspaceConfig = detectWorkspaceConfig(workspaceRoot);
    let totalIssues = 0;

    if (selection.workspaceProtocol) {
        const issues = lintWorkspaceProtocol(instances, { fixSpecifier: options.fixSpecifier });
        const autofixAllowed = isAutofixAllowed(fix, policy.workspaceProtocol?.autofix);

        if (autofixAllowed && issues.length > 0) {
            applyWorkspaceProtocolFixes(issues, { useEditorconfig });
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
            applyWorkspaceVersionsFixes(issues, { useEditorconfig });
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

    if (selection.customTypes) {
        const extraTypes = policy.customTypes?.extraTypes;
        const extraErrors = validateExtraTypes(extraTypes);

        if (extraErrors.length > 0) {
            for (const message of extraErrors) {
                logger.error(`policy.customTypes.${message}`);
            }

            process.exitCode = 1;

            return;
        }

        const customInstances = iterateCustomTypeDeps(workspaceRoot, extraTypes);
        // Custom-type pins (engines.node, packageManager, volta.*) only ever
        // hold semver versions — `--resolve catalog` is meaningless here, so
        // fall back to highest if a workspace-versions catalog mode bled in.
        const requestedResolve = options.resolve ?? policy.customTypes?.resolve;
        const resolve = requestedResolve === "lowest" ? "lowest" : "highest";

        const issues = lintCustomTypes(customInstances, {
            dep: options.dep,
            ignoreDeps: policy.customTypes?.ignore,
            resolve,
        });

        const autofixAllowed = isAutofixAllowed(fix, policy.customTypes?.autofix);

        if (autofixAllowed && issues.length > 0) {
            applyCustomTypeFixes(issues, { useEditorconfig });
            fixState.customTypes = true;
        }

        report.customTypes = issues;

        if (!autofixAllowed) {
            totalIssues += issues.length;
        }

        if (fix && !autofixAllowed && issues.length > 0 && !quiet) {
            warnAutofixDenied(logger, "custom-types", policy.customTypes?.autofix, issues.length);
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

    if (selection.emptyDeps) {
        const issues = lintEmptyDeps(workspaceRoot, { ignoreBlocks: policy.emptyDeps?.ignoreBlocks });
        const autofixAllowed = isAutofixAllowed(fix, policy.emptyDeps?.autofix);

        if (autofixAllowed && issues.length > 0) {
            applyEmptyDepsFixes(issues, { useEditorconfig });
            fixState.emptyDeps = true;
        }

        report.emptyDeps = issues;

        if (!autofixAllowed) {
            totalIssues += issues.length;
        }
    }

    if (selection.rootPrivate) {
        const issues = lintRootPrivate(workspaceRoot, hasWorkspaceConfig);
        const autofixAllowed = isAutofixAllowed(fix, policy.rootPrivate?.autofix);

        if (autofixAllowed && issues.length > 0) {
            applyRootPrivateFixes(issues, { useEditorconfig });
            fixState.rootPrivate = true;
        }

        report.rootPrivate = issues;

        if (!autofixAllowed) {
            totalIssues += issues.length;
        }
    }

    if (selection.rootPackageManager) {
        const issues = lintRootPackageManager(workspaceRoot, hasWorkspaceConfig, { suggested: policy.rootPackageManager?.suggested });
        const autofixAllowed = isAutofixAllowed(fix, policy.rootPackageManager?.autofix);

        if (autofixAllowed && issues.some((i) => i.suggested !== undefined)) {
            applyRootPackageManagerFixes(issues, { useEditorconfig });
            fixState.rootPackageManager = true;
        }

        report.rootPackageManager = issues;

        // Only the unfixable issues fail CI when fix ran — fixed ones already wrote.
        if (!autofixAllowed || !fixState.rootPackageManager) {
            totalIssues += issues.filter((i) => i.suggested === undefined || !fixState.rootPackageManager).length;
        }
    }

    if (selection.rootDeps) {
        const issues = lintRootDeps(workspaceRoot, hasWorkspaceConfig);
        const autofixAllowed = isAutofixAllowed(fix, policy.rootDeps?.autofix);

        if (autofixAllowed && issues.length > 0) {
            applyRootDepsFixes(issues, { useEditorconfig });
            fixState.rootDeps = true;
        }

        report.rootDeps = issues;

        if (!autofixAllowed) {
            totalIssues += issues.length;
        }
    }

    if (selection.missingPackageJson) {
        const issues = lintMissingPackageJson(workspaceRoot);

        report.missingPackageJson = issues;
        totalIssues += issues.length;
    }

    if (selection.deadWorkspacePatterns) {
        const issues = lintDeadWorkspacePatterns(workspaceRoot);
        const autofixAllowed = isAutofixAllowed(fix, policy.deadWorkspacePatterns?.autofix);

        if (autofixAllowed && issues.length > 0) {
            applyDeadWorkspacePatternFixes(issues, { useEditorconfig });
            fixState.deadWorkspacePatterns = true;
        }

        report.deadWorkspacePatterns = issues;

        if (!autofixAllowed) {
            totalIssues += issues.length;
        }
    }

    if (selection.typesInDeps) {
        const issues = lintTypesInDeps(instances, { ignoreDeps: policy.typesInDeps?.ignore });
        const autofixAllowed = isAutofixAllowed(fix, policy.typesInDeps?.autofix);

        if (autofixAllowed && issues.length > 0) {
            applyTypesInDepsFixes(issues, { useEditorconfig });
            fixState.typesInDeps = true;
        }

        report.typesInDeps = issues;

        if (!autofixAllowed) {
            totalIssues += issues.length;
        }
    }

    if (selection.similarDeps) {
        const issues = lintSimilarDeps(instances, {
            extraFamilies: policy.similarDeps?.extraFamilies,
            ignoreFamilies: policy.similarDeps?.ignoreFamilies,
        });

        report.similarDeps = issues;
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
