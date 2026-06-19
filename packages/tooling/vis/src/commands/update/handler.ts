import { createInterface } from "node:readline";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { red, yellow } from "@visulima/colorize";
import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { readTomlSync } from "@visulima/fs/toml";
import { readYamlSync } from "@visulima/fs/yaml";
import { findPackageManagerSync, getPackageManagerVersion } from "@visulima/package";
import { join } from "@visulima/path";
import { render, renderToString } from "@visulima/tui";
import { Text } from "@visulima/tui/components/text";
import isInCi from "is-in-ci";
import React from "react";

import type { AiAnalysisResult } from "../../ai/ai-analysis";
import { formatAiAnalysis, runAiAnalysis, validateAnalysisType } from "../../ai/ai-analysis";
import type { VisConfig } from "../../config/workspace";
import type { UpdateCommandOptions } from "../../pm/package-manager";
import { resolveUpdateCommand } from "../../pm/package-manager";
import { resolveInstaller } from "../../pm/pm-runner";
import { resolveCommandRuntime, runtimeInstallerBackend } from "../../runtime/command-runtime";
import { presentMarshallFindings } from "../../security/marshalls/decision-prompt";
import { runMarshallPipeline } from "../../security/marshalls/pipeline";
import { isMarshallDisabled } from "../../security/marshalls/registry";
import { resolveExplicitPackages } from "../../security/marshalls/resolve-explicit";
import { syncMinimumReleaseAgeToNativeConfig } from "../../security/min-release-age";
import { buildEnabledProviders } from "../../security/registry";
import { scoreColor } from "../../security/socket-security";
import { runTyposquatCheck, scanDepsForTyposquats } from "../../security/typosquats";
import CheckProgressApp from "../../tui/components/check-progress-app";
import { ecosystemEntryKey, UpdateStore } from "../../tui/components/update/update-store";
import VisUpdateApp from "../../tui/components/update/vis-update-app";
import type { CatalogCheckOptions, NpmrcConfig, OutdatedEntry, UpdateTarget } from "../../util/catalog";
import {
    applyCatalogUpdates,
    checkOutdated,
    collectInternalOutdated,
    fetchChangelogInfo,
    formatOutdatedJson,
    formatOutdatedMinimal,
    formatOutdatedTable,
    formatSummary,
    hasBackup,
    hasCatalogs,
    loadNpmrc,
    promptPackageSelection,
    readCatalogs,
    restoreFromBackup,
    toFilterArray,
} from "../../util/catalog";
import { hasPeerDependencyWarnings, PEER_HINT } from "../../util/peer-warnings";
import { spawnTee } from "../../util/spawn-tee";
import { parsePackageArgument } from "../../util/utils";
import type { EcosystemCheckResult, EcosystemId, EcosystemUpdate, EcosystemUpdateOptions, EcosystemUpdateType } from "./ecosystems/index";
import { applyEcosystemUpdates, checkEcosystems } from "./ecosystems/index";
import { promptEcosystemSelection } from "./ecosystems/prompt";
import { formatEcosystemJson, formatEcosystemReport } from "./ecosystems/report";
import type { UpdateOptions } from "./index";

type CatalogPackageManager = "bun" | "npm" | "pnpm" | "yarn";
type FilterOption = string | string[] | undefined;

interface PmNativeMinimumReleaseAge {
    /**
     * Package names/patterns exempt from the minimum-release-age check.
     * pnpm spells this `minimumReleaseAgeExclude` (singular) under
     * `pnpm-workspace.yaml`; bun spells it `minimumReleaseAgeExcludes`
     * (plural) under `bunfig.toml [install]`. We normalise to the
     * vis-internal singular shape.
     */
    excludes?: string[];
    /** Value in minutes; undefined when the PM-native config doesn't pin it. */
    minutes?: number;
}

/**
 * Parses a time string (e.g. `"2d"`, `"48h"`, `"15m"`, `"1w"`) into minutes.
 * Supports `m` (minutes), `h` (hours), `d` (days), `w` (weeks). Bare numbers
 * fall back to minutes for forgiving config (e.g. `min-release-age=2880`).
 * Returns `undefined` for malformed input so callers can ignore corrupt config.
 */
export const parseTimeStringToMinutes = (input: string): number | undefined => {
    const trimmed = input.trim();

    if (trimmed === "") {
        return undefined;
    }

    const match = /^(\d+(?:\.\d+)?)\s*([mhdw])?$/i.exec(trimmed);

    if (!match) {
        return undefined;
    }

    const value = Number.parseFloat(match[1]!);

    if (!Number.isFinite(value) || value < 0) {
        return undefined;
    }

    switch ((match[2] ?? "m").toLowerCase()) {
        case "d": {
            return value * 60 * 24;
        }
        case "h": {
            return value * 60;
        }
        case "m": {
            return value;
        }
        case "w": {
            return value * 60 * 24 * 7;
        }
        default: {
            return undefined;
        }
    }
};

/**
 * Parses a `.npmrc` `min-release-age` value into minutes. npm's CLI defines
 * this option as `null or Number` measured in **days**, so a bare integer
 * like `"1"` means one day — not one minute. Legacy `Nd`/`Nh`/`Nm` strings
 * (older vis writes and hand-edits) still fall back to `parseTimeStringToMinutes`
 * for forgiving drift comparison until `vis security sync` rewrites them.
 */
export const parseNpmReleaseAgeValue = (raw: string): number | undefined => {
    const trimmed = raw.trim();

    if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
        return Number.parseFloat(trimmed) * 1440;
    }

    return parseTimeStringToMinutes(trimmed);
};

/**
 * Inverse of `parseTimeStringToMinutes`: renders a minutes count as the
 * largest whole-unit time string (`Nd`/`Nh`/`Nm`). Used when writing to npm /
 * yarn configs that expect duration strings.
 */
export const formatMinutesAsTimeString = (minutes: number): string => {
    if (!Number.isFinite(minutes) || minutes <= 0) {
        return "0m";
    }

    if (minutes % (60 * 24) === 0) {
        return `${String(minutes / (60 * 24))}d`;
    }

    if (minutes % 60 === 0) {
        return `${String(minutes / 60)}h`;
    }

    return `${String(minutes)}m`;
};

/**
 * Reads `minimumReleaseAge` (and the excludes list) from the package
 * manager's native config. Returns an object with both fields so callers
 * can merge them into vis-config defaults uniformly.
 *
 * Per-PM mapping (all returned values normalised to **minutes** — the
 * vis-internal canonical unit):
 *
 * - pnpm: `pnpm-workspace.yaml` top-level — value already in minutes.
 * - bun: `bunfig.toml [install]` — value in **seconds**, divided by 60.
 *   Bun's installer knobs (registry, scopes, lockfile, minimumReleaseAge, …)
 *   all live under `[install]` per https://bun.sh/docs/runtime/bunfig#install.
 * - npm: `.npmrc` `min-release-age=&lt;integer>` — npm's option type is
 *   `null or Number` measured in **days**, so a bare integer maps to days × 1440
 *   minutes. Legacy `Nd`/`Nh`/`Nm` strings from earlier vis releases or hand-
 *   edits are still accepted via `parseNpmReleaseAgeValue` for forgiving drift
 *   comparison, but npm itself would `parseInt` those (silently misreading
 *   `48h` as 48 *days*).
 * - yarn: `.yarnrc.yml` `npmMinimalAgeGate: &lt;minutes>` — yarn's docs spell
 *   this as a duration string but yarnpkg/berry#6991 makes day suffixes parse
 *   as minutes. Vis writes a bare integer in minutes to dodge the bug. We
 *   still accept duration strings on read for back-compat.
 */
export const readPmNativeMinimumReleaseAge = (workspaceRoot: string, packageManager: string): PmNativeMinimumReleaseAge => {
    try {
        switch (packageManager) {
            case "bun": {
                const tomlPath = join(workspaceRoot, "bunfig.toml");

                if (isAccessibleSync(tomlPath)) {
                    const data = readTomlSync(tomlPath) as
                        | {
                            install?: {
                                minimumReleaseAge?: number;
                                minimumReleaseAgeExcludes?: string[];
                            };
                        }
                        | undefined;
                    const rawSeconds = data?.install?.minimumReleaseAge;

                    return {
                        excludes: Array.isArray(data?.install?.minimumReleaseAgeExcludes) ? data.install.minimumReleaseAgeExcludes : undefined,
                        // Bun stores seconds; vis canonicalises on minutes.
                        minutes: typeof rawSeconds === "number" ? Math.round(rawSeconds / 60) : undefined,
                    };
                }

                break;
            }

            case "npm": {
                const npmrcPath = join(workspaceRoot, ".npmrc");

                if (isAccessibleSync(npmrcPath)) {
                    const content = readFileSync(npmrcPath);
                    const match = /^\s*min-release-age\s*=\s*([^\s#;]+)/m.exec(content);

                    return { minutes: match ? parseNpmReleaseAgeValue(match[1]!) : undefined };
                }

                break;
            }

            case "pnpm": {
                const yamlPath = join(workspaceRoot, "pnpm-workspace.yaml");

                if (isAccessibleSync(yamlPath)) {
                    const data = readYamlSync(yamlPath) as
                        | {
                            minimumReleaseAge?: number;
                            minimumReleaseAgeExclude?: string[];
                        }
                        | undefined;

                    return {
                        excludes: Array.isArray(data?.minimumReleaseAgeExclude) ? data.minimumReleaseAgeExclude : undefined,
                        minutes: typeof data?.minimumReleaseAge === "number" ? data.minimumReleaseAge : undefined,
                    };
                }

                break;
            }

            case "yarn": {
                const yarnrcPath = join(workspaceRoot, ".yarnrc.yml");

                if (isAccessibleSync(yarnrcPath)) {
                    const data = readYamlSync(yarnrcPath) as
                        | {
                            npmMinimalAgeGate?: number | string;
                            npmPreapprovedPackages?: string[];
                        }
                        | undefined;
                    const raw = data?.npmMinimalAgeGate;
                    // yarn's native exclude list — names/globs exempt from the
                    // age gate. Read it so merges stay additive (a destructive
                    // rewrite would drop pre-existing preapprovals).
                    const excludes = Array.isArray(data?.npmPreapprovedPackages) ? data.npmPreapprovedPackages : undefined;

                    if (typeof raw === "string") {
                        return { excludes, minutes: parseTimeStringToMinutes(raw) };
                    }

                    if (typeof raw === "number") {
                        // Bare numeric value in .yarnrc.yml — yarn's docs use a
                        // string like "48h", but a teammate may have written a
                        // raw number. Treat it as minutes for symmetry with pnpm.
                        return { excludes, minutes: raw };
                    }
                }

                break;
            }

            default: {
                break;
            }
        }
    } catch {
        // Non-critical: if parsing fails, skip the sync check.
    }

    return {};
};

/**
 * Result of {@link addReleaseAgeExcludesForInstall}.
 *
 * - `added` — package names newly written to the PM's native exclude list.
 * - `unsupported` — `true` only when a native gate is active but the package
 *   manager has **no per-package exclude list** (npm). Lets the caller print a
 *   targeted "npm can't do this" hint instead of silently doing nothing.
 */
interface ReleaseAgeExcludeResult {
    added: string[];
    unsupported: boolean;
}

/** Package managers whose native config exposes a per-package age-gate exclude list. */
const PM_EXCLUDE_FIELD: Partial<Record<string, string>> = {
    bun: "minimumReleaseAgeExcludes",
    pnpm: "minimumReleaseAgeExclude",
    yarn: "npmPreapprovedPackages",
};

/** Native config file each package manager stores its release-age gate in (for user-facing messages). */
const RELEASE_AGE_CONFIG_FILE: Partial<Record<string, string>> = {
    bun: "bunfig.toml minimumReleaseAgeExcludes",
    npm: ".npmrc",
    pnpm: "pnpm-workspace.yaml minimumReleaseAgeExclude",
    yarn: ".yarnrc.yml npmPreapprovedPackages",
};

/**
 * `--ignore-release-age` selects versions that may be younger than the package
 * manager's own release-age gate, so the follow-up install would reject exactly
 * the versions vis just chose. Add the just-updated package names to the PM's
 * native exclude list — preserving the global gate for every other package — so
 * the install proceeds.
 *
 * Per-PM exclude list (all written by {@link syncMinimumReleaseAgeToNativeConfig}):
 *
 * - **pnpm** → `pnpm-workspace.yaml` `minimumReleaseAgeExclude`
 * - **bun** → `bunfig.toml [install]` `minimumReleaseAgeExcludes`
 * - **yarn** (berry) → `.yarnrc.yml` `npmPreapprovedPackages`
 * - **npm** → no per-package exclude list exists; returns `{ unsupported: true }`
 *   when a gate is active so the caller can advise the user instead.
 *
 * No-op (returns `{ added: [], unsupported: false }`) when the PM has no native
 * gate (value unset or `0`) or when every name is already excluded.
 */
export const addReleaseAgeExcludesForInstall = (packageManager: string, workspaceRoot: string, packageNames: string[]): ReleaseAgeExcludeResult => {
    const native = readPmNativeMinimumReleaseAge(workspaceRoot, packageManager);

    // No active gate → nothing would block the install; nothing to do.
    if (typeof native.minutes !== "number" || native.minutes <= 0) {
        return { added: [], unsupported: false };
    }

    if (!(packageManager in PM_EXCLUDE_FIELD)) {
        // A gate is active but this PM (npm) has no per-package exclude list.
        return { added: [], unsupported: true };
    }

    const existing = native.excludes ?? [];
    const toAdd = [...new Set(packageNames)].filter((name) => !existing.includes(name));

    if (toAdd.length === 0) {
        return { added: [], unsupported: false };
    }

    syncMinimumReleaseAgeToNativeConfig(packageManager as "bun" | "pnpm" | "yarn", workspaceRoot, native.minutes, [...existing, ...toAdd]);

    return { added: toAdd, unsupported: false };
};

/**
 * Reports the outcome of {@link addReleaseAgeExcludesForInstall}: an info line
 * naming the packages exempted, or a warning when the active gate belongs to a
 * package manager (npm) without a per-package exclude list. No output when there
 * was nothing to do.
 */
const reportReleaseAgeExcludes = (logger: Console, packageManager: string, result: ReleaseAgeExcludeResult): void => {
    if (result.added.length > 0) {
        logger.info(
            `Added ${String(result.added.length)} package${result.added.length === 1 ? "" : "s"} to ${RELEASE_AGE_CONFIG_FILE[packageManager] ?? "the package manager config"} `
            + `so --ignore-release-age versions install: ${result.added.join(", ")}`,
        );
    } else if (result.unsupported) {
        logger.warn(
            `${yellow("⚠")} npm has no per-package release-age exclude list, so vis can't exempt just the selected packages. `
            + `Lower min-release-age in .npmrc or pass --min-release-age=0 to the install.`,
        );
    }
};

const buildCatalogCheckOptions = (
    options: Record<string, unknown>,
    configDefaults: NonNullable<VisConfig["update"]>,
    argument: string[],
): CatalogCheckOptions => {
    const target = (options.latest as boolean) ? "latest" : ((options.target as string) ?? configDefaults.target ?? "latest");

    if (!["latest", "minor", "patch"].includes(target)) {
        throw new Error(`Invalid target "${target}". Use: latest, minor, or patch.`);
    }

    const maxConcurrentRequestsFlag = options.maxConcurrentRequests;
    const maxConcurrentRequests
        = typeof maxConcurrentRequestsFlag === "number" && maxConcurrentRequestsFlag > 0 ? maxConcurrentRequestsFlag : configDefaults.maxConcurrentRequests;

    const releaseChannelFlag = typeof options.releaseChannel === "string" ? options.releaseChannel.toLowerCase() : undefined;

    if (releaseChannelFlag !== undefined && !["any", "same", "stable"].includes(releaseChannelFlag)) {
        throw new Error(`Invalid --release-channel "${String(options.releaseChannel)}". Use: any, same, or stable.`);
    }

    const releaseChannel = (releaseChannelFlag ?? configDefaults.releaseChannel) as "any" | "same" | "stable" | undefined;

    return {
        exclude: [...toFilterArray(options.exclude as FilterOption), ...toFilterArray(configDefaults.exclude)],
        ignore: toFilterArray(configDefaults.ignore),
        include: [...toFilterArray(options.include as FilterOption), ...toFilterArray(configDefaults.include), ...argument],
        includeLocked: (options.includeLocked as boolean) || configDefaults.includeLocked || false,
        includePrerelease: (options.prerelease as boolean) || configDefaults.prerelease || false,
        maxConcurrentRequests,
        minimumReleaseAge: configDefaults.minimumReleaseAge,
        minimumReleaseAgeExclude: configDefaults.minimumReleaseAgeExclude,
        packageMode: configDefaults.packageMode,
        releaseChannel,
        // `--security` is on by default; `--no-security` (security === false) is an explicit opt-out.
        // `--ai` forces it on (AI analysis needs the vuln data); config may disable it when the flag is unset.
        security: (options.security as boolean | undefined) === false ? false : (options.ai as boolean) || (configDefaults.security ?? true),
        target: target as UpdateTarget,
    };
};

const logFilteredByTarget = (entries: OutdatedEntry[], logger: Console): void => {
    if (entries.length === 0) {
        return;
    }

    logger.info(
        `\n${yellow("⚠")} ${String(entries.length)} package${entries.length === 1 ? "" : "s"} skipped by target constraint (use --target latest to include):`,
    );

    for (const entry of entries) {
        logger.info(`    ${entry.packageName}  ${entry.currentRange} → ${entry.newRange}  (${entry.updateType})`);
    }
};

const writeFormattedOutput = (entries: OutdatedEntry[], failed: string[], format: string, logger: Console, scoreMinimum?: number): void => {
    if (format === "json") {
        process.stdout.write(`${formatOutdatedJson({ checkedCount: 0, failed, filteredByTarget: [], ignored: [], outdated: entries })}\n`);
    } else if (format === "minimal") {
        process.stdout.write(`${formatOutdatedMinimal(entries)}\n`);
    } else {
        formatOutdatedTable(entries, logger);
        logger.info(formatSummary(entries, scoreMinimum));
    }
};

const applyCatalogAndInstall = async (
    workspaceRoot: string,
    packageManager: CatalogPackageManager,
    toApply: OutdatedEntry[],
    options: Record<string, unknown>,
    logger: Console,
    npmrcConfig?: NpmrcConfig,
    useEditorconfig?: boolean,
): Promise<void> => {
    const backupPath = applyCatalogUpdates(workspaceRoot, toApply, packageManager, true, { useEditorconfig });
    const targetFile = packageManager === "pnpm" ? "pnpm-workspace.yaml" : "package.json";

    logger.info(`\nUpdated ${targetFile}`);

    if (backupPath) {
        logger.info(`Backup saved to ${backupPath}`);
    }

    if (options.changelog) {
        logger.info("\nFetching changelogs...");

        const changelogs = await fetchChangelogInfo(toApply, undefined, npmrcConfig);

        for (const info of changelogs) {
            const url = info.releaseUrl ?? info.repoUrl ?? info.npmUrl;

            logger.info(`  ${info.packageName}: ${url}`);
        }
    }

    // --ignore-release-age picked versions that may be younger than the package
    // manager's own release-age gate (pnpm/bun in catalog mode). Left as-is, the
    // follow-up `${pm} install` would reject exactly the versions we just
    // selected. Add the updated package names to the PM's native exclude list
    // (preserving the global gate for everything else) so the install proceeds.
    if (options["ignore-release-age"] === true && toApply.length > 0) {
        reportReleaseAgeExcludes(
            logger,
            packageManager,
            addReleaseAgeExcludesForInstall(
                packageManager,
                workspaceRoot,
                toApply.map((entry) => entry.packageName),
            ),
        );
    }

    if (options.install ?? true) {
        const installBin = packageManager;
        const installArgs = ["install"];

        logger.info(`Running ${installBin} ${installArgs.join(" ")}...\n`);

        try {
            const { code, output } = await spawnTee(installBin, installArgs, { cwd: workspaceRoot, env: process.env });

            if (code !== 0) {
                logger.warn(`${installBin} ${installArgs.join(" ")} failed. You may need to run it manually.`);
            } else if (options.peer !== true && hasPeerDependencyWarnings(output)) {
                logger.info(PEER_HINT);
            }
        } catch {
            logger.warn(`${installBin} ${installArgs.join(" ")} failed. You may need to run it manually.`);
        }
    }
};

/**
 * Outcome shape returned by the catalog/PM-wrapper paths so the ecosystem
 * stage can decide whether to apply, preview, or skip:
 *   - `applied` — at least one update was written to disk
 *   - `canceled` — user explicitly opted out (e.g. ESC from the TUI)
 *   - `nothingToDo` — the path ran cleanly but found nothing to update
 */
interface UpdatePathResult {
    readonly applied: boolean;
    readonly canceled: boolean;

    /**
     * `true` when the interactive TUI already scanned + offered ecosystem
     * (Actions/Docker/GitLab) updates, so the caller must NOT run the
     * separate post-pass `runEcosystemUpdate` (which would re-scan and print
     * a duplicate text report). Only the TTY+table path sets this.
     */
    readonly ecosystemHandled?: boolean;
    readonly jsonEmitted: boolean;
}

const RESULT_NOTHING: UpdatePathResult = { applied: false, canceled: false, jsonEmitted: false };

/** Display group (synthetic "catalog") for each adapted ecosystem entry. */
const ECOSYSTEM_GROUP: Record<EcosystemId, string> = {
    actions: "GitHub Actions",
    docker: "Docker",
    gitlab: "GitLab CI",
};

/**
 * Collapse the richer ecosystem update classification onto the npm
 * `OutdatedEntry` tri-state. `digest` / `pin` / `unknown` are treated as
 * patch-level so they land under the "All"/"Patch" filter tabs rather than
 * being hidden.
 */
const ECOSYSTEM_UPDATE_TYPE: Record<EcosystemUpdateType, "major" | "minor" | "patch"> = {
    digest: "patch",
    major: "major",
    minor: "minor",
    patch: "patch",
    pin: "patch",
    unknown: "patch",
};

/**
 * Adapt a non-npm {@link EcosystemUpdate} into an {@link OutdatedEntry} so it
 * renders + selects in the same TUI as catalog packages. `packageName` is the
 * stable, unique `file:line` key (the check-set keys on it; the same action
 * recurs across files), and `displayName` carries the human ref name. The
 * applier rewrites by `replacement` (already SHA-pinned when `style: "sha"`),
 * so the adapter only needs to round-trip the entry via the side-map.
 */
const adaptEcosystemUpdate = (update: EcosystemUpdate): OutdatedEntry => {
    return {
        catalogName: ECOSYSTEM_GROUP[update.ecosystem],
        currentRange: update.currentVersion ?? update.currentRef,
        detailUrl: update.url,
        displayName: update.name,
        kind: "ecosystem",
        newRange: update.newVersion ?? update.newRef,
        packageName: ecosystemEntryKey(update),
        targetVersion: update.newVersion ?? update.newRef,
        updateType: ECOSYSTEM_UPDATE_TYPE[update.updateType] ?? "patch",
    };
};

const executeCatalogUpdate = async (
    workspaceRoot: string,
    packageManager: CatalogPackageManager,
    visConfig: VisConfig,
    options: Record<string, unknown>,
    argument: string[],
    logger: Console,
): Promise<UpdatePathResult> => {
    const configDefaults = visConfig.update ?? {};

    // Warn about flags that have no effect in catalog mode
    const ignoredCatalogFlags: [string, string][] = [
        ["global", "--global is not supported in catalog mode"],
        ["recursive", "--recursive is not needed in catalog mode (catalogs are workspace-level)"],
        ["filter", "--filter is not supported in catalog mode (use --include/--exclude instead)"],
        ["no-save", "--no-save is not supported in catalog mode"],
        ["workspace-root", "--workspace-root is not needed in catalog mode"],
        ["no-optional", "--no-optional is not supported in catalog mode"],
    ];

    for (const [flag, message] of ignoredCatalogFlags) {
        if (options[flag]) {
            logger.warn(`${yellow("⚠")} ${message}, ignoring.`);
        }
    }

    // Resolve minimumReleaseAge: vis config → PM-native config → undefined (disabled).
    // MARSHALL_DISABLE_MIN_RELEASE_AGE=1 (or MARSHALL_DISABLE_ALL=1) skips the gate
    // entirely — useful for emergency upgrades where the release-age window
    // would otherwise block a fix. `--ignore-release-age` is the CLI surface for
    // the same bypass (and additionally rewrites the package manager's native
    // exclude list at install time so the PM's own gate doesn't reject the
    // freshly-selected versions).
    const ignoreReleaseAge = options["ignore-release-age"] === true;
    const minReleaseAgeDisabled = isMarshallDisabled("minReleaseAge") || ignoreReleaseAge;
    const { excludes: pmNativeExcludes, minutes: pmNativeAge } = minReleaseAgeDisabled
        ? { excludes: undefined, minutes: undefined }
        : readPmNativeMinimumReleaseAge(workspaceRoot, packageManager);
    const effectiveAge = minReleaseAgeDisabled ? undefined : (configDefaults.minimumReleaseAge ?? pmNativeAge);
    const effectiveExcludes = minReleaseAgeDisabled ? undefined : (configDefaults.minimumReleaseAgeExclude ?? pmNativeExcludes);

    if (ignoreReleaseAge) {
        logger.info(`${yellow("⚠")} --ignore-release-age: selecting the latest versions regardless of minimumReleaseAge.`);
    } else if (minReleaseAgeDisabled && (configDefaults.minimumReleaseAge !== undefined || pmNativeAge !== undefined)) {
        // Info-level: the env var is the user's explicit opt-out, so a warning on
        // every run would just be noise. A subtle reminder is enough.
        logger.info(`minimumReleaseAge gate disabled via MARSHALL_DISABLE_MIN_RELEASE_AGE.`);
    }

    // Warn if both are set but differ
    if (
        !minReleaseAgeDisabled
        && configDefaults.minimumReleaseAge !== undefined
        && pmNativeAge !== undefined
        && configDefaults.minimumReleaseAge !== pmNativeAge
    ) {
        const pmConfigFile = packageManager === "pnpm" ? "pnpm-workspace.yaml" : "bunfig.toml";

        logger.warn(
            `${yellow("⚠")} minimumReleaseAge mismatch: vis config = ${String(configDefaults.minimumReleaseAge)} min, `
            + `${pmConfigFile} = ${String(pmNativeAge)} min. Consider keeping them in sync.`,
        );
    }

    const npmrcConfig = loadNpmrc(workspaceRoot);
    const includeInternal = options["include-internal"] as boolean | undefined;
    const includePeer = options.peer as boolean | undefined;
    const catalogs = readCatalogs(workspaceRoot, packageManager, {
        depFields: configDefaults.depFields,
        dev: options.dev as boolean | undefined,
        includeInternal,
        peer: includePeer,
        prod: options.prod as boolean | undefined,
    });

    if (catalogs.size === 0) {
        logger.info("No catalogs found.");

        return RESULT_NOTHING;
    }

    const resolvedDefaults = { ...configDefaults, minimumReleaseAge: effectiveAge, minimumReleaseAgeExclude: effectiveExcludes };
    const checkOptions = buildCatalogCheckOptions(options, resolvedDefaults, argument);

    let totalDeps = 0;

    for (const deps of catalogs.values()) {
        totalDeps += deps.size;
    }

    const isTTY = Boolean(process.stdout.isTTY) && !isInCi;
    let progressInstance: ReturnType<typeof render> | undefined;

    const onProgress = isTTY
        ? (current: number, total: number): void => {
            if (progressInstance) {
                progressInstance.rerender(React.createElement(CheckProgressApp, { current, total }));
            } else {
                // Leading newline keeps the spinner from colliding with any
                // prior pail.warn / security messages emitted in beforeCommand.
                process.stdout.write("\n");
                progressInstance = render(React.createElement(CheckProgressApp, { current, total }), {
                    interactive: true,
                    patchConsole: false,
                });
            }
        }
        : (current: number, total: number): void => {
            logger.info(`Checking ${String(current)}/${String(total)} dependencies...`);
        };

    if (!isTTY) {
        logger.info(`Checking ${String(totalDeps)} catalog dependencies...\n`);
    }

    const disabledProviders = new Set<string>();

    if (isMarshallDisabled("socket")) {
        disabledProviders.add("socket");
    }

    if (isMarshallDisabled("depsDev")) {
        disabledProviders.add("deps-dev");
    }

    const minimumScore = visConfig.security?.policies?.score?.minimum;
    const securityProviders = buildEnabledProviders(visConfig.security, {
        disabled: disabledProviders,
        minimumScore,
    });

    const { checkedCount, failed, filteredByTarget, ignored, outdated } = await checkOutdated(
        catalogs,
        checkOptions,
        npmrcConfig,
        onProgress,
        workspaceRoot,
        securityProviders,
        visConfig.security?.acceptedRisks,
    );

    if (progressInstance) {
        progressInstance.clear();
        progressInstance.unmount();
    }

    // Internal workspace deps lag behind their local source-of-truth versions
    // when one workspace package bumps but consumers still pin the previous
    // alpha/rc. `checkOutdated` filters internal names out (the registry
    // doesn't host them yet), so we resolve them here against the local
    // package.json versions and merge into `outdated` for the same apply path.
    //
    // Skipped when `--include-internal` is on: that flag routes those names
    // through the registry pass, and running both produces duplicates where
    // the dedup below would silently prefer whichever pass landed first.
    const internal = includeInternal
        ? { ignored: [] as string[], outdated: [] as typeof outdated }
        : collectInternalOutdated(workspaceRoot, {
            depFields: configDefaults.depFields,
            dev: options.dev as boolean | undefined,
            exclude: checkOptions.exclude,
            ignore: checkOptions.ignore,
            include: checkOptions.include,
            packageMode: checkOptions.packageMode,
            peer: includePeer,
            prod: options.prod as boolean | undefined,
            target: checkOptions.target,
        });

    if (internal.outdated.length > 0) {
        const existingKeys = new Set(outdated.map((e) => `${e.catalogName}|${e.packageName}`));

        for (const entry of internal.outdated) {
            if (!existingKeys.has(`${entry.catalogName}|${entry.packageName}`)) {
                outdated.push(entry);
            }
        }
    }

    if (internal.ignored.length > 0) {
        for (const name of internal.ignored) {
            if (!ignored.includes(name)) {
                ignored.push(name);
            }
        }
    }

    const upToDate = checkedCount - outdated.length - failed.length;

    if (failed.length > 0) {
        logger.warn(`Failed to fetch: ${failed.join(", ")}`);
    }

    if (ignored.length > 0) {
        logger.info(`Skipped ${String(ignored.length)} ignored package${ignored.length === 1 ? "" : "s"}: ${ignored.join(", ")}`);
    }

    if (!isTTY && checkedCount > outdated.length) {
        const totalCatalogEntries = [...catalogs.values()].reduce((sum, deps) => sum + deps.size, 0);
        const dedupeNote
            = totalCatalogEntries > checkedCount
                ? ` (${String(totalCatalogEntries)} catalog entries, ${String(totalCatalogEntries - checkedCount)} duplicates)`
                : "";

        logger.info(
            `Checked ${String(checkedCount)} unique packages${dedupeNote}: ${String(outdated.length)} outdated, ${String(upToDate)} up-to-date${
                failed.length > 0 ? `, ${String(failed.length)} failed` : ""
            }${filteredByTarget.length > 0 ? `, ${String(filteredByTarget.length)} skipped by target` : ""}`,
        );
    }

    if (outdated.length === 0) {
        if (filteredByTarget.length > 0) {
            logger.info(
                `All catalog dependencies are up to date within the current target.`
                + `\n${String(filteredByTarget.length)} package${filteredByTarget.length === 1 ? " has" : "s have"} newer versions available with --target latest:`
                + `\n${filteredByTarget.map((e) => `  ${e.packageName}  ${e.currentRange} → ${e.newRange}  (${e.updateType})`).join("\n")}`,
            );
        } else {
            logger.info("All catalog dependencies are up to date.");
        }

        return RESULT_NOTHING;
    }

    const format = (options.format as string) ?? configDefaults.format ?? "table";

    // AI analysis runs before dry-run check so it works in both modes
    let aiResult: AiAnalysisResult | undefined;

    if (options.ai) {
        const analysisType = validateAnalysisType((options.aiType as string | undefined) ?? "impact");

        aiResult = await runAiAnalysis(outdated, logger, visConfig.ai, analysisType);
    }

    const isDryRun = Boolean(options.dryRun);

    // Pre-install marshall pipeline — only on the explicit-args branch.
    // Blanket `vis update` is a packument fan-out over every installed dep
    // and would multiply network traffic dramatically; user-typed package
    // names are the right scope for these checks.
    //
    // Must run BEFORE the interactive TUI mounts: the Ink app grabs stdin
    // in raw mode, so a marshall prompt issued afterwards would never
    // receive input. Skipped on dry-run since no install can happen.
    if (!isDryRun && argument.length > 0 && options.marshallCheck !== false) {
        const resolved = await resolveExplicitPackages(argument);

        if (resolved.length > 0) {
            const findings = await runMarshallPipeline(resolved, {
                config: visConfig?.security?.marshalls,
                workspaceRoot,
            });
            const proceed = await presentMarshallFindings(findings);

            if (!proceed) {
                process.exitCode = 1;

                return { applied: false, canceled: true, jsonEmitted: false };
            }
        }
    }

    // Interactive TUI mode: TTY + table format
    if (isTTY && format === "table") {
        // Scan non-npm ecosystem references (GitHub Actions / Docker / GitLab
        // CI) up front so they render + select inside the same TUI as catalog
        // packages. Best-effort: a scan failure must not block the npm flow.
        // Skipped when the user targeted specific packages (argument.length>0)
        // or disabled every ecosystem. Adapted entries round-trip back to their
        // originals via `ecosystemOriginals` for the apply step.
        const ecosystemOriginals = new Map<string, EcosystemUpdate>();
        const ecosystemAdapted: OutdatedEntry[] = [];
        let ecosystemScanned = false;

        if (argument.length === 0) {
            const ecosystemOptions = buildEcosystemOptions(options, visConfig);

            if (ecosystemOptions.disabled.size < 3) {
                try {
                    const ecoResult = await checkEcosystems({ options: ecosystemOptions, workspaceRoot });

                    ecosystemScanned = ecoResult.scanned > 0;

                    for (const update of ecoResult.updates) {
                        const adapted = adaptEcosystemUpdate(update);

                        ecosystemOriginals.set(adapted.packageName, update);
                        ecosystemAdapted.push(adapted);
                    }
                } catch (error) {
                    logger.warn(`${yellow("⚠")} Ecosystem update scan failed: ${(error as Error).message}`);
                }
            }
        }

        const store = new UpdateStore([...outdated, ...ecosystemAdapted], aiResult ?? null);

        // Fetch changelog URLs if requested
        let changelogUrls: Map<string, string> | undefined;

        if (options.changelog) {
            logger.info("Fetching changelogs...");

            const changelogs = await fetchChangelogInfo(outdated, undefined, npmrcConfig);

            changelogUrls = new Map<string, string>();

            for (const info of changelogs) {
                const url = info.releaseUrl ?? info.repoUrl ?? info.npmUrl;

                if (url) {
                    changelogUrls.set(info.packageName, url);
                }
            }
        }

        const autoExitConfig = visConfig.tui?.autoExit ?? false;
        const autoExitSeconds = autoExitConfig === true ? 3 : typeof autoExitConfig === "number" ? autoExitConfig : 0;

        const instance = render(
            React.createElement(VisUpdateApp, {
                autoExitSeconds,
                changelogUrls,
                checkedCount,
                filteredOutEntries: filteredByTarget,
                isDryRun,
                store,
                totalCatalogEntries: totalDeps,
            }),
            {
                alternateScreen: true,
                exitOnCtrlC: false,
                interactive: true,
                patchConsole: true,
            },
        );

        const exitResult = await instance.waitUntilExit();

        // Print post-exit summary
        const columns = process.stdout.columns || 80;

        process.stdout.write("\n");

        for (const entry of outdated) {
            const hasSecurityIssue = entry.vulnerabilities?.length || (entry.socketReport && entry.socketReport.alerts.length > 0);
            const isAck = Boolean(entry.acceptedRisk);
            const icon = hasSecurityIssue ? (isAck ? "✓" : "⚠") : "✓";
            const iconColor = isAck ? "gray" : entry.updateType === "major" ? "red" : entry.updateType === "minor" ? "yellow" : "green";
            const socketOverall = entry.socketReport?.score.overall;
            const scoreSuffix = socketOverall === undefined ? "" : ` [${String(Math.round(socketOverall * 100))}%]`;
            const socketColorName = socketOverall === undefined ? undefined : scoreColor(socketOverall);

            process.stdout.write(
                `${renderToString(
                    React.createElement(
                        Text,
                        null,
                        "   ",
                        React.createElement(Text, { color: iconColor }, icon),
                        `  ${entry.packageName}  ${entry.currentRange} → ${entry.newRange}`,
                        React.createElement(Text, { dimColor: true }, `  ${entry.updateType}`),
                        socketColorName ? React.createElement(Text, { color: socketColorName }, scoreSuffix) : null,
                    ),
                    { columns },
                )}\n`,
            );
        }

        process.stdout.write("\n");
        logger.info(formatSummary(outdated, minimumScore));

        if (checkedCount > outdated.length) {
            const totalCatalogEntries = [...catalogs.values()].reduce((sum, deps) => sum + deps.size, 0);
            const dedupeNote
                = totalCatalogEntries > checkedCount
                    ? ` (${String(totalCatalogEntries)} catalog entries, ${String(totalCatalogEntries - checkedCount)} duplicates)`
                    : "";

            logger.log();
            logger.info(
                `Checked ${String(checkedCount)} unique packages${dedupeNote}: ${String(upToDate)} up-to-date${
                    failed.length > 0 ? `, ${String(failed.length)} failed` : ""
                }`,
            );
        }

        if (filteredByTarget.length > 0) {
            process.stdout.write("\n");

            const skippedLabel = `${String(filteredByTarget.length)} package${filteredByTarget.length === 1 ? "" : "s"} skipped by target constraint (use --target latest to include):`;

            process.stdout.write(`${renderToString(React.createElement(Text, { color: "yellow" }, `  ${skippedLabel}`), { columns })}\n`);

            for (const entry of filteredByTarget) {
                process.stdout.write(
                    `${renderToString(
                        React.createElement(
                            Text,
                            null,
                            "     ",
                            React.createElement(Text, { dimColor: true }, entry.packageName),
                            `  ${entry.currentRange} → ${entry.newRange}`,
                            React.createElement(Text, { dimColor: true }, `  ${entry.updateType}`),
                        ),
                        { columns },
                    )}\n`,
                );
            }
        }

        // If user selected entries to apply (exitResult is the checked entries array)
        const toApply = Array.isArray(exitResult) ? (exitResult as OutdatedEntry[]) : [];
        // Partition the selection: adapted ecosystem entries go to the
        // ecosystem applier (which rewrites the workflow / Dockerfile / GitLab
        // CI files by their already-resolved, SHA-pinned `replacement`); the
        // rest are npm catalog packages handled by the catalog installer.
        const npmToApply = toApply.filter((entry) => entry.kind !== "ecosystem");
        const ecosystemToApply = toApply
            .filter((entry) => entry.kind === "ecosystem")
            .map((entry) => ecosystemOriginals.get(entry.packageName))
            .filter((update): update is EcosystemUpdate => update !== undefined);

        if (!isDryRun && toApply.length > 0) {
            if (npmToApply.length > 0) {
                logger.info(`\nApplying ${String(npmToApply.length)} catalog update${npmToApply.length === 1 ? "" : "s"}...\n`);

                const mergedOptions = { ...options, install: options.install ?? configDefaults.install };

                await applyCatalogAndInstall(workspaceRoot, packageManager, npmToApply, mergedOptions, logger, npmrcConfig, visConfig.editorconfig ?? true);
            }

            if (ecosystemToApply.length > 0) {
                const { applied, skipped } = applyEcosystemUpdates(ecosystemToApply);

                if (applied.length > 0) {
                    logger.info(`${String(applied.length)} ecosystem reference${applied.length === 1 ? "" : "s"} updated.`);
                }

                for (const item of skipped) {
                    logger.warn(`${yellow("⚠")} Skipped ${item.update.name} (${item.update.file}): ${item.reason}`);
                }
            }

            return { applied: true, canceled: false, ecosystemHandled: ecosystemScanned, jsonEmitted: false };
        }

        // Empty toApply means the user dismissed the TUI without selecting
        // anything — that's a deliberate cancellation, not a no-op.
        return { applied: false, canceled: toApply.length === 0, ecosystemHandled: ecosystemScanned, jsonEmitted: false };
    }

    // Static output mode (non-TTY, CI, json, minimal)
    if (isDryRun) {
        if (format === "json") {
            const output: Record<string, unknown> = { failed, filteredByTarget, ignored, outdated };

            if (aiResult) {
                output.aiAnalysis = aiResult;
            }

            process.stdout.write(`${JSON.stringify(output, undefined, 2)}\n`);
        } else {
            logger.info(`Would update ${String(outdated.length)} dependencies:\n`);
            writeFormattedOutput(outdated, failed, format, logger, minimumScore);

            if (aiResult) {
                logger.info("");
                logger.info(formatAiAnalysis(aiResult));
            }

            logFilteredByTarget(filteredByTarget, logger);
        }

        return { applied: false, canceled: false, jsonEmitted: format === "json" };
    }

    if (aiResult && format !== "json") {
        logger.info(formatAiAnalysis(aiResult));
        logger.info("");
    }

    let toApply = outdated;

    if (options.interactive) {
        toApply = await promptPackageSelection(outdated);

        if (toApply.length === 0) {
            logger.info("No updates selected.");

            return { applied: false, canceled: true, jsonEmitted: false };
        }
    }

    logger.info(`Updating ${String(toApply.length)} catalog dependencies...\n`);
    writeFormattedOutput(toApply, [], format, logger, minimumScore);
    logFilteredByTarget(filteredByTarget, logger);

    const mergedOptions = { ...options, install: options.install ?? configDefaults.install };

    await applyCatalogAndInstall(workspaceRoot, packageManager, toApply, mergedOptions, logger, npmrcConfig);

    return { applied: true, canceled: false, jsonEmitted: format === "json" };
};

const executePmWrapper = async (
    workspaceRoot: string,
    packageManager: "aube" | "bun" | "deno" | "npm" | "pnpm" | "yarn",
    version: string,
    options: Record<string, unknown>,
    argument: string[],
    logger: Console,
): Promise<UpdatePathResult> => {
    if (options["ignore-release-age"] === true) {
        const native = readPmNativeMinimumReleaseAge(workspaceRoot, packageManager);
        const gateActive = typeof native.minutes === "number" && native.minutes > 0;

        if (gateActive && argument.length > 0) {
            // Explicit package names → exempt exactly those from the gate so the
            // PM's own update command isn't blocked (pnpm/bun/yarn). npm has no
            // per-package list, so this reports `unsupported` instead. Strip any
            // `@version` spec (e.g. `react@19`) — the exclude list keys on the
            // bare package name, not the install spec.
            const names = argument.map((a) => parsePackageArgument(a).name);

            reportReleaseAgeExcludes(logger, packageManager, addReleaseAgeExcludesForInstall(packageManager, workspaceRoot, names));
        } else if (gateActive) {
            // No package names → vis can't know which packages the PM will change,
            // so it can't surgically exempt them in pm-wrapper mode.
            logger.warn(
                `${yellow("⚠")} --ignore-release-age without package names can't pre-exempt packages in pm-wrapper mode `
                + `(vis doesn't know which will change). Pass explicit package names, use catalog mode, or lower the gate in `
                + `${RELEASE_AGE_CONFIG_FILE[packageManager] ?? "your package manager config"}.`,
            );
        }
    }

    const updateOptions: UpdateCommandOptions = {
        dev: options.dev as boolean,
        filters: toFilterArray(options.filter as FilterOption),
        global: options.global as boolean,
        interactive: options.interactive as boolean,
        latest: (options.latest as boolean) || options.target === "latest",
        noOptional: options.optional === false,
        noSave: options.save === false,
        packages: argument,
        prod: options.prod as boolean,
        recursive: options.recursive as boolean,
        workspaceRoot: options.workspaceRoot as boolean,
    };

    const { command, warnings } = resolveUpdateCommand(packageManager, version, updateOptions);

    for (const warning of warnings) {
        logger.warn(warning);
    }

    const fullCommand = `${command.bin} ${command.args.join(" ")}`.trim();

    if (options.dryRun) {
        logger.info(`Would run: ${fullCommand}`);

        return RESULT_NOTHING;
    }

    logger.info(`Running: ${fullCommand}`);

    try {
        const { code, output } = await spawnTee(command.bin, command.args, { cwd: workspaceRoot, env: process.env });

        if (code !== 0) {
            logger.error(`\n${red("✖")} Update failed (exit code ${String(code)})`);
            logger.error(`  Command: ${fullCommand}`);
            logger.error(`  Directory: ${workspaceRoot}\n`);

            process.exitCode = code;

            return { applied: false, canceled: false, jsonEmitted: false };
        }

        // Already-skipped on `--peer` updates: re-running the same hint would
        // just point users back at the command they already ran. The catalog
        // path uses the same guard for the same reason.
        if (options.peer !== true && hasPeerDependencyWarnings(output)) {
            logger.info(PEER_HINT);
        }
    } catch (error: unknown) {
        const execError = error as { status?: number };
        const exitCode = execError.status ?? 1;

        logger.error(`\n${red("✖")} Update failed (exit code ${String(exitCode)})`);
        logger.error(`  Command: ${fullCommand}`);
        logger.error(`  Directory: ${workspaceRoot}\n`);

        process.exitCode = exitCode;

        return { applied: false, canceled: false, jsonEmitted: false };
    }

    return { applied: true, canceled: false, jsonEmitted: false };
};

/**
 * Gate blanket `--latest` updates behind an explicit confirmation. Fires when
 * no package args were given AND the user asked for latest. On a TTY we prompt
 * via readline; in CI / non-TTY contexts we refuse and demand `--yes` (or
 * `--dry-run`, or explicit package names) so a stray `vis update --latest` in
 * a pipeline can't blanket-bump every dependency unattended.
 *
 * Returns `true` to continue, `false` to abort (with `process.exitCode` set
 * when the abort represents a hard failure).
 */
export const requireBlanketUpdateConfirmation = async (options: Partial<UpdateOptions>, hasPackageArgs: boolean, logger: Console): Promise<boolean> => {
    const isLatest = options.latest === true || options.target === "latest";

    if (hasPackageArgs || !isLatest) {
        return true;
    }

    if (options.dryRun === true) {
        return true;
    }

    if (options.yes === true) {
        return true;
    }

    // Interactive mode has its own curated selection step, so the gate would
    // be redundant. Let the user pick their packages in the TUI instead.
    if (options.interactive === true) {
        return true;
    }

    const isTTY = Boolean(process.stdout.isTTY) && !isInCi;

    if (!isTTY) {
        logger.error(`${red("✖")} Refusing to run blanket --latest update in a non-interactive context.`);
        logger.error("  Re-run with --yes to confirm, --dry-run to preview, or pass explicit package names.");
        process.exitCode = 1;

        return false;
    }

    const rl = createInterface({ input: process.stdin, output: process.stdout });

    try {
        const answer = await new Promise<string>((resolve) => {
            rl.question(
                `${yellow("⚠")} About to upgrade ALL dependencies to their latest versions. This may include breaking changes.\n  Continue? [y/N] `,
                resolve,
            );
        });

        const normalized = answer.trim().toLowerCase();
        const accepted = normalized === "y" || normalized === "yes";

        if (!accepted) {
            logger.info("Aborted.");

            return false;
        }

        return true;
    } finally {
        rl.close();
    }
};

/**
 * Builds the {@link EcosystemUpdateOptions} from the parsed CLI options.
 * The catalog options re-use the same `include`/`exclude` arrays — they
 * apply to both the npm side and the ecosystem side, so a user pinning
 * `actions/checkout` via `--exclude` doesn't have to specify twice.
 */
const buildEcosystemOptions = (options: Record<string, unknown>, visConfig: VisConfig): EcosystemUpdateOptions => {
    const disabled = new Set<EcosystemId>();

    // Cerebro auto-creates the non-negated counterpart of `--no-foo`
    // flags and maps it to `foo: false` after parsing. We rely on that
    // mapping rather than reading the raw `--no-foo` key.
    if (options.actions === false) {
        disabled.add("actions");
    }

    if (options.docker === false) {
        disabled.add("docker");
    }

    if (options.gitlab === false) {
        disabled.add("gitlab");
    }

    const styleRaw = (options.style as string | undefined) ?? "sha";

    if (styleRaw !== "sha" && styleRaw !== "preserve") {
        throw new Error(`Invalid --style "${styleRaw}". Use: sha or preserve.`);
    }

    const targetMode = options.latest === true ? "latest" : ((options.target as string | undefined) ?? "latest");

    if (targetMode !== "latest" && targetMode !== "minor" && targetMode !== "patch") {
        // Mirror the catalog path's validation (handler.ts buildCatalogCheckOptions)
        // so `--target=major` doesn't silently become `latest` when the
        // catalog path is skipped (`--no-catalog` or no catalogs in repo).
        throw new Error(`Invalid target "${targetMode}". Use: latest, minor, or patch.`);
    }

    const mode = targetMode;
    const configDefaults = visConfig.update ?? {};

    return {
        disabled,
        exclude: [...toFilterArray(options.exclude as FilterOption), ...toFilterArray(configDefaults.exclude)],
        githubToken: (options.actionsToken as string | undefined) ?? undefined,
        gitlabToken: (options.gitlabToken as string | undefined) ?? undefined,
        include: toFilterArray(options.include as FilterOption),
        includeBranches: options.includeBranches === true,
        maxConcurrentRequests: typeof options.maxConcurrentRequests === "number" && options.maxConcurrentRequests > 0 ? options.maxConcurrentRequests : 8,
        minAgeDays:
            typeof configDefaults.minimumReleaseAge === "number" && configDefaults.minimumReleaseAge > 0
                ? configDefaults.minimumReleaseAge / (60 * 24)
                : undefined,
        mode,
        respectDependabotConfig: true,
        style: styleRaw,
    };
};

/**
 * Decides whether the ecosystem stage should apply updates to disk.
 *
 * Ecosystem edits rewrite CI workflow files, Dockerfiles, and GitLab CI
 * config — they must never be written unless the user explicitly opted
 * in. Critically, the catalog/npm path applying does NOT carry over: a
 * plain `vis update` that bumps npm deps still leaves GitHub Actions,
 * Docker, and GitLab references in **preview only** mode. Auto-applying
 * them on the back of an npm bump silently mutates files the user never
 * selected.
 *
 * Apply is permitted only when:
 *   - `--yes` was passed (explicit "apply all" opt-in), or
 *   - `--interactive` was passed in a TTY (the picker lets the user
 *     choose which references to apply).
 *
 * Apply is refused outright when:
 *   - `--dry-run` was passed
 *   - The catalog/PM stage failed (`process.exitCode` is non-zero)
 *   - The catalog TUI was canceled (user said no).
 */
export const shouldApplyEcosystem = (options: Record<string, unknown>, catalogResult: UpdatePathResult): boolean => {
    if (options.dryRun === true) {
        return false;
    }

    if (process.exitCode !== undefined && process.exitCode !== 0) {
        return false;
    }

    if (catalogResult.canceled) {
        return false;
    }

    if (options.yes === true) {
        return true;
    }

    // The npm/catalog path applying does NOT authorise ecosystem writes —
    // only an explicit `--interactive` selection (in a TTY) does.
    return options.interactive === true && Boolean(process.stdout.isTTY) && !isInCi;
};

/**
 * Runs the ecosystem-update flow alongside the npm/catalog path. This
 * is best-effort: failures in the ecosystem scan must NOT prevent the
 * catalog flow from completing, so the orchestrator catches its own
 * errors and surfaces them as warnings.
 *
 * Returns `true` when at least one ecosystem was scanned, so the caller
 * can suppress the "nothing to update" message when the npm path also
 * found nothing.
 */
export const runEcosystemUpdate = async (
    workspaceRoot: string,
    options: Record<string, unknown>,
    visConfig: VisConfig,
    logger: Console,
    catalogResult: UpdatePathResult,
): Promise<EcosystemCheckResult | undefined> => {
    const ecosystemOptions = buildEcosystemOptions(options, visConfig);
    const allDisabled = ecosystemOptions.disabled.size === 3;

    if (allDisabled) {
        return undefined;
    }

    let result: EcosystemCheckResult;

    try {
        result = await checkEcosystems({ options: ecosystemOptions, workspaceRoot });
    } catch (error) {
        logger.warn(`${yellow("⚠")} Ecosystem update scan failed: ${(error as Error).message}`);

        return undefined;
    }

    if (result.scanned === 0) {
        return result;
    }

    const format = (options.format as string | undefined) ?? "table";
    const isDryRun = Boolean(options.dryRun);
    // Decide up-front whether we'll write anything, so the report can tell
    // the user these references are preview-only (not auto-applied) when
    // they didn't opt in via `--yes` / `--interactive`.
    const willApply = shouldApplyEcosystem(options, catalogResult);

    if (format === "json") {
        // The catalog path may have already written a JSON document to
        // stdout. Emitting a second top-level JSON document would break
        // any consumer piping through `jq`. When that happened we log
        // to stderr instead and the user can rerun with --format=table
        // (or --no-catalog) to get the ecosystem JSON.
        if (catalogResult.jsonEmitted) {
            logger.warn(
                `${yellow("⚠")} ${String(result.updates.length)} ecosystem update${result.updates.length === 1 ? "" : "s"} available `
                + "but not emitted in --format=json (catalog already wrote one JSON document). Rerun with --format=table or "
                + "--no-catalog to see them.",
            );
        } else {
            process.stdout.write(`${formatEcosystemJson(result)}\n`);
        }
    } else if (format !== "minimal") {
        const report = formatEcosystemReport(result, {
            // On `--dry-run` the user already knows nothing is written, so the
            // "re-run with `--interactive`" footer is misleading (it implies
            // dropping `--dry-run` alone would apply). Only surface the
            // preview-only note when we genuinely declined to apply.
            previewOnly: !willApply && !isDryRun,
            showIgnored: options.interactive === true,
        });

        if (report) {
            logger.info(report);
        }
    }

    if (result.updates.length === 0) {
        return result;
    }

    if (isDryRun) {
        // `table`/`json` already surfaced the available updates above. For
        // `minimal` (which renders no report) emit the actionable hint here
        // too — otherwise `--dry-run --format=minimal` would print nothing
        // at all and the user would never learn updates are available.
        if (format === "minimal") {
            logger.info(
                `\n${yellow("ℹ")} ${String(result.updates.length)} ecosystem reference${result.updates.length === 1 ? "" : "s"} can be bumped — not applied (--dry-run). `
                + "Re-run without --dry-run and with `--interactive` or `--yes` to apply.",
            );
        }

        return result;
    }

    if (!willApply) {
        // The table report already carries the preview note via
        // `previewOnly`; `minimal` renders no report, so emit the
        // actionable hint here instead. `json` is deliberately excluded —
        // its document is written to stdout and a trailing prose line
        // would corrupt it for `jq`/parser consumers. We intentionally do
        // NOT exit non-zero — outdated CI references are information, not
        // a failure.
        if (format === "minimal") {
            logger.info(
                `\n${yellow("ℹ")} ${String(result.updates.length)} ecosystem reference${result.updates.length === 1 ? "" : "s"} can be bumped — not applied automatically. `
                + "Re-run with `--interactive` to choose, or `--yes` to apply all "
                + "(or `--no-actions` / `--no-docker` / `--no-gitlab` to silence by ecosystem).",
            );
        }

        return result;
    }

    let toApply = result.updates;

    if (options.interactive === true && Boolean(process.stdout.isTTY) && !isInCi) {
        // Mirrors the catalog path's interactive picker so the user can
        // de-select major bumps before they hit disk. `--yes` bypasses
        // the picker (apply all) by virtue of options.interactive being
        // false in that case.
        toApply = await promptEcosystemSelection(result.updates);

        if (toApply.length === 0) {
            logger.info(`${yellow("ℹ")} No ecosystem updates selected.`);

            return result;
        }
    }

    const { applied, skipped } = applyEcosystemUpdates(toApply);

    if (applied.length > 0) {
        logger.info(`\n${String(applied.length)} ecosystem reference${applied.length === 1 ? "" : "s"} updated.`);
    }

    if (skipped.length > 0) {
        logger.warn(`${yellow("⚠")} ${String(skipped.length)} ecosystem update${skipped.length === 1 ? "" : "s"} skipped:`);

        for (const item of skipped) {
            logger.warn(`    ${item.update.name} (${item.update.file}:${String(item.update.line)}): ${item.reason}`);
        }
    }

    return result;
};

/**
 * Validates ecosystem-flag shapes BEFORE catalog/PM runs. The ecosystem
 * path can throw on bad input (`--style shaa`, `--target major`); doing
 * that after the catalog has already mutated `package.json` /
 * `pnpm-workspace.yaml` would leave the user with a half-finished
 * update and an opaque stack trace.
 */
const validateEcosystemFlags = (options: Record<string, unknown>): void => {
    const style = options.style as string | undefined;

    if (style !== undefined && style !== "sha" && style !== "preserve") {
        throw new Error(`Invalid --style "${style}". Use: sha or preserve.`);
    }

    const target = options.target as string | undefined;

    if (target !== undefined && target !== "latest" && target !== "minor" && target !== "patch") {
        throw new Error(`Invalid --target "${target}". Use: latest, minor, or patch.`);
    }
};

const execute = async ({ argument: rawArgument, logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, UpdateOptions>): Promise<void> => {
    if (!wsRoot) {
        throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
    }

    validateEcosystemFlags(options);

    let argument = rawArgument;

    const workspaceRoot = wsRoot;
    const { packageManager } = findPackageManagerSync(workspaceRoot);

    // Typosquat check
    if ((options as Record<string, unknown>).typosquatCheck !== false) {
        if (argument.length > 0) {
            // Explicit package arguments: offer name correction
            const parsed = argument.map((a: string) => parsePackageArgument(a));
            const allowlist = visConfig?.security?.typosquatAllowlist;
            const result = await runTyposquatCheck(
                parsed.map((p) => p.name),
                allowlist,
            );

            if (!result.ok) {
                process.exitCode = 1;

                return;
            }

            // Rebuild args with corrected names, preserving version specifiers
            argument = parsed.map((p, i) => {
                const corrected = result.packages[i];

                if (corrected !== p.name) {
                    return p.versionSpec ? `${corrected}@${p.versionSpec}` : (corrected ?? "");
                }

                return argument[i] ?? "";
            });
        } else {
            // No explicit args: scan package.json deps for typosquats
            const shouldContinue = await scanDepsForTyposquats(workspaceRoot, visConfig?.security?.typosquatAllowlist);

            if (!shouldContinue) {
                process.exitCode = 1;

                return;
            }
        }
    }

    // Rollback mode — short-circuits before any registry work.
    if (options.rollback) {
        if (!hasBackup(workspaceRoot, packageManager)) {
            logger.info("No backup found. Run 'vis update' first to create a backup.");

            return;
        }

        const restored = restoreFromBackup(workspaceRoot, packageManager);

        if (restored) {
            logger.info("Restored from backup.");
        } else {
            throw new Error("Failed to restore from backup.");
        }

        return;
    }

    // Blanket --latest gate: confirm before upgrading everything to latest.
    // TUI/interactive paths already have their own selection step, so the gate
    // only matters for non-interactive blanket updates. We still fire it here
    // unconditionally because both catalog-non-TTY and pm-wrapper paths apply
    // blindly otherwise.
    const proceed = await requireBlanketUpdateConfirmation(options, argument.length > 0, logger);

    if (!proceed) {
        return;
    }

    // Catalog mode: pnpm/bun with catalogs detected, unless --no-catalog.
    // Catalog work always uses the lockfile-detected PM (pnpm/bun) because
    // catalog manipulation is PM-format-specific. Aube cannot host catalogs
    // on its own — it inherits whatever pnpm-workspace.yaml the project has.
    const useCatalogMode = (options as Record<string, unknown>).catalog !== false && hasCatalogs(workspaceRoot, packageManager);

    let catalogResult: UpdatePathResult;

    if (useCatalogMode) {
        catalogResult = await executeCatalogUpdate(workspaceRoot, packageManager, visConfig ?? {}, options, argument, logger);
    } else {
        // Non-catalog updates honor `install.backend` so users who opted
        // into aube get `aube update` instead of the lockfile-detected PM.
        const installer = resolveInstaller(workspaceRoot, {
            backend: runtimeInstallerBackend(resolveCommandRuntime({ logger, options, visConfig }, workspaceRoot)),
            configBackend: visConfig?.install?.backend,
            configCorepack: visConfig?.install?.corepack,
        });
        const installerVersion = installer.name === "aube" ? "" : getPackageManagerVersion(installer.name);

        catalogResult = await executePmWrapper(workspaceRoot, installer.name, installerVersion, options, argument, logger);
    }

    // Ecosystem updates run after the npm/catalog path so the catalog
    // exit codes / interactive flows aren't disturbed by the extra
    // network work. Explicit package arguments mean the user is
    // targeting a specific npm dep — skip the ecosystem scan in that
    // case to avoid surprise edits to workflow / Dockerfile / GitLab CI
    // files when the user only asked to bump `lodash`.
    //
    // We also pass the catalog/PM result so `runEcosystemUpdate` can
    // refuse to apply when the npm stage failed, was canceled in the
    // TUI, or already produced a JSON document on stdout.
    // When the interactive TUI already scanned + offered ecosystem updates
    // (catalogResult.ecosystemHandled), skip the post-pass — it would re-scan
    // and print a duplicate text report. Non-TTY / json / minimal paths leave
    // it unset, so they still get the standalone ecosystem flow here.
    if (argument.length === 0 && catalogResult.ecosystemHandled !== true) {
        await runEcosystemUpdate(workspaceRoot, options, visConfig ?? {}, logger, catalogResult);
    }
};

export default execute as CommandExecute<Toolbox>;
