import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import type { VisProjectConfiguration } from "../../config/workspace";
import { discoverWorkspace } from "../../config/workspace";
import { filterProjectsByQuery } from "../../task/selectors";
import type { VisTargetConfiguration } from "../../task/target-options";
import type { ListOptions } from "./index";

const execute = async ({ logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, ListOptions>): Promise<void> => {
    if (!wsRoot) {
        throw new Error("Could not determine workspace root.");
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

    if (options.json) {
        const data = projectNames.map((name) => {
            const project = workspace.projects[name] as VisProjectConfiguration;
            const visTargets = projectOptions.get(name) ?? {};
            const targets = Object.entries(project.targets ?? {}).map(([targetName]) => {
                const visTarget = visTargets[targetName] as VisTargetConfiguration | undefined;

                return {
                    aliases: visTarget?.aliases ?? [],
                    command: visTarget?.command,
                    description: visTarget?.description,
                    name: targetName,
                    type: visTarget?.type,
                };
            });

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
            const maxData = rows.reduce((max, row) => Math.max(max, (row[i] ?? "").length), 0);

            return Math.max(h.length, maxData);
        });

        const pad = (str: string, w: number): string => str.padEnd(w);

        logger.info(header.map((h, i) => pad(h, widths[i]!)).join("  "));
        logger.info(widths.map((w) => "─".repeat(w)).join("──"));

        for (const row of rows) {
            logger.info(row.map((cell, i) => pad(cell, widths[i]!)).join("  "));
        }
    };

    if (options.targets) {
        const targetRows: string[][] = [];

        for (const name of projectNames) {
            const project = workspace.projects[name] as VisProjectConfiguration;
            const visTargets = projectOptions.get(name) ?? {};

            for (const targetName of Object.keys(project.targets ?? {}).sort()) {
                const visTarget = visTargets[targetName] as VisTargetConfiguration | undefined;
                const targetConfig = project.targets?.[targetName];
                const cache = targetConfig?.cache === false ? "no" : targetConfig?.cache === true ? "yes" : "default";

                targetRows.push([
                    name,
                    targetName,
                    visTarget?.type ?? "—",
                    cache,
                    visTarget?.description ?? "—",
                ]);
            }
        }

        if (targetRows.length === 0) {
            logger.info("No targets found.");

            return;
        }

        renderTable(["Project", "Target", "Type", "Cache", "Description"], targetRows);

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
