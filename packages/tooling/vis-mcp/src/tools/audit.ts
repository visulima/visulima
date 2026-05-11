// eslint-disable-next-line import/no-namespace -- zod's `z` is a namespace export per zod/consistent-import
import * as z from "zod";

import { execVisJson } from "../exec";
import type { ToolContext, ToolDeps } from "../response";
import { errorResponse, okResponse } from "../response";

interface VulnerabilityShape {
    fixedVersions?: string[];
    id: string;
    severity: string;
    summary?: string;
}

interface ResultEntry {
    acceptedRisk?: unknown;
    name: string;
    socketAlerts?: unknown[];
    socketScore?: number | null;
    version: string;
    vulnerabilities: VulnerabilityShape[];
}

interface AuditJson {
    duplicates: { name: string; versionCount: number; versions: string[] }[];
    packages: number;
    results: ResultEntry[];
    summary: { accepted: number; duplicatePackages: number; issues: number; total: number };
}

const SEVERITY_VALUES = ["low", "medium", "high", "critical"] as const;

export const registerAudit = ({ server }: ToolDeps, context: ToolContext): void => {
    server.registerTool(
        "audit",
        {
            annotations: { readOnlyHint: true },
            description:
                "Audit installed packages for known vulnerabilities and supply-chain risk via `vis audit --format json`. "
                + "Defaults to the local offline OSV cache when one exists, otherwise falls back to the live OSV API. "
                + "Returns the parsed audit payload (results, duplicates, summary).",
            inputSchema: {
                ecosystem: z
                    .string()
                    .optional()
                    .describe("Comma-separated OSV ecosystems to scan. Defaults to 'npm' (the only matcher wired today)."),
                offline: z
                    .boolean()
                    .optional()
                    .describe("Force the local OSV cache. Errors if the cache is missing — run `vis advisories sync` first."),
                prodOnly: z
                    .boolean()
                    .optional()
                    .describe("Skip devDependencies — scan the production graph only."),
                severity: z
                    .enum(SEVERITY_VALUES)
                    .optional()
                    .describe("Minimum severity to report. Defaults to 'low'."),
                showAccepted: z
                    .boolean()
                    .optional()
                    .describe("Include findings already on the workspace's accepted-risk list."),
                usage: z
                    .boolean()
                    .optional()
                    .describe("Apply the reachability filter — only report vulnerabilities in statically-imported packages."),
            },
        },
        async (input: {
            ecosystem?: string;
            offline?: boolean;
            prodOnly?: boolean;
            severity?: typeof SEVERITY_VALUES[number];
            showAccepted?: boolean;
            usage?: boolean;
        }) => {
            try {
                const args = ["audit", "--format", "json"];

                if (input.severity) {
                    args.push("--severity", input.severity);
                }

                if (input.offline) {
                    args.push("--offline");
                }

                if (input.prodOnly) {
                    args.push("--prod-only");
                }

                if (input.usage) {
                    args.push("--usage");
                }

                if (input.ecosystem) {
                    args.push("--ecosystem", input.ecosystem);
                }

                if (input.showAccepted) {
                    args.push("--show-accepted");
                }

                const payload = await execVisJson<AuditJson>(context.visBin, args, { cwd: context.workspaceRoot });

                return okResponse(payload);
            } catch (error) {
                return errorResponse(error);
            }
        },
    );
};
