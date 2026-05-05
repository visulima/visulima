import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { relative } from "@visulima/path";

import type { VisProjectConfiguration } from "../../config/workspace";
import { discoverWorkspace } from "../../config/workspace";
import { filterProjectsByQuery } from "../../task/selectors";
import { filterDepInstances } from "../../util/json-deps-filter";
import type { DepInstance, DepType } from "../../util/workspace-deps";
import { iterateWorkspaceDeps } from "../../util/workspace-deps";
import type { ListOptions } from "./index";

type ListFormat = "json" | "ndjson" | "table";

const VALID_FORMATS: ReadonlySet<string> = new Set(["json", "ndjson", "table"]);

const resolveFormat = (raw: string | undefined): ListFormat => {
    if (raw === undefined) {
        return "table";
    }

    const lower = raw.toLowerCase();

    if (!VALID_FORMATS.has(lower)) {
        throw new Error(`--format must be one of: table, json, ndjson (got "${raw}")`);
    }

    return lower as ListFormat;
};

const toDepRecord = (instance: DepInstance, workspaceRoot: string): Record<string, unknown> => {
    return {
        depName: instance.depName,
        depType: instance.depType,
        isInternal: instance.isInternal,
        packageDir: instance.packageDir,
        packageJsonPath: relative(workspaceRoot, instance.packageJsonPath),
        packageName: instance.packageName,
        specifier: instance.specifier,
    };
};

const KNOWN_DEP_TYPES: ReadonlySet<DepType> = new Set<DepType>([
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "overrides",
    "peerDependencies",
    "pnpm.overrides",
    "resolutions",
]);

const parseDepTypes = (raw: string[] | undefined): DepType[] | undefined => {
    if (!raw || raw.length === 0) {
        return undefined;
    }

    const parsed: DepType[] = [];
    const invalid: string[] = [];

    for (const entry of raw) {
        for (const piece of entry.split(",")) {
            const trimmed = piece.trim();

            if (!trimmed) {
                continue;
            }

            if (KNOWN_DEP_TYPES.has(trimmed as DepType)) {
                parsed.push(trimmed as DepType);
            } else {
                invalid.push(trimmed);
            }
        }
    }

    if (invalid.length > 0) {
        throw new Error(`Unknown --dep-type value(s): ${invalid.join(", ")}. Valid: ${[...KNOWN_DEP_TYPES].join(", ")}`);
    }

    return parsed.length > 0 ? parsed : undefined;
};

const execute = async ({ logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, ListOptions>): Promise<void> => {
    if (!wsRoot) {
        throw new Error("Could not determine workspace root.");
    }

    const format = resolveFormat(options.format);

    if (options.deps === true) {
        if (options.internalOnly && options.externalOnly) {
            throw new Error("--internal-only and --external-only are mutually exclusive");
        }

        const depTypes = parseDepTypes(options.depType);
        const instances = iterateWorkspaceDeps(wsRoot);
        let filtered = filterDepInstances(instances, {
            depTypes,
            excludePatterns: options.exclude,
            externalOnly: options.externalOnly,
            includePatterns: options.include,
            internalOnly: options.internalOnly,
        });

        if (options.query) {
            const { workspace } = discoverWorkspace(wsRoot, visConfig);
            const matching = new Set(filterProjectsByQuery(Object.keys(workspace.projects), workspace, options.query));

            // Workspace-scope rows (pnpm-workspace.yaml#overrides) have no
            // declaring package, so they can't match any project query —
            // drop them when --query is active.
            filtered = filtered.filter((inst) => inst.packageName !== undefined && matching.has(inst.packageName));
        }

        const sorted = [...filtered].sort((a, b) => {
            const left = `${a.packageName ?? a.packageDir} ${a.depType} ${a.depName}`;
            const right = `${b.packageName ?? b.packageDir} ${b.depType} ${b.depName}`;

            return left.localeCompare(right);
        });

        if (format === "ndjson") {
            for (const instance of sorted) {
                logger.info(JSON.stringify(toDepRecord(instance, wsRoot)));
            }

            return;
        }

        if (format === "json") {
            const records = sorted.map((instance) => toDepRecord(instance, wsRoot));

            logger.info(JSON.stringify(records, null, options.pretty === true ? 2 : undefined));

            return;
        }

        if (sorted.length === 0) {
            logger.info("No matching dep-instances.");

            return;
        }

        const header = ["Package", "Block", "Dep", "Specifier", "Internal", "Path"];
        const rows = sorted.map((instance) => [
            instance.packageName ?? instance.packageDir,
            instance.depType,
            instance.depName,
            instance.specifier,
            instance.isInternal ? "yes" : "no",
            relative(wsRoot, instance.packageJsonPath),
        ]);

        const widths = header.map((heading, i) => Math.max(heading.length, ...rows.map((row) => (row[i] ?? "").length)));
        const pad = (str: string, w: number): string => str.padEnd(w);

        logger.info(header.map((heading, i) => pad(heading, widths[i]!)).join("  "));
        logger.info(widths.map((w) => "─".repeat(w)).join("──"));

        for (const row of rows) {
            logger.info(row.map((cell, i) => pad(cell, widths[i]!)).join("  "));
        }

        logger.info("");
        logger.info(`${String(sorted.length)} dep-instance(s)`);

        return;
    }

    if (format === "ndjson") {
        throw new Error("--format=ndjson is only supported with --deps");
    }

    const { projectOptions, workspace } = discoverWorkspace(wsRoot, visConfig);
    let projectNames = Object.keys(workspace.projects).sort();

    if (options.query) {
        projectNames = filterProjectsByQuery(projectNames, workspace, options.query);
    }

    if (projectNames.length === 0) {
        logger.info("No projects found.");

        return;
    }

    const inferredOnly = options.inferred === true;
    const showTargets = options.targets === true || inferredOnly;

    if (format === "json") {
        const data = projectNames.map((name) => {
            const project = workspace.projects[name] as VisProjectConfiguration;
            const visTargets = projectOptions.get(name) ?? {};
            const targets = Object.entries(project.targets ?? {})
                .map(([targetName]) => {
                    const visTarget = visTargets[targetName];
                    const isInferred = visTarget?.inferred === true;

                    return {
                        aliases: visTarget?.aliases ?? [],
                        command: visTarget?.command,
                        description: visTarget?.description,
                        // Only emit the field when it's true — keeps the JSON
                        // shape additive instead of breaking downstream
                        // consumers that didn't know about `inferred` yet.
                        ...(isInferred ? { inferred: true } : {}),
                        name: targetName,
                        type: visTarget?.type,
                    };
                })
                .filter((target) => !inferredOnly || target.inferred === true);

            return {
                language: project.language,
                layer: project.layer,
                name,
                root: project.root,
                stack: project.stack,
                tags: project.tags ?? [],
                targets,
                type: project.projectType ?? "library",
            };
        });

        logger.info(JSON.stringify(data, null, 2));

        return;
    }

    const renderTable = (header: string[], rows: string[][]): void => {
        const widths = header.map((h, i) => {
            let maxData = 0;

            for (const row of rows) {
                maxData = Math.max(maxData, (row[i] ?? "").length);
            }

            return Math.max(h.length, maxData);
        });

        const pad = (str: string, w: number): string => str.padEnd(w);

        logger.info(header.map((h, i) => pad(h, widths[i]!)).join("  "));
        logger.info(widths.map((w) => "─".repeat(w)).join("──"));

        for (const row of rows) {
            logger.info(row.map((cell, i) => pad(cell, widths[i]!)).join("  "));
        }
    };

    if (showTargets) {
        const targetRows: string[][] = [];

        for (const name of projectNames) {
            const project = workspace.projects[name] as VisProjectConfiguration;
            const visTargets = projectOptions.get(name) ?? {};

            for (const targetName of Object.keys(project.targets ?? {}).sort()) {
                const visTarget = visTargets[targetName];
                const isInferred = visTarget?.inferred === true;

                if (inferredOnly && !isInferred) {
                    continue;
                }

                const targetConfig = project.targets?.[targetName];
                const cache = targetConfig?.cache === false ? "no" : targetConfig?.cache === true ? "yes" : "default";

                targetRows.push([name, targetName, visTarget?.type ?? "—", cache, isInferred ? "yes" : "no", visTarget?.description ?? "—"]);
            }
        }

        if (targetRows.length === 0) {
            logger.info(inferredOnly ? "No inferred targets found." : "No targets found.");

            return;
        }

        renderTable(["Project", "Target", "Type", "Cache", "Inferred", "Description"], targetRows);

        logger.info("");
        logger.info(`${String(targetRows.length)} target(s) across ${String(projectNames.length)} project(s)`);

        return;
    }

    const header = ["Project", "Type", "Layer", "Tags", "Targets"];
    const rows = projectNames.map((name) => {
        const project = workspace.projects[name] as VisProjectConfiguration;
        const targets = Object.keys(project.targets ?? {});

        return [
            name,
            project.projectType ?? "library",
            project.layer ?? "—",
            (project.tags ?? []).join(", ") || "—",
            targets.length > 4 ? `${targets.slice(0, 4).join(", ")}… (${String(targets.length)})` : targets.join(", ") || "—",
        ];
    });

    renderTable(header, rows);

    logger.info("");
    logger.info(`${String(projectNames.length)} project(s)`);
};

export default execute as CommandExecute<Toolbox>;
