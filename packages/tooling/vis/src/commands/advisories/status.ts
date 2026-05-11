import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { dim, green, yellow } from "@visulima/colorize";

import { pail } from "../../io/logger";
import { getAdvisoryStatus, resolveAdvisoryDbPath } from "../../security/advisories";
import type { AdvisoriesStatusOptions } from "./index";

const formatBytes = (bytes: number): string => {
    if (bytes === 0) {
        return "0 B";
    }

    const units = ["B", "KB", "MB", "GB"];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** exponent;

    return `${value.toFixed(value < 10 && exponent > 0 ? 1 : 0)} ${units[exponent]}`;
};

const formatRelative = (iso: string): string => {
    if (!iso) {
        return "never";
    }

    const then = Date.parse(iso);

    if (Number.isNaN(then)) {
        return iso;
    }

    const deltaMs = Date.now() - then;

    if (deltaMs < 0) {
        return iso;
    }

    const minutes = Math.floor(deltaMs / 60_000);

    if (minutes < 1) {
        return "just now";
    }
    if (minutes < 60) {
        return `${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
        return `${hours}h ago`;
    }

    return `${Math.floor(hours / 24)}d ago`;
};

const execute = async ({ logger: _logger, options, workspaceRoot }: Toolbox<Console, AdvisoriesStatusOptions>): Promise<void> => {
    if (!workspaceRoot) {
        throw new Error("Could not determine workspace root. Run this command inside a workspace.");
    }

    const dbPath = options.db ?? resolveAdvisoryDbPath(workspaceRoot);
    const status = await getAdvisoryStatus(workspaceRoot, dbPath);
    const isJson = (options.format as string) === "json";

    if (isJson) {
        process.stdout.write(
            `${JSON.stringify(
                {
                    dbPath,
                    exists: status.exists,
                    schemaVersion: status.schemaVersion,
                    sizeBytes: status.sizeBytes,
                    ecosystems: status.ecosystems.map((e) => ({
                        name: e.name,
                        advisoryCount: e.advisoryCount,
                        lastSyncIso: e.lastSyncIso,
                        manifestEtag: e.manifestEtag ?? null,
                    })),
                },
                undefined,
                2,
            )}\n`,
        );

        return;
    }

    pail.info(`DB: ${dbPath}`);

    if (!status.exists) {
        pail.warn(`No advisory DB yet. Run ${yellow("vis advisories sync")} to populate.`);

        return;
    }

    pail.info(`Schema: v${status.schemaVersion}   Size: ${formatBytes(status.sizeBytes)}`);

    if (status.ecosystems.length === 0) {
        pail.warn("DB exists but contains no ecosystems. Run `vis advisories sync`.");

        return;
    }

    pail.info("");
    pail.info("Ecosystem    Advisories   Last sync           ETag");
    pail.info(dim("──────────   ──────────   ─────────────────   ──────"));

    for (const eco of status.ecosystems) {
        const name = eco.name.padEnd(10);
        const count = eco.advisoryCount.toLocaleString().padStart(10);
        const last = `${eco.lastSyncIso || "never"} (${formatRelative(eco.lastSyncIso)})`.padEnd(19);
        const etag = eco.manifestEtag ?? dim("—");

        pail.info(`${green(name)}   ${count}   ${last}   ${etag}`);
    }
};

export const advisoriesStatusExecute: CommandExecute<Toolbox> = execute as CommandExecute<Toolbox>;
