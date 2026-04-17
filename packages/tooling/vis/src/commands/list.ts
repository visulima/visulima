import type { Command } from "@visulima/cerebro";

import { filterProjectsByQuery } from "../selectors";
import type { VisTargetConfiguration } from "../target-options";
import type { VisProjectConfiguration } from "../workspace";
import { discoverWorkspace } from "../workspace";

const list: Command = {
    description: "List all workspace projects with metadata",
    examples: [
        ["vis list", "Show all projects"],
        ["vis list --json", "Machine-readable output"],
        ['vis list --query "tag=frontend"', "Filter by query"],
    ],
    execute: async ({ logger, options, visConfig, workspaceRoot: wsRoot }) => {
        if (!wsRoot) {
            throw new Error("Could not determine workspace root.");
        }

        const { projectOptions, workspace } = discoverWorkspace(wsRoot, visConfig);
        let projectNames = Object.keys(workspace.projects).sort();

        if (options.query) {
            projectNames = filterProjectsByQuery(projectNames, workspace, options.query as string);
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

        logger.info("");
        logger.info(`${String(projectNames.length)} project(s)`);
    },
    group: "Workspace",
    name: "list",
    options: [
        {
            defaultValue: false,
            description: "Emit JSON instead of a table",
            name: "json",
            type: Boolean,
        },
        {
            description: "Filter projects by query",
            name: "query",
            type: String,
        },
    ],
};

export default list;
