import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";

import type { MigrationReport } from "./types";

interface Logger {
    info: (message: string) => void;
    warn: (message: string) => void;
}

interface NxJson {
    namedInputs?: Record<string, (string | Record<string, unknown>)[]>;
    targetDefaults?: Record<string, {
        cache?: boolean;
        dependsOn?: string[];
        inputs?: (string | Record<string, unknown>)[];
        outputs?: string[];
        options?: Record<string, unknown>;
    }>;
    defaultBase?: string;
    affected?: {
        defaultBase?: string;
    };
}

const renderVisConfig = (nx: NxJson): string => {
    const configObject: Record<string, unknown> = {};

    if (nx.namedInputs && Object.keys(nx.namedInputs).length > 0) {
        configObject.namedInputs = nx.namedInputs;
    }

    if (nx.targetDefaults && Object.keys(nx.targetDefaults).length > 0) {
        configObject.targetDefaults = nx.targetDefaults;
    }

    const serialised = JSON.stringify(configObject, null, 4)
        .replaceAll(/"(\w+)":/g, "$1:");

    return [
        "// Migrated from nx.json by `vis migrate nx`.",
        "// Per-project project.json files are compatible with vis and do not need to be rewritten —",
        "// vis already reads targets, tags, implicitDependencies, and sourceRoot.",
        "",
        "import { defineConfig } from \"@visulima/vis/config\";",
        "",
        `export default defineConfig(${serialised});`,
        "",
    ].join("\n");
};

/**
 * Nx → vis migration. The good news: vis's `project.json` shape is
 * already compatible with Nx's, so the only thing we need to migrate
 * is `nx.json` (workspace-level named inputs and target defaults).
 * Per-project `project.json` files are left untouched.
 */
export const migrateNx = (
    workspaceRoot: string,
    options: { dryRun?: boolean } = {},
    logger: Logger,
    report: MigrationReport,
): void => {
    const nxJsonPath = join(workspaceRoot, "nx.json");

    if (!existsSync(nxJsonPath)) {
        logger.warn("No nx.json found in workspace root — nothing to migrate.");
        report.warnings.push("No nx.json at workspace root.");

        return;
    }

    let nx: NxJson;

    try {
        nx = JSON.parse(readFileSync(nxJsonPath, "utf8")) as NxJson;
    } catch (error) {
        throw new Error(`Failed to parse ${nxJsonPath}: ${(error as Error).message}`);
    }

    const visConfigPath = join(workspaceRoot, "vis.config.ts");

    if (existsSync(visConfigPath) && !options.dryRun) {
        logger.warn("vis.config.ts already exists — refusing to overwrite. Remove it first or run with --dry-run.");
        report.warnings.push("vis.config.ts already exists; migration skipped writing the file.");

        return;
    }

    const rendered = renderVisConfig(nx);

    if (options.dryRun) {
        logger.info("── vis.config.ts (preview) ──");
        logger.info(rendered);
        logger.info("── end preview ──");
    } else {
        writeFileSync(visConfigPath, rendered);
        logger.info(`Wrote ${visConfigPath}`);
    }

    report.manualSteps.push(
        "Existing project.json files are vis-compatible and have been left untouched. Rename `sourceRoot` → `sourceRoot` is identical; `tags`, `implicitDependencies`, and `targets` translate directly.",
    );

    if (nx.affected?.defaultBase || nx.defaultBase) {
        report.manualSteps.push(
            `nx's default base branch (${nx.affected?.defaultBase ?? nx.defaultBase}) is honoured by vis via the --base flag; no vis config change needed.`,
        );
    }
};
