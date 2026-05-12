import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { dim } from "@visulima/colorize";

import type { VisConfig } from "../../config/workspace";
import { pail } from "../../io/logger";
import { startScanProgress } from "../../scan/scan-progress";
import type { SyncResult } from "../../security/advisories";
import { DEFAULT_ADVISORY_SOURCE, syncAdvisories } from "../../security/advisories";
import type { AdvisoriesSyncOptions } from "./index";

type AdvisoriesConfig = NonNullable<NonNullable<NonNullable<VisConfig["security"]>["audit"]>["advisories"]>;

const readAdvisoriesConfig = (visConfig: VisConfig | undefined): AdvisoriesConfig => visConfig?.security?.audit?.advisories ?? {};

const parseEcosystems = (input: string | undefined): string[] => {
    if (!input) {
        return ["npm"];
    }

    return input
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
};

const execute = async ({ logger: _logger, options, visConfig, workspaceRoot }: Toolbox<Console, AdvisoriesSyncOptions>): Promise<void> => {
    if (!workspaceRoot) {
        throw new Error("Could not determine workspace root. Run this command inside a workspace.");
    }

    const isJson = (options.format as string) === "json";
    const advisoriesConfig = readAdvisoriesConfig(visConfig);
    const source = options.source ?? advisoriesConfig.source ?? DEFAULT_ADVISORY_SOURCE;
    const ecosystems = parseEcosystems(options.ecosystem);

    const tasks = ecosystems.map((eco) => {
        return { id: eco, label: `Sync ${eco} advisories` };
    });
    const progress = startScanProgress(tasks, { live: !isJson });

    const results: { ecosystem: string; error?: string; result?: SyncResult }[] = [];

    try {
        for (const ecosystem of ecosystems) {
            progress.start(ecosystem);
            const startedAt = Date.now();

            try {
                const result = await syncAdvisories({
                    allowedHosts: advisoriesConfig.allowedHosts,
                    dbPath: options.db,
                    ecosystem,
                    force: Boolean(options.force),
                    source,
                    workspaceRoot,
                });

                results.push({ ecosystem, result });

                if (result.upToDate) {
                    progress.finish(ecosystem, "ok", `up to date · ${formatDuration(Date.now() - startedAt)}`);
                } else {
                    progress.finish(ecosystem, "ok", `${result.advisoriesIngested.toLocaleString()} advisories · ${formatDuration(result.durationMs)}`);
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);

                results.push({ ecosystem, error: message });
                progress.finish(ecosystem, "error", message);
            }
        }
    } finally {
        progress.stop();
    }

    if (isJson) {
        const payload = {
            ecosystems: results.map((r) => {
                return {
                    advisoriesIngested: r.result?.advisoriesIngested ?? 0,
                    dbPath: r.result?.dbPath ?? null,
                    durationMs: r.result?.durationMs ?? 0,
                    ecosystem: r.ecosystem,
                    error: r.error ?? null,
                    upToDate: r.result?.upToDate ?? false,
                };
            }),
            source,
        };

        process.stdout.write(`${JSON.stringify(payload, undefined, 2)}\n`);
    } else {
        const failed = results.filter((r) => r.error);
        const succeeded = results.filter((r) => r.result);

        const firstSuccess = succeeded[0];

        if (firstSuccess?.result?.dbPath) {
            pail.info(dim(`DB: ${firstSuccess.result.dbPath}`));
        }

        if (failed.length === 0) {
            pail.success(`Synced ${succeeded.length} ecosystem${succeeded.length === 1 ? "" : "s"}.`);
        } else {
            pail.error(`${failed.length} ecosystem${failed.length === 1 ? "" : "s"} failed to sync.`);
        }
    }

    if (results.some((r) => r.error)) {
        process.exitCode = 1;
    }
};

const formatDuration = (ms: number): string => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`);

export const advisoriesSyncExecute: CommandExecute<Toolbox> = execute as CommandExecute<Toolbox>;
