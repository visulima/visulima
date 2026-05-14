import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { dim } from "@visulima/colorize";

import type { VisConfig } from "../../config/workspace";
import { pail } from "../../io/logger";
import { startScanProgress } from "../../scan/scan-progress";
import type { OsvBloomSyncResult } from "../../security/osv-bloom";
import { DEFAULT_OSV_BLOOM_SOURCE, syncOsvBloom } from "../../security/osv-bloom";
import type { AdvisoriesBloomSyncOptions } from "./index";

type BloomConfig = NonNullable<NonNullable<NonNullable<NonNullable<VisConfig["security"]>["audit"]>["advisories"]>["bloom"]>;

const readBloomConfig = (visConfig: VisConfig | undefined): BloomConfig => visConfig?.security?.audit?.advisories?.bloom ?? {};

const formatDuration = (ms: number): string => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`);

const formatBytes = (bytes: number): string => {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const execute = async ({ options, visConfig, workspaceRoot }: Toolbox<Console, AdvisoriesBloomSyncOptions>): Promise<void> => {
    if (!workspaceRoot) {
        throw new Error("Could not determine workspace root. Run this command inside a workspace.");
    }

    const isJson = (options.format as string) === "json";
    const bloomConfig = readBloomConfig(visConfig);
    const source = options.source ?? bloomConfig.source ?? DEFAULT_OSV_BLOOM_SOURCE;

    const progress = startScanProgress([{ id: "bloom", label: "Sync osv-bloom prefilter" }], { live: !isJson });

    let result: OsvBloomSyncResult | undefined;
    let error: string | undefined;

    try {
        progress.start("bloom");

        const started = Date.now();

        result = await syncOsvBloom({
            allowedHosts: bloomConfig.allowedHosts,
            cacheDir: options.cacheDir,
            force: Boolean(options.force),
            source,
            workspaceRoot,
        });

        if (result.upToDate) {
            progress.finish("bloom", "ok", `up to date · ${formatDuration(Date.now() - started)}`);
        } else {
            progress.finish(
                "bloom",
                "ok",
                `${result.manifest.entryCount.toLocaleString()} entries · ${formatBytes(result.bytesOnDisk)} · ${formatDuration(result.durationMs)}`,
            );
        }
    } catch (error_) {
        error = error_ instanceof Error ? error_.message : String(error_);
        progress.finish("bloom", "error", error);
    } finally {
        progress.stop();
    }

    if (isJson) {
        process.stdout.write(
            `${JSON.stringify(
                {
                    bytesOnDisk: result?.bytesOnDisk ?? 0,
                    cacheDir: result?.cacheDir ?? null,
                    durationMs: result?.durationMs ?? 0,
                    error: error ?? null,
                    manifest: result?.manifest ?? null,
                    source,
                    upToDate: result?.upToDate ?? false,
                },
                undefined,
                2,
            )}\n`,
        );
    } else if (result) {
        pail.info(dim(`Cache: ${result.cacheDir}`));
        pail.info(dim(`Built: ${result.manifest.builtAtRfc3339}`));

        if (!error) {
            pail.success(result.upToDate ? "osv-bloom prefilter up to date." : "osv-bloom prefilter synced.");
        }
    }

    if (error) {
        process.exitCode = 1;
    }
};

export const advisoriesBloomSyncExecute: CommandExecute<Toolbox> = execute as CommandExecute<Toolbox>;
