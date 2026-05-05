import { readdirSync, unlinkSync, writeFileSync } from "node:fs";

import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { readYamlSync, writeYamlSync } from "@visulima/fs/yaml";
import { join } from "@visulima/path";

import { findVisConfigFile } from "../../config/config";
import type { ExtraCustomType } from "../../config/types";
import type { BannedDepRule } from "../../util/banned-deps-lint";
import { BUILTIN_CUSTOM_TYPES } from "../../util/custom-types";
import { backupFile } from "./backup";
import { detectJsonIndent, isJsonFile, readJsonFile } from "./json";
import type { MigrationReport } from "./types";
import { addManualStep, addMigrationWarning, bumpPerMigration } from "./types";

interface MigrateLogger {
    info: (message: string) => void;
    warn: (message: string) => void;
}

const MIGRATION_ID = "syncpack";

const SYNCPACK_JSON_CONFIG_FILES = [".syncpackrc", ".syncpackrc.json"] as const;
const SYNCPACK_YAML_CONFIG_FILES = [".syncpackrc.yaml", ".syncpackrc.yml"] as const;
const SYNCPACK_UNSUPPORTED_CONFIG_FILES = [
    ".syncpackrc.cjs",
    ".syncpackrc.js",
    ".syncpackrc.mjs",
    ".syncpackrc.ts",
    "syncpack.config.cjs",
    "syncpack.config.js",
    "syncpack.config.mjs",
    "syncpack.config.ts",
] as const;
const SYNCPACK_ALL_CONFIG_FILES = [...SYNCPACK_JSON_CONFIG_FILES, ...SYNCPACK_YAML_CONFIG_FILES, ...SYNCPACK_UNSUPPORTED_CONFIG_FILES] as const;

const EXTRA_TYPES_KEY_RE = /\bextraTypes\s*:/;
const POLICY_KEY_RE = /\bpolicy\s*:/;
const DEFINE_CONFIG_RE = /(defineConfig\(\{)/;
const EXPORT_DEFAULT_RE = /(export\s+default\s+\{)/;

const SYNCPACK_SCRIPT_RE = /\bsyncpack\b/;

/**
 * Subset of the syncpack config that vis can act on. Anything we don't
 * read here either has no vis equivalent (most options), is implicit
 * already (workspace globs, indent), or lives behind the deferred
 * versionGroups/semverGroups DSL — we still read those keys so we can
 * route them to manualSteps with concrete labels.
 *
 * Reference: https://jamiemason.github.io/syncpack/config/syncpackrc/
 */
interface SyncpackConfig {
    /** Record keyed by display name; we flip it to an array for vis. */
    customTypes?: Record<string, { depName?: string; path?: string; strategy?: string }>;
    /** Filter on dep buckets — vis applies its policies to all standard buckets, so any non-default value becomes a manual step. */
    dependencyTypes?: string[];
    /** Filter regex over dep names — manual step (no vis equivalent today). */
    filter?: string;
    /** package.json `bugs` field formatter — superseded by `vis sort-package-json`. */
    formatBugs?: boolean;
    /** package.json `repository` field formatter — superseded by `vis sort-package-json`. */
    formatRepository?: boolean;
    /** Skipped — vis derives indent from the source file / .editorconfig. */
    indent?: string;
    /** Toggle for syncpack's `format` command — covered by `vis lint` + `vis sort-package-json`. */
    lintFormatting?: boolean;
    /** Toggle for syncpack's semver-range linter — covered by `vis lint` by default. */
    lintSemverRanges?: boolean;
    /** Toggle for syncpack's version linter — covered by `vis lint` by default. */
    lintVersions?: boolean;
    /** Deferred to Item 5 — surfaced as a manual step. */
    semverGroups?: ReadonlyArray<Record<string, unknown>>;
    /** package.json key sorter — superseded by `vis sort-package-json`. */
    sortAz?: string[];
    /** ditto */
    sortExports?: string[];
    /** ditto */
    sortFirst?: string[];
    /** Sort top-level dep blocks — superseded by `vis sort-package-json`. */
    sortPackages?: boolean | string[];
    /** Workspace globs — vis derives these from pnpm-workspace.yaml / package.json#workspaces. */
    source?: string[];
    /** Filter on specifier shapes — manual step. */
    specifierTypes?: string[];
    /** Deferred to Item 5 — surfaced as a manual step. */
    versionGroups?: ReadonlyArray<Record<string, unknown>>;
}

// Detection ---------------------------------------------------------

const detectSyncpackConfig = (root: string): string | undefined => {
    const packageJsonPath = join(root, "package.json");

    if (isAccessibleSync(packageJsonPath)) {
        const pkg = readJsonFile<Record<string, unknown>>(packageJsonPath);

        if (pkg?.["syncpack"]) {
            return "package.json";
        }
    }

    for (const file of SYNCPACK_ALL_CONFIG_FILES) {
        if (isAccessibleSync(join(root, file))) {
            return file;
        }
    }

    return undefined;
};

const hasUnsupportedSyncpackConfig = (root: string): string | undefined => {
    for (const filename of SYNCPACK_UNSUPPORTED_CONFIG_FILES) {
        if (isAccessibleSync(join(root, filename))) {
            return filename;
        }
    }

    const syncpackrcPath = join(root, ".syncpackrc");

    if (isAccessibleSync(syncpackrcPath) && !isJsonFile(syncpackrcPath)) {
        // Could be YAML; try parsing as YAML to confirm before flagging.
        try {
            readYamlSync(syncpackrcPath);

            return undefined;
        } catch {
            return ".syncpackrc";
        }
    }

    return undefined;
};

const hasPolicyExtraTypesInVisConfig = (root: string): boolean => {
    const configPath = findVisConfigFile(root);

    if (!configPath) {
        return false;
    }

    return EXTRA_TYPES_KEY_RE.test(readFileSync(configPath));
};

// Config extraction -------------------------------------------------

const extractSyncpackFromPackageJson = (root: string): SyncpackConfig | undefined => {
    const pkg = readJsonFile<{ syncpack?: SyncpackConfig }>(join(root, "package.json"));

    return pkg?.syncpack;
};

const parseSyncpackJsonFile = (filePath: string): SyncpackConfig | undefined => readJsonFile<SyncpackConfig>(filePath);

const parseSyncpackYamlFile = (filePath: string): SyncpackConfig | undefined => {
    try {
        return readYamlSync(filePath);
    } catch {
        return undefined;
    }
};

const extractConfig = (root: string, source: string, report: MigrationReport): SyncpackConfig | undefined => {
    if (source === "package.json") {
        return extractSyncpackFromPackageJson(root);
    }

    if ((SYNCPACK_UNSUPPORTED_CONFIG_FILES as ReadonlyArray<string>).includes(source)) {
        addMigrationWarning(
            report,
            `${source} is a TS/JS config and cannot be auto-migrated — vis migrate does not load executable config. Convert to .syncpackrc.json and re-run, or translate directly into vis.config.ts. Tracked in https://github.com/visulima/visulima/issues/622.`,
        );
        addManualStep(report, `Translate ${source} into vis.config.ts (policy.* and security.*) — see https://github.com/visulima/visulima/issues/622`);

        return undefined;
    }

    const filePath = join(root, source);

    if ((SYNCPACK_YAML_CONFIG_FILES as ReadonlyArray<string>).includes(source)) {
        return parseSyncpackYamlFile(filePath);
    }

    if (source === ".syncpackrc" && !isJsonFile(filePath)) {
        const yaml = parseSyncpackYamlFile(filePath);

        if (yaml) {
            return yaml;
        }

        addMigrationWarning(report, ".syncpackrc is neither valid JSON nor YAML — please migrate manually.");

        return undefined;
    }

    return parseSyncpackJsonFile(filePath);
};

// Translation -------------------------------------------------------

const translateCustomTypes = (config: SyncpackConfig, report: MigrationReport): ExtraCustomType[] => {
    const out: ExtraCustomType[] = [];

    if (!config.customTypes) {
        return out;
    }

    for (const [name, raw] of Object.entries(config.customTypes)) {
        if (!raw || typeof raw !== "object") {
            continue;
        }

        const { strategy } = raw;
        const { path } = raw;

        if (typeof path !== "string" || path.length === 0) {
            addMigrationWarning(report, `customType "${name}" has no \`path\` — skipped.`);
            continue;
        }

        if (strategy !== "name@version" && strategy !== "string" && strategy !== "versionsByName") {
            addMigrationWarning(report, `customType "${name}" has unsupported strategy ${JSON.stringify(strategy)} — skipped.`);
            continue;
        }

        if (BUILTIN_CUSTOM_TYPES.has(name as never)) {
            // vis covers `engines`, `volta`, `packageManager`, `devEngines.runtime`,
            // `devEngines.packageManager` natively — dropping the syncpack
            // declaration is the right move; flag for visibility.
            addMigrationWarning(report, `customType "${name}" collides with a vis built-in and was dropped — vis already lints this surface.`);
            continue;
        }

        const entry: ExtraCustomType = { name, path, strategy };

        if (strategy === "string") {
            const { depName } = raw;

            if (typeof depName === "string" && depName.length > 0) {
                entry.depName = depName;
            } else {
                addMigrationWarning(
                    report,
                    `customType "${name}" uses strategy "string" but has no \`depName\` — vis requires it. Add it manually after migration.`,
                );
                addManualStep(report, `Set policy.customTypes.extraTypes[name="${name}"].depName before running vis lint`);
            }
        }

        out.push(entry);
    }

    return out;
};

const isVersionGroupBanned = (group: Record<string, unknown>): boolean => group["isBanned"] === true;

const noteUnsupportedKeys = (config: SyncpackConfig, report: MigrationReport): void => {
    if (Array.isArray(config.versionGroups) && config.versionGroups.length > 0) {
        // `isBanned` versionGroups translate to policy.bannedDeps elsewhere
        // (with packages scope when set). The remainder — pinVersion,
        // snapTo, policy: "sameRange", and the rest of the DSL — has no
        // 1:1 mapping today. Malformed entries (null / non-object) are
        // skipped here so they don't inflate the count; raw config
        // validation is upstream.
        const remaining = config.versionGroups.filter((g) => g && typeof g === "object" && !isVersionGroupBanned(g as Record<string, unknown>));

        if (remaining.length > 0) {
            addMigrationWarning(
                report,
                `${String(remaining.length)} versionGroups rule(s) cannot be migrated — \`pinVersion\`, \`snapTo\`, and \`policy: "sameRange"\` (and other versionGroups DSL surfaces) are tracked in https://github.com/visulima/visulima/issues/622.`,
            );
            addManualStep(
                report,
                "Re-implement versionGroups rules using `pinVersion` / `snapTo` / `policy: \"sameRange\"` once the vis DSL ships (issue #622).",
            );
        }
    }

    if (Array.isArray(config.semverGroups) && config.semverGroups.length > 0) {
        addMigrationWarning(
            report,
            `${String(config.semverGroups.length)} semverGroups rule(s) cannot be migrated — semverGroups DSL is tracked in https://github.com/visulima/visulima/issues/622.`,
        );
        addManualStep(report, "Re-implement semverGroups rules manually once the vis DSL ships (issue #622)");
    }

    if (Array.isArray(config.dependencyTypes) && config.dependencyTypes.length > 0) {
        addManualStep(
            report,
            `Review syncpack \`dependencyTypes\` — vis applies policies to dependencies/devDependencies/peerDependencies/optionalDependencies/overrides by default. Narrow via policy.* filters if needed.`,
        );
    }

    if (Array.isArray(config.specifierTypes) && config.specifierTypes.length > 0) {
        addManualStep(
            report,
            `Review syncpack \`specifierTypes\` — vis has no direct equivalent today; specifier filtering belongs in versionGroups (issue #622).`,
        );
    }

    if (typeof config.filter === "string" && config.filter.length > 0) {
        addManualStep(report, `Re-implement syncpack \`filter\` regex (${config.filter}) once vis exposes a top-level dep filter.`);
    }

    if (
        (Array.isArray(config.sortAz) && config.sortAz.length > 0)
        || (Array.isArray(config.sortFirst) && config.sortFirst.length > 0)
        || (Array.isArray(config.sortExports) && config.sortExports.length > 0)
    ) {
        addMigrationWarning(
            report,
            "syncpack sort options (sortAz / sortFirst / sortExports) are superseded by `vis sort-package-json` — no migration needed.",
        );
    }

    if (config.sortPackages !== undefined || config.formatBugs !== undefined || config.formatRepository !== undefined) {
        addMigrationWarning(
            report,
            "syncpack package.json shape options (sortPackages / formatBugs / formatRepository) are superseded by `vis sort-package-json` — no migration needed.",
        );
    }

    if (config.lintFormatting !== undefined || config.lintSemverRanges !== undefined || config.lintVersions !== undefined) {
        addMigrationWarning(
            report,
            "syncpack lint toggles (lintFormatting / lintSemverRanges / lintVersions) are covered by `vis lint` by default — no migration needed.",
        );
    }

    if (Array.isArray(config.source) && config.source.length > 0) {
        addManualStep(
            report,
            `syncpack \`source\` was set to [${config.source.map((g) => JSON.stringify(g)).join(", ")}]. vis derives workspace globs from pnpm-workspace.yaml / package.json#workspaces — verify they match before relying on \`vis lint\`.`,
        );
    }

    if (typeof config.indent === "string" && config.indent.length > 0) {
        addMigrationWarning(
            report,
            "syncpack `indent` is implicit in vis — JSON writers honor `.editorconfig` (and the source file's existing indentation). No migration needed.",
        );
    }
};

/**
 * Pull every `versionGroups[].isBanned: true` entry into a vis
 * `policy.bannedDeps` map. With the new `packages` scope on
 * `BannedDepRule`, scoped bans translate cleanly: each banned dep
 * becomes one entry, the syncpack `label` becomes the reason, and the
 * group's `packages` glob list becomes the rule's scope. Rules without
 * `packages` collapse to the simple string form.
 *
 * Conflicts between two banned versionGroups targeting the same dep
 * keep the first entry — we surface a warning so reviewers can untangle
 * by hand if needed.
 */
const translateBannedDeps = (config: SyncpackConfig, report: MigrationReport): Record<string, BannedDepRule> => {
    const out: Record<string, BannedDepRule> = {};

    if (!Array.isArray(config.versionGroups)) {
        return out;
    }

    for (const raw of config.versionGroups) {
        if (!raw || typeof raw !== "object") {
            continue;
        }

        const group = raw as Record<string, unknown>;

        if (!isVersionGroupBanned(group)) {
            continue;
        }

        const deps = Array.isArray(group["dependencies"])
            ? (group["dependencies"] as unknown[]).filter((d): d is string => typeof d === "string" && d.length > 0)
            : [];

        if (deps.length === 0) {
            addMigrationWarning(report, "versionGroup with `isBanned: true` has no `dependencies` entries — skipped.");
            continue;
        }

        const packages = Array.isArray(group["packages"])
            ? (group["packages"] as unknown[]).filter((p): p is string => typeof p === "string" && p.length > 0)
            : [];

        const labelRaw = group["label"];
        const reason = typeof labelRaw === "string" && labelRaw.length > 0 ? labelRaw : "banned via syncpack versionGroups";

        for (const dep of deps) {
            if (out[dep] !== undefined) {
                addMigrationWarning(report, `Multiple banned versionGroups target "${dep}" — kept the first match; merge manually if needed.`);
                continue;
            }

            out[dep] = packages.length > 0 ? { packages, reason } : reason;
        }
    }

    return out;
};

// Config writing ----------------------------------------------------

const formatExtraTypeLiteral = (entry: ExtraCustomType): string => {
    const parts: string[] = [`name: ${JSON.stringify(entry.name)}`, `path: ${JSON.stringify(entry.path)}`, `strategy: ${JSON.stringify(entry.strategy)}`];

    if (entry.depName !== undefined) {
        parts.push(`depName: ${JSON.stringify(entry.depName)}`);
    }

    return `                { ${parts.join(", ")} }`;
};

const formatBannedDepRule = (name: string, rule: BannedDepRule): string => {
    if (typeof rule === "string") {
        return `            ${JSON.stringify(name)}: ${JSON.stringify(rule)}`;
    }

    const parts = [`reason: ${JSON.stringify(rule.reason)}`];

    if (rule.packages && rule.packages.length > 0) {
        parts.push(`packages: [${rule.packages.map((p) => JSON.stringify(p)).join(", ")}]`);
    }

    if (rule.paths && rule.paths.length > 0) {
        parts.push(`paths: [${rule.paths.map((p) => JSON.stringify(p)).join(", ")}]`);
    }

    if (rule.replacement !== undefined) {
        parts.push(`replacement: ${JSON.stringify(rule.replacement)}`);
    }

    return `            ${JSON.stringify(name)}: { ${parts.join(", ")} }`;
};

const generatePolicySnippet = (extraTypes: ExtraCustomType[], bannedDeps: Record<string, BannedDepRule> = {}): string => {
    const blocks: string[] = [];
    const bannedEntries = Object.entries(bannedDeps);

    if (bannedEntries.length > 0) {
        const rows = bannedEntries.map(([name, rule]) => formatBannedDepRule(name, rule)).join(",\n");

        blocks.push(`        bannedDeps: {\n${rows},\n        }`);
    }

    if (extraTypes.length > 0) {
        const rows = extraTypes.map((entry) => formatExtraTypeLiteral(entry)).join(",\n");

        blocks.push(`        customTypes: {\n            extraTypes: [\n${rows},\n            ],\n        }`);
    }

    return `    policy: {\n${blocks.join(",\n")},\n    }`;
};

const summarizePolicyContents = (extraTypes: ExtraCustomType[], bannedDeps: Record<string, BannedDepRule>): string => {
    const parts: string[] = [];
    const bannedCount = Object.keys(bannedDeps).length;

    if (extraTypes.length > 0) {
        parts.push(`${String(extraTypes.length)} customType(s)`);
    }

    if (bannedCount > 0) {
        parts.push(`${String(bannedCount)} bannedDep(s)`);
    }

    return parts.join(" + ");
};

const insertPolicyIntoVisConfig = (
    root: string,
    extraTypes: ExtraCustomType[],
    logger: MigrateLogger,
    bannedDeps: Record<string, BannedDepRule> = {},
): boolean => {
    const summary = summarizePolicyContents(extraTypes, bannedDeps);

    if (summary === "") {
        return false;
    }

    const configPath = findVisConfigFile(root);

    if (configPath) {
        const content = readFileSync(configPath);

        if (POLICY_KEY_RE.test(content)) {
            // Existing `policy:` key — too brittle to splice into without a
            // proper AST; punt to a manual step.
            logger.warn(`vis.config.ts already has a "policy" block — please merge ${summary} manually.`);

            return false;
        }

        const snippet = generatePolicySnippet(extraTypes, bannedDeps);
        let updated: string | undefined;

        if (DEFINE_CONFIG_RE.test(content)) {
            updated = content.replace(DEFINE_CONFIG_RE, `$1\n${snippet},`);
        } else if (EXPORT_DEFAULT_RE.test(content)) {
            updated = content.replace(EXPORT_DEFAULT_RE, `$1\n${snippet},`);
        }

        if (updated) {
            backupFile(configPath);
            writeFileSync(configPath, updated, "utf8");
            logger.info(`Merged ${summary} into ${configPath}`);

            return true;
        }

        logger.warn(`Could not auto-insert policy block into ${configPath} — please add manually`);

        return false;
    }

    const newConfigPath = join(root, "vis.config.ts");
    const snippet = generatePolicySnippet(extraTypes, bannedDeps);
    const content = `import { defineConfig } from "@visulima/vis/config";\n\nexport default defineConfig({\n${snippet},\n});\n`;

    writeFileSync(newConfigPath, content, "utf8");
    logger.info(`Created ${newConfigPath} with ${summary}`);

    return true;
};

// Cleanup -----------------------------------------------------------

const removeSyncpackFromPackageJson = (
    root: string,
    useEditorconfig?: boolean,
): {
    catalogStripped: boolean;
    configRemoved: boolean;
    dependencyRemoved: boolean;
    removedScripts: { name: string; value: string }[];
    scriptCount: number;
} => {
    const packageJsonPath = join(root, "package.json");
    const result: {
        catalogStripped: boolean;
        configRemoved: boolean;
        dependencyRemoved: boolean;
        removedScripts: { name: string; value: string }[];
        scriptCount: number;
    } = { catalogStripped: false, configRemoved: false, dependencyRemoved: false, removedScripts: [], scriptCount: 0 };

    if (!isAccessibleSync(packageJsonPath)) {
        return result;
    }

    const content = readFileSync(packageJsonPath);
    const pkg = JSON.parse(content) as Record<string, unknown>;
    let modified = false;

    if (pkg["syncpack"]) {
        delete pkg["syncpack"];
        modified = true;
        result.configRemoved = true;
    }

    for (const key of ["dependencies", "devDependencies"] as const) {
        const bucket = pkg[key] as Record<string, string> | undefined;

        if (bucket?.["syncpack"]) {
            delete bucket["syncpack"];
            modified = true;
            result.dependencyRemoved = true;
        }
    }

    // Bun catalog protocol — `workspaces.catalog.syncpack` and `workspaces.catalogs.<name>.syncpack`.
    const workspaces = pkg["workspaces"] as Record<string, unknown> | undefined;

    if (workspaces && typeof workspaces === "object" && !Array.isArray(workspaces)) {
        const catalog = workspaces["catalog"] as Record<string, string> | undefined;

        if (catalog && typeof catalog["syncpack"] === "string") {
            delete catalog["syncpack"];
            modified = true;
            result.catalogStripped = true;
        }

        const catalogs = workspaces["catalogs"] as Record<string, Record<string, string>> | undefined;

        if (catalogs && typeof catalogs === "object") {
            for (const named of Object.values(catalogs)) {
                if (named && typeof named["syncpack"] === "string") {
                    delete named["syncpack"];
                    modified = true;
                    result.catalogStripped = true;
                }
            }
        }
    }

    // Top-level `catalog` (non-workspaces shape) — bun also accepts this.
    const topLevelCatalog = pkg["catalog"] as Record<string, string> | undefined;

    if (topLevelCatalog && typeof topLevelCatalog["syncpack"] === "string") {
        delete topLevelCatalog["syncpack"];
        modified = true;
        result.catalogStripped = true;
    }

    const scripts = pkg["scripts"] as Record<string, string> | undefined;

    if (scripts) {
        const kept: Record<string, string> = {};

        for (const [name, value] of Object.entries(scripts)) {
            if (typeof value === "string" && SYNCPACK_SCRIPT_RE.test(value)) {
                result.scriptCount += 1;
                result.removedScripts.push({ name, value });
                modified = true;
            } else {
                kept[name] = value;
            }
        }

        if (result.scriptCount > 0) {
            if (Object.keys(kept).length === 0) {
                delete pkg["scripts"];
            } else {
                pkg["scripts"] = kept;
            }
        }
    }

    if (modified) {
        const indent = detectJsonIndent(packageJsonPath, content, { useEditorconfig });

        backupFile(packageJsonPath);
        writeFileSync(packageJsonPath, `${JSON.stringify(pkg, undefined, indent)}\n`, "utf8");
    }

    return result;
};

const HOOK_CANDIDATES = [".husky/pre-commit", ".vis-hooks/pre-commit", ".git/hooks/pre-commit"] as const;

const CI_PATH_CANDIDATES = [".github/workflows", ".gitlab-ci.yml", ".circleci/config.yml", ".woodpecker.yml", ".drone.yml"] as const;

/**
 * Heuristic CI scan for `syncpack` references. We don't try to rewrite
 * YAML — too many shapes (run/script/cmd, multi-line `|`, conditionals)
 * and the wrong replacement (`vis lint` vs `vis sort-package-json`)
 * depends on the original subcommand. Just surface a manual step per
 * file we see referencing it.
 */
const detectCiReferences = (root: string, report: MigrationReport): string[] => {
    const hits: string[] = [];

    const scanFile = (rel: string): void => {
        const abs = join(root, rel);

        if (!isAccessibleSync(abs)) {
            return;
        }

        if (SYNCPACK_SCRIPT_RE.test(readFileSync(abs))) {
            hits.push(rel);
            addManualStep(report, `Update ${rel} — replace \`syncpack\` invocation(s) with \`vis lint\` / \`vis sort-package-json\` as appropriate.`);
        }
    };

    for (const rel of CI_PATH_CANDIDATES) {
        const abs = join(root, rel);

        if (!isAccessibleSync(abs)) {
            continue;
        }

        if (rel === ".github/workflows") {
            try {
                for (const entry of readdirSync(abs)) {
                    if (entry.endsWith(".yml") || entry.endsWith(".yaml")) {
                        scanFile(`.github/workflows/${entry}`);
                    }
                }
            } catch {
                // Unreadable directory — best-effort; skip.
            }

            continue;
        }

        scanFile(rel);
    }

    return hits;
};

/**
 * Scan known pre-commit hook locations for `syncpack` invocations.
 * No auto-rewrite — `syncpack lint` ≈ `vis lint`, `syncpack format` ≈
 * `vis sort-package-json`, and the rest (`fix-mismatches`,
 * `set-semver-ranges`, …) have no 1:1 vis equivalent — too brittle to
 * guess. Surface as manual steps so the reviewer makes the call.
 */
const detectHookReferences = (root: string, report: MigrationReport): string[] => {
    const hits: string[] = [];

    for (const rel of HOOK_CANDIDATES) {
        const abs = join(root, rel);

        if (!isAccessibleSync(abs)) {
            continue;
        }

        if (SYNCPACK_SCRIPT_RE.test(readFileSync(abs))) {
            hits.push(rel);
            addManualStep(report, `Update ${rel} — replace \`syncpack\` invocation with \`vis lint\` / \`vis sort-package-json\` as appropriate.`);
        }
    }

    return hits;
};

/**
 * Strip `syncpack` entries from pnpm-workspace.yaml's `catalog` and
 * any named bucket under `catalogs.&lt;name>`. Round-trips through the
 * yaml writer so comments are not preserved — but this is a one-time
 * migration and the file is backed up first.
 */
const removeSyncpackFromPnpmCatalogs = (root: string): boolean => {
    const yamlPath = join(root, "pnpm-workspace.yaml");

    if (!isAccessibleSync(yamlPath)) {
        return false;
    }

    let parsed: Record<string, unknown> | undefined;

    try {
        parsed = readYamlSync(yamlPath);
    } catch {
        return false;
    }

    if (!parsed || typeof parsed !== "object") {
        return false;
    }

    let modified = false;

    const catalog = parsed["catalog"] as Record<string, string> | undefined;

    if (catalog && typeof catalog["syncpack"] === "string") {
        delete catalog["syncpack"];
        modified = true;
    }

    const catalogs = parsed["catalogs"] as Record<string, Record<string, string>> | undefined;

    if (catalogs && typeof catalogs === "object") {
        for (const named of Object.values(catalogs)) {
            if (named && typeof named["syncpack"] === "string") {
                delete named["syncpack"];
                modified = true;
            }
        }
    }

    if (modified) {
        backupFile(yamlPath);
        writeYamlSync(yamlPath, parsed);
    }

    return modified;
};

const removeSyncpackConfigFiles = (root: string, report: MigrationReport): void => {
    for (const file of [...SYNCPACK_JSON_CONFIG_FILES, ...SYNCPACK_YAML_CONFIG_FILES]) {
        const filePath = join(root, file);

        if (isAccessibleSync(filePath)) {
            backupFile(filePath, report);
            unlinkSync(filePath);

            bumpPerMigration(report, MIGRATION_ID, "removedConfigCount");
        }
    }
};

// Orchestrator ------------------------------------------------------

const applyMigration = (
    root: string,
    config: SyncpackConfig,
    options: { silent?: boolean; useEditorconfig?: boolean },
    logger: MigrateLogger,
    report: MigrationReport,
): void => {
    const extraTypes = translateCustomTypes(config, report);

    noteUnsupportedKeys(config, report);

    const hookHits = detectHookReferences(root, report);

    if (hookHits.length > 0 && !options.silent) {
        logger.warn(`Found syncpack reference in ${String(hookHits.length)} hook file(s) — see manualSteps for details.`);
    }

    const ciHits = detectCiReferences(root, report);

    if (ciHits.length > 0 && !options.silent) {
        logger.warn(`Found syncpack reference in ${String(ciHits.length)} CI file(s) — see manualSteps for details.`);
    }

    const bannedDeps = translateBannedDeps(config, report);

    if (extraTypes.length > 0 || Object.keys(bannedDeps).length > 0) {
        insertPolicyIntoVisConfig(root, extraTypes, logger, bannedDeps);
    }

    const { catalogStripped, configRemoved, dependencyRemoved, removedScripts, scriptCount } = removeSyncpackFromPackageJson(root, options.useEditorconfig);

    if (configRemoved && !options.silent) {
        logger.info("Removed `syncpack` block from package.json");
    }

    if (dependencyRemoved) {
        bumpPerMigration(report, MIGRATION_ID, "removedPackageCount");
    }

    const pnpmCatalogStripped = removeSyncpackFromPnpmCatalogs(root);

    if ((catalogStripped || pnpmCatalogStripped) && !options.silent) {
        logger.info("Stripped `syncpack` from catalog protocol entries.");
    }

    if (scriptCount > 0) {
        bumpPerMigration(report, MIGRATION_ID, "rewrittenScriptCount", scriptCount);

        for (const { name, value } of removedScripts) {
            // We strip the *whole* script entry rather than rewriting in place
            // — `syncpack lint` ≈ `vis lint`, but `syncpack fix-mismatches` /
            // `set-semver-ranges` have no 1:1 mapping, and chained commands
            // (`syncpack lint && eslint .`) would lose the non-syncpack half.
            // Surface each removed script so reviewers can recreate intentionally.
            addManualStep(
                report,
                `Recreate script \`${name}\` (removed; was \`${value}\`). Replace \`syncpack\` with \`vis lint\` / \`vis sort-package-json\` as appropriate.`,
            );
        }

        if (!options.silent) {
            logger.info(
                `Removed ${String(scriptCount)} script(s) referencing \`syncpack\`. Replace with \`vis lint\` / \`vis sort-package-json\` as appropriate.`,
            );
        }
    }

    removeSyncpackConfigFiles(root, report);
};

/**
 * Migrates a syncpack configuration to vis. Auto-translates `customTypes`
 * (record → array, dropping built-in collisions), strips the syncpack
 * dependency + scripts, and routes everything we can't translate today
 * (versionGroups, semverGroups, regex filters, …) into manualSteps so
 * the reviewer sees what's still pending. TS/JS configs are out of scope
 * for v1 — vis migrate does not load executable config. Tracked in
 * https://github.com/visulima/visulima/issues/622.
 */
const migrateSyncpack = (
    root: string,
    options: { dryRun: boolean; silent?: boolean; useEditorconfig?: boolean },
    logger: MigrateLogger,
    report: MigrationReport,
): boolean => {
    const source = detectSyncpackConfig(root);

    if (!source) {
        if (!options.silent) {
            logger.info("No syncpack configuration found — nothing to migrate.");
        }

        return false;
    }

    const unsupported = hasUnsupportedSyncpackConfig(root);

    if (unsupported) {
        addMigrationWarning(
            report,
            `Syncpack config ${unsupported} is a TS/JS format vis migrate cannot load — executable config support is tracked in https://github.com/visulima/visulima/issues/622. Convert to .syncpackrc.json and re-run.`,
        );
        addManualStep(
            report,
            `Convert ${unsupported} to .syncpackrc.json (or translate it directly into policy.customTypes.extraTypes in vis.config.ts) — see https://github.com/visulima/visulima/issues/622`,
        );

        if (!options.silent) {
            logger.warn(`Cannot read ${unsupported} — manual migration required (https://github.com/visulima/visulima/issues/622).`);
        }
    }

    if (hasPolicyExtraTypesInVisConfig(root)) {
        addMigrationWarning(
            report,
            "vis.config.ts already declares `policy.customTypes.extraTypes` — skipping syncpack customTypes merge to avoid duplicates.",
        );

        if (!options.silent) {
            logger.warn("vis.config.ts already has policy.customTypes.extraTypes — skipping merge");
        }
    }

    const config = extractConfig(root, source, report);

    if (!config) {
        return false;
    }

    if (options.dryRun) {
        const previewExtras = translateCustomTypes(config, report);
        const previewBanned = translateBannedDeps(config, report);

        noteUnsupportedKeys(config, report);
        detectHookReferences(root, report);
        detectCiReferences(root, report);

        const summary = summarizePolicyContents(previewExtras, previewBanned);

        if (!options.silent) {
            if (summary === "") {
                logger.info("[dry-run] No policy entries to merge — manualSteps will surface the rest.");
            } else {
                logger.info(`[dry-run] Would merge ${summary} into vis.config.ts:`);
                logger.info(generatePolicySnippet(previewExtras, previewBanned));
            }
        }

        return true;
    }

    applyMigration(root, config, options, logger, report);

    return true;
};

export {
    detectSyncpackConfig,
    extractSyncpackFromPackageJson,
    generatePolicySnippet,
    hasPolicyExtraTypesInVisConfig,
    hasUnsupportedSyncpackConfig,
    insertPolicyIntoVisConfig,
    migrateSyncpack,
    parseSyncpackJsonFile,
    parseSyncpackYamlFile,
    removeSyncpackConfigFiles,
    removeSyncpackFromPackageJson,
    SYNCPACK_ALL_CONFIG_FILES,
    SYNCPACK_JSON_CONFIG_FILES,
    SYNCPACK_UNSUPPORTED_CONFIG_FILES,
    SYNCPACK_YAML_CONFIG_FILES,
    translateBannedDeps,
    translateCustomTypes,
};
