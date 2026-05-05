import { readFileSync } from "node:fs";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { writeFileSync, writeJsonSync } from "@visulima/fs";
import { join, relative } from "@visulima/path";
import zeptomatch from "zeptomatch";

import { discoverWorkspace } from "../../config/workspace";
import { buildCodeownersLines, renderCodeowners } from "../../util/codeowners";
import type { SyncFieldsChange } from "../../util/sync-package-json-fields";
import { applyFieldChanges, computeFieldChanges, DEFAULT_SYNCED_FIELDS } from "../../util/sync-package-json-fields";
import { collectWorkspaceDirectories, readPkg } from "../../util/workspace-deps";
import type { SyncOptions } from "./index";

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

/**
 * `multiple: true` means cerebro returns one entry per `--fields` flag, but
 * users typically write `--fields license,engines` once. Split on commas, trim,
 * dedupe, fall back to defaults when empty.
 */
const parseFieldsOption = (raw: string[] | undefined): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];

    for (const entry of raw ?? []) {
        for (const piece of entry.split(",")) {
            const name = piece.trim();

            if (name.length === 0 || seen.has(name)) {
                continue;
            }

            seen.add(name);
            out.push(name);
        }
    }

    return out.length > 0 ? out : [...DEFAULT_SYNCED_FIELDS];
};

const matchesAnyGlob = (name: string, globs: string[]): boolean => globs.some((pattern) => zeptomatch(pattern, name));

const runCodeowners = ({ logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, SyncOptions>): void => {
    const { workspace } = discoverWorkspace(wsRoot as string, visConfig);
    const lines = buildCodeownersLines(workspace, visConfig?.codeowners);

    if (lines.length === 0) {
        logger.info("No `owners` entries found in any project. Nothing to sync.");

        return;
    }

    const rendered = renderCodeowners(lines, visConfig?.codeowners?.provider ?? "github");
    const outPath = options.out ? join(wsRoot as string, options.out) : join(wsRoot as string, "CODEOWNERS");

    if (options.check) {
        let existing = "";

        try {
            existing = readFileSync(outPath, "utf8");
        } catch (error: unknown) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                existing = "";
            } else {
                throw error;
            }
        }

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

const runPackageJsonFields = ({ logger, options, workspaceRoot: wsRoot }: Toolbox<Console, SyncOptions>): void => {
    const root = wsRoot as string;
    const rootPkg = readPkg(join(root, "package.json"));

    if (!rootPkg) {
        logger.error("Could not read root package.json. Nothing to sync.");
        process.exitCode = 1;

        return;
    }

    const fields = parseFieldsOption(options.fields);
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
            writeJsonSync(write.filePath, write.pkg, { detectIndent: true, overwrite: true });
        }
    }

    const reportChanges: PackageJsonReportChange[] = writes.flatMap((write) => write.pkgChanges.map((change) => {
        return {
            after: change.after,
            before: change.before,
            field: change.field,
            packageJsonPath: write.packageJsonPath,
            packageName: write.packageName,
        };
    }));

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

        logger.info(`Synced ${reportChanges.length} field${reportChanges.length === 1 ? "" : "s"} across ${writes.length} package${writes.length === 1 ? "" : "s"}.`);
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
        runCodeowners(toolbox);

        return;
    }

    if (kind === "package-json-fields") {
        runPackageJsonFields(toolbox);

        return;
    }

    throw new Error(`Unknown sync kind: "${kind}". Known kinds: ${KNOWN_KINDS.join(", ")}.`);
};

export default execute as CommandExecute<Toolbox>;
