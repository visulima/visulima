/**
 * `vis release check` — gate command for husky / lint-staged / CI.
 *
 * Default mode: passes if at least one change file exists.
 * Strict mode: every workspace package whose source files changed (relative
 * to `release.baseBranch`) must be covered by an explicit change-file bump.
 *
 * `--no-fail` keeps exit code 0 — warnings still go to stderr.
 */

import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { DEFAULT_CHANGES_DIR } from "../../../release/config";
import { collectExplicitBumps } from "../../../release/core/change-file";
import { readChangeFiles } from "../../../release/core/change-file-reader";
import { buildContext } from "../../../release/core/orchestrator";
import { createShellRunner } from "../../../release/core/shell-runner";
import type { ReleaseCheckOptions } from "./index";

const execute = async ({ logger, options, workspaceRoot }: Toolbox<Console, ReleaseCheckOptions>): Promise<void> => {
    const cwd = workspaceRoot ?? process.cwd();
    const noFail = options.noFail === true;
    const strict = options.strict === true;

    const ctx = await buildContext({ cwd });

    const { printConfigIfRequested } = await import("../../../release/core/print-config");

    if (printConfigIfRequested(options, ctx, logger)) {
        return;
    }

    const { files: changeFiles } = await readChangeFiles({ changesDir: ctx.config.changesDir, cwd });

    if (changeFiles.length === 0) {
        if (strict) {
            logger.error("No change files present and --strict is set.");
            logger.error(`Run \`vis release add\` to author one in ${ctx.config.changesDir ?? DEFAULT_CHANGES_DIR}.`);
            process.exitCode = noFail ? 0 : 1;
        } else {
            logger.warn("No change files present. PR will not produce a release.");
            process.exitCode = 0;
        }

        return;
    }

    if (!strict) {
        logger.info(`${changeFiles.length} change file(s) present. ✓`);
        process.exitCode = 0;

        return;
    }

    // Strict mode: detect changed packages via git diff vs baseBranch and
    // verify each is covered by an explicit bump.
    const baseBranch = ctx.config.baseBranch ?? "main";
    const runner = createShellRunner();

    const diffResult = await runner.run("git", ["diff", "--name-only", `${baseBranch}...HEAD`], { cwd, silent: true });

    if (diffResult.exitCode !== 0) {
        logger.warn(`Could not run git diff vs ${baseBranch}: ${diffResult.stderr}`);
        // In CI/PR contexts the baseBranch may not be fetched. Soft-pass.
        process.exitCode = 0;

        return;
    }

    const allChangedFiles = diffResult.stdout
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

    if (allChangedFiles.length === 0) {
        logger.info("No source files changed. ✓");
        process.exitCode = 0;

        return;
    }

    // Honor `changedFilePatterns` (root + per-pkg). Per-pkg replaces root
    // entirely (matches bumpy's semantics — RFC §8.1).
    const { default: zeptomatch } = await import("zeptomatch");
    const rootPatterns = ctx.config.changedFilePatterns ?? ["**"];

    const matchesPatterns = (file: string, pkgRel: string, patterns: string[]): boolean => {
        // file is workspace-relative (e.g. "packages/a/src/index.ts").
        // patterns are package-relative (e.g. "src/**").
        if (!file.startsWith(`${pkgRel}/`)) {
            return false;
        }

        const fileRelToPkg = file.slice(pkgRel.length + 1);

        return patterns.some((p) => zeptomatch(p, fileRelToPkg));
    };

    // Map each changed file to its owning package by directory prefix,
    // then filter via changedFilePatterns.
    const explicitlyBumped = new Set(collectExplicitBumps(changeFiles).keys());
    const uncoveredPackages = new Set<string>();

    for (const file of allChangedFiles) {
        const owningPackage = ctx.packages.find((p) => {
            const relative = p.dir.startsWith(cwd) ? p.dir.slice(cwd.length).replace(/^[/\\]/, "") : p.dir;

            return file === `${relative}/package.json` || file.startsWith(`${relative}/`);
        });

        // additionalPaths (release-please #1921): a file may be claimed
        // by any number of packages via workspace-root-relative globs in
        // `packages.<name>.additionalPaths`. Multiple packages can claim
        // the same file (e.g. a shared docs/ tree referenced by every
        // CLI package); each one gets the uncovered attribution. This
        // walk is unconditional — the owning-package attribution (if
        // any) is additive, not exclusive — otherwise a file living
        // inside one package's directory could never be cross-attributed
        // to a sibling that explicitly globs for it (silent stale-asset
        // risk).
        for (const candidate of ctx.packages) {
            const additionalPaths = ctx.perPackageConfig.get(candidate.name)?.additionalPaths;

            if (!additionalPaths || additionalPaths.length === 0) {
                continue;
            }

            if (additionalPaths.some((pattern) => zeptomatch(pattern, file)) && !explicitlyBumped.has(candidate.name)) {
                uncoveredPackages.add(candidate.name);
            }
        }

        if (!owningPackage) {
            continue;
        }

        const pkgRel = owningPackage.dir.startsWith(cwd) ? owningPackage.dir.slice(cwd.length).replace(/^[/\\]/, "") : owningPackage.dir;
        const perPkgPatterns = ctx.perPackageConfig.get(owningPackage.name)?.changedFilePatterns;
        const patterns = perPkgPatterns ?? rootPatterns;

        // package.json edits always count
        const isPkgJson = file === `${pkgRel}/package.json`;

        if (!isPkgJson && !matchesPatterns(file, pkgRel, patterns)) {
            continue;
        }

        if (!explicitlyBumped.has(owningPackage.name)) {
            uncoveredPackages.add(owningPackage.name);
        }
    }

    if (uncoveredPackages.size > 0) {
        logger.error(`The following packages have changes but no covering change file:`);

        for (const name of uncoveredPackages) {
            logger.error(`  - ${name}`);
        }

        logger.error(`Run \`vis release add\` to author one.`);

        process.exitCode = noFail ? 0 : 1;

        return;
    }

    logger.info(`${changeFiles.length} change file(s); ${allChangedFiles.length} changed file(s) all covered. ✓`);
    process.exitCode = 0;
};

export default execute as CommandExecute<Toolbox>;
