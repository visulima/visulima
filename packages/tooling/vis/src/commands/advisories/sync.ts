import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { dim } from "@visulima/colorize";

import { pail } from "../../io/logger";
import { startScanProgress } from "../../scan/scan-progress";
import type { SyncResult } from "../../security/advisories";
import { DEFAULT_ADVISORY_SOURCE, syncAdvisories } from "../../security/advisories";
import type { AdvisoriesSyncOptions } from "./index";

import type { VisConfig } from "../../config/workspace";

const readAdvisoriesConfig = (visConfig: VisConfig | undefined): NonNullable<NonNullable<NonNullable<VisConfig["security"]>["audit"]>["advisories"]> => visConfig?.security?.audit?.advisories ?? {};

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

    const tasks = ecosystems.map((eco) => ({ id: eco, label: `Sync ${eco} advisories` }));
    const progress = startScanProgress(tasks, { live: !isJson });

    const results: { ecosystem: string; result?: SyncResult; error?: string }[] = [];

    try {
        for (const ecosystem of ecosystems) {
            progress.start(ecosystem);
            const startedAt = Date.now();
            let downloadBytes = 0;
            let downloadTotal: number | undefined;
            let ingestCurrent = 0;
            let ingestTotal = 0;

            try {
                const result = await syncAdvisories({
                    workspaceRoot,
                    ecosystem,
                    source,
                    allowedHosts: advisoriesConfig.allowedHosts,
                    dbPath: options.db,
                    force: Boolean(options.force),
                    onProgress: (current, total, phase) => {
                        if (phase === "download") {
                            downloadBytes = current;
                            downloadTotal = total;
                        } else {
                            ingestCurrent = current;
                            ingestTotal = total;
                        }
                    },
                });

                results.push({ ecosystem, result });

                if (result.upToDate) {
                    progress.finish(ecosystem, "ok", `up to date · ${formatDuration(Date.now() - startedAt)}`);
                } else {
                    progress.finish(
                        ecosystem,
                        "ok",
                        `${result.advisoriesIngested.toLocaleString()} advisories · ${formatDuration(result.durationMs)}`,
                    );
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);

                results.push({ ecosystem, error: message });
                progress.finish(ecosystem, "error", message);
            }

            // Suppress unused-var lint until we surface progress numbers in JSON
            void downloadBytes;
            void downloadTotal;
            void ingestCurrent;
            void ingestTotal;
        }
    } finally {
        progress.stop();
    }

    if (isJson) {
        const payload = {
            source,
            ecosystems: results.map((r) => ({
                ecosystem: r.ecosystem,
                upToDate: r.result?.upToDate ?? false,
                advisoriesIngested: r.result?.advisoriesIngested ?? 0,
                durationMs: r.result?.durationMs ?? 0,
                dbPath: r.result?.dbPath ?? null,
                error: r.error ?? null,
            })),
        };

        process.stdout.write(`${JSON.stringify(payload, undefined, 2)}\n`);
    } else {
        const failed = results.filter((r) => r.error);
        const succeeded = results.filter((r) => r.result);

        if (succeeded.length > 0 && succeeded[0]?.result?.dbPath) {
            pail.info(dim(`DB: ${succeeded[0].result.dbPath}`));
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
