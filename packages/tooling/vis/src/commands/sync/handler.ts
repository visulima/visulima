import { readFileSync } from "node:fs";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { writeFileSync, writeJsonSync } from "@visulima/fs";
import { join, relative } from "@visulima/path";
import zeptomatch from "zeptomatch";

import type { CodeownersSource } from "../../config/workspace";
import { discoverWorkspace } from "../../config/workspace";
import type { CodeownersLine } from "../../util/codeowners";
import {
    buildCodeownersLines,
    DEFAULT_BLOCK_MARKER,
    mergeIntoExisting,
    renderCodeowners,
    renderCodeownersBlock,
} from "../../util/codeowners";
import { collectMaintainerLines, collectNestedCodeownersLines } from "../../util/codeowners-sources";
import { resolveIndentForExistingFile } from "../../util/editorconfig";
import type { SyncFieldsChange } from "../../util/sync-package-json-fields";
import { applyFieldChanges, computeFieldChanges, DEFAULT_SYNCED_FIELDS } from "../../util/sync-package-json-fields";
import { collectWorkspaceDirectories, readPkg } from "../../util/workspace-deps";
import type { SyncOptions } from "./index";

const KNOWN_SOURCES: ReadonlySet<CodeownersSource> = new Set(["nested-codeowners", "package-json-maintainers", "project-json"]);

/**
 * Parses a repeated CLI flag like `--fields license,engines --fields author`
 * into a deduped string list. `cerebro` returns one entry per flag
 * occurrence; users typically write a single comma-separated value, so
 * we split each entry too. Falls back to the supplied default when the
 * normalised list is empty. The optional `validate` hook rejects unknown
 * tokens (used by `--from` to gate codeowners sources).
 */
const parseCsvOption = <T extends string>(
    raw: string[] | undefined,
    fallback: ReadonlyArray<T>,
    validate?: (value: string) => value is T,
): T[] => {
    const seen = new Set<T>();
    const out: T[] = [];

    for (const entry of raw ?? []) {
        for (const piece of entry.split(",")) {
            const name = piece.trim();

            if (name.length === 0) {
                continue;
            }

            if (validate && !validate(name)) {
                throw new Error(`Unknown codeowners source: "${name}". Known: ${[...KNOWN_SOURCES].join(", ")}.`);
            }

            const typed = name as T;

            if (seen.has(typed)) {
                continue;
            }

            seen.add(typed);
            out.push(typed);
        }
    }

    return out.length > 0 ? out : [...fallback];
};

const isCodeownersSource = (value: string): value is CodeownersSource => KNOWN_SOURCES.has(value as CodeownersSource);

const KNOWN_KINDS = ["codeowners", "package-json-fields"] as const;

interface PackageWrite {
    filePath: string;
    packageJsonPath: string;
    packageName: string | undefined;
    pkg: Record<string, unknown>;
    pkgChanges: SyncFieldsChange[];
}

interface PackageJsonReportChange {
    after: unknown;
    before: unknown;
    field: string;
    packageJsonPath: string;
    packageName: string | undefined;
}

interface PackageJsonReport {
    changes: PackageJsonReportChange[];
    fields: string[];
    kind: "package-json-fields";
    mode: "check" | "write";
    totalChanges: number;
    totalPackages: number;
}

const matchesAnyGlob = (name: string, globs: string[]): boolean => globs.some((pattern) => zeptomatch(pattern, name));

const runCodeowners = async ({ logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, SyncOptions>): Promise<void> => {
    const root = wsRoot as string;
    const { workspace } = discoverWorkspace(root, visConfig);
    const codeownersConfig = visConfig?.codeowners;

    const sources = parseCsvOption<CodeownersSource>(options.from, codeownersConfig?.sources ?? ["project-json"], isCodeownersSource);
    const regenerationCommand = options.regenerationCommand ?? codeownersConfig?.regenerationCommand;
    const preserveBlock = options.preserveBlock === true || codeownersConfig?.preserveBlock === true;
    const marker = codeownersConfig?.blockMarker ?? DEFAULT_BLOCK_MARKER;
    const nestedIncludes = options.nestedIncludes ?? codeownersConfig?.nestedIncludes;
    const outRelative = options.out ?? "CODEOWNERS";

    const extraLines: CodeownersLine[] = [];

    if (sources.includes("nested-codeowners")) {
        const nestedLines = await collectNestedCodeownersLines(root, nestedIncludes, outRelative);

        for (const line of nestedLines) {
            extraLines.push({ ...line, source: "nested" });
        }
    }

    if (sources.includes("package-json-maintainers")) {
        const maintainerLines = collectMaintainerLines(workspace, root);

        for (const line of maintainerLines) {
            extraLines.push({ ...line, source: "maintainers" });
        }
    }

    const lines = sources.includes("project-json")
        ? buildCodeownersLines(workspace, codeownersConfig, extraLines)
        : buildCodeownersLines({ projects: {} }, codeownersConfig, extraLines);

    if (lines.length === 0) {
        logger.info("No `owners` entries found in any source. Nothing to sync.");

        return;
    }

    const outPath = join(root, outRelative);

    let existing = "";

    try {
        existing = readFileSync(outPath, "utf8");
    } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw error;
        }
    }

    const renderOptions = { regenerationCommand };
    const rendered = preserveBlock ? mergeIntoExisting(existing, renderCodeownersBlock(lines, marker, renderOptions), marker) : renderCodeowners(lines, renderOptions);

    if (options.check) {
        if (existing.trim() !== rendered.trim()) {
            logger.error(`${outPath} is out of date. Run \`vis sync codeowners\` to update it.`);
            process.exitCode = 1;

            return;
        }

        logger.info(`${outPath} is up to date.`);

        return;
    }

    writeFileSync(outPath, rendered);
    logger.info(`Wrote ${lines.length} entries to ${outPath}`);
};

const runPackageJsonFields = ({ logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, SyncOptions>): void => {
    const root = wsRoot as string;
    const useEditorconfig = visConfig?.editorconfig ?? true;
    const rootPkg = readPkg(join(root, "package.json"));

    if (!rootPkg) {
        logger.error("Could not read root package.json. Nothing to sync.");
        process.exitCode = 1;

        return;
    }

    const fields = parseCsvOption(options.fields, DEFAULT_SYNCED_FIELDS);
    const ignoreGlobs = options.ignorePackageName ?? [];
    const checkMode = options.check === true;
    const format = (options.format ?? "human").toLowerCase();
    const quiet = options.quiet === true;

    const packageDirs = collectWorkspaceDirectories(root).filter((dir) => dir !== ".");
    const writes: PackageWrite[] = [];
    let scanned = 0;

    for (const dir of packageDirs) {
        const filePath = join(root, dir, "package.json");
        const pkg = readPkg(filePath);

        if (!pkg) {
            continue;
        }

        const pkgName = typeof pkg.name === "string" ? pkg.name : undefined;

        if (pkgName !== undefined && ignoreGlobs.length > 0 && matchesAnyGlob(pkgName, ignoreGlobs)) {
            continue;
        }

        scanned += 1;

        const pkgChanges = computeFieldChanges(rootPkg, pkg, { fields });

        if (pkgChanges.length === 0) {
            continue;
        }

        writes.push({
            filePath,
            packageJsonPath: relative(root, filePath),
            packageName: pkgName,
            pkg,
            pkgChanges,
        });
    }

    if (!checkMode) {
        for (const write of writes) {
            applyFieldChanges(write.pkg, write.pkgChanges);
            writeJsonSync(write.filePath, write.pkg, { indent: resolveIndentForExistingFile(write.filePath, { useEditorconfig }), overwrite: true });
        }
    }

    const reportChanges: PackageJsonReportChange[] = writes.flatMap((write) =>
        write.pkgChanges.map((change) => {
            return {
                after: change.after,
                before: change.before,
                field: change.field,
                packageJsonPath: write.packageJsonPath,
                packageName: write.packageName,
            };
        }),
    );

    const report: PackageJsonReport = {
        changes: reportChanges,
        fields,
        kind: "package-json-fields",
        mode: checkMode ? "check" : "write",
        totalChanges: reportChanges.length,
        totalPackages: scanned,
    };

    if (format === "json") {
        process.stdout.write(`${JSON.stringify(report, null, 4)}\n`);
    } else if (reportChanges.length === 0) {
        logger.info(`All ${scanned} package${scanned === 1 ? "" : "s"} in sync (fields: ${fields.join(", ")}).`);
    } else if (checkMode) {
        if (!quiet) {
            for (const change of reportChanges) {
                logger.error(`${change.packageJsonPath}: ${change.field} drifts from root`);
            }
        }

        logger.error(
            `Found ${reportChanges.length} field drift${reportChanges.length === 1 ? "" : "s"} across ${writes.length} package${writes.length === 1 ? "" : "s"}. Run \`vis sync package-json-fields\` to fix.`,
        );
    } else {
        if (!quiet) {
            for (const write of writes) {
                logger.info(`${write.packageJsonPath}: synced ${write.pkgChanges.map((c) => c.field).join(", ")}`);
            }
        }

        logger.info(
            `Synced ${reportChanges.length} field${reportChanges.length === 1 ? "" : "s"} across ${writes.length} package${writes.length === 1 ? "" : "s"}.`,
        );
    }

    if (checkMode && reportChanges.length > 0) {
        process.exitCode = 1;
    }
};

const execute = async (toolbox: Toolbox<Console, SyncOptions>): Promise<void> => {
    const kind = toolbox.argument[0];

    if (!kind) {
        throw new Error(`Missing sync kind. Usage: vis sync <kind> (known kinds: ${KNOWN_KINDS.join(", ")})`);
    }

    if (!toolbox.workspaceRoot) {
        throw new Error("Could not determine workspace root. Run inside a monorepo.");
    }

    if (kind === "codeowners") {
        await runCodeowners(toolbox);

        return;
    }

    if (kind === "package-json-fields") {
        runPackageJsonFields(toolbox);

        return;
    }

    throw new Error(`Unknown sync kind: "${kind}". Known kinds: ${KNOWN_KINDS.join(", ")}.`);
};

export default execute as CommandExecute<Toolbox>;
