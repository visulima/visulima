import type { MigrateLogger, MigrationReport } from "./types";
import { readJsonConfig, serializeConfigObject, writeVisConfig } from "./shared";

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

    const serialised = serializeConfigObject(configObject);

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
 * Nx -> vis migration. vis's `project.json` shape is already compatible
 * with Nx's, so only `nx.json` (workspace-level named inputs and target
 * defaults) needs translating.
 */
export const migrateNx = (
    workspaceRoot: string,
    options: { dryRun?: boolean },
    logger: MigrateLogger,
    report: MigrationReport,
): void => {
    const nx = readJsonConfig<NxJson>(workspaceRoot, "nx.json");

    if (!nx) {
        logger.warn("No nx.json found in workspace root — nothing to migrate.");
        report.warnings.push("No nx.json at workspace root.");

        return;
    }

    const rendered = renderVisConfig(nx);

    if (!writeVisConfig(workspaceRoot, rendered, options, logger, report)) {
        return;
    }

    report.manualSteps.push(
        "Existing project.json files are vis-compatible and have been left untouched. Rename `sourceRoot` -> `sourceRoot` is identical; `tags`, `implicitDependencies`, and `targets` translate directly.",
    );

    if (nx.affected?.defaultBase || nx.defaultBase) {
        report.manualSteps.push(
            `nx's default base branch (${nx.affected?.defaultBase ?? nx.defaultBase}) is honoured by vis via the --base flag; no vis config change needed.`,
        );
    }
};
