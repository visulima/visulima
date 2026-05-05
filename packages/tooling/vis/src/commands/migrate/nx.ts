import { join } from "@visulima/path";

import { readJsonConfig, serializeConfigObject, writeVisConfig } from "./shared";
import type { MigrateLogger, MigrationReport } from "./types";

interface NxJson {
    affected?: {
        defaultBase?: string;
    };
    defaultBase?: string;
    namedInputs?: Record<string, (string | Record<string, unknown>)[]>;
    targetDefaults?: Record<
        string,
        {
            cache?: boolean;
            dependsOn?: string[];
            inputs?: (string | Record<string, unknown>)[];
            options?: Record<string, unknown>;
            outputs?: string[];
        }
    >;
}

const renderVisConfig = (nx: NxJson, workspaceRoot: string, useEditorconfig?: boolean): string => {
    const configObject: Record<string, unknown> = {};

    if (nx.namedInputs && Object.keys(nx.namedInputs).length > 0) {
        configObject.namedInputs = nx.namedInputs;
    }

    if (nx.targetDefaults && Object.keys(nx.targetDefaults).length > 0) {
        configObject.targetDefaults = nx.targetDefaults;
    }

    const serialised = serializeConfigObject(configObject, join(workspaceRoot, "vis.config.ts"), useEditorconfig);

    return [
        "// Migrated from nx.json by `vis migrate nx`.",
        "// Per-project project.json files are compatible with vis and do not need to be rewritten —",
        "// vis already reads targets, tags, implicitDependencies, and sourceRoot.",
        "",
        'import { defineConfig } from "@visulima/vis/config";',
        "",
        `export default defineConfig(${serialised});`,
        "",
    ].join("\n");
};

/**
 * Translates an `nx.json` into a `vis.config.ts`. Per-project
 * `project.json` files are left untouched — vis reads them natively.
 * @param workspaceRoot Absolute workspace root path.
 * @param options Migration options.
 * @param options.dryRun When true, render the config but skip writing it to disk.
 * @param options.useEditorconfig When false, skip `.editorconfig` discovery for indent.
 * @param logger Logger for user feedback.
 * @param report Migration report to append manual steps and warnings.
 */
export const migrateNx = (
    workspaceRoot: string,
    options: { dryRun?: boolean; useEditorconfig?: boolean },
    logger: MigrateLogger,
    report: MigrationReport,
): void => {
    const nx = readJsonConfig<NxJson>(workspaceRoot, "nx.json");

    if (!nx) {
        logger.warn("No nx.json found in workspace root — nothing to migrate.");
        report.warnings.push("No nx.json at workspace root.");

        return;
    }

    const rendered = renderVisConfig(nx, workspaceRoot, options.useEditorconfig);

    if (!writeVisConfig(workspaceRoot, rendered, options, logger, report)) {
        return;
    }

    report.manualSteps.push(
        "Existing project.json files are vis-compatible and have been left untouched. Rename `sourceRoot` -> `sourceRoot` is identical; `tags`, `implicitDependencies`, and `targets` translate directly.",
    );
    report.manualSteps.push(
        "vis adds two task primitives nx doesn't expose declaratively: `when: { os, env, branch, ci, not.* }` for conditional execution (replaces ad-hoc `configurations`) and `always: true` for finally/teardown tasks that run even when upstream fails. See docs/guides/conditional-and-finally-tasks.mdx.",
    );

    if (nx.affected?.defaultBase || nx.defaultBase) {
        report.manualSteps.push(
            `nx's default base branch (${nx.affected?.defaultBase ?? nx.defaultBase}) is honoured by vis via the --base flag; no vis config change needed.`,
        );
    }
};
