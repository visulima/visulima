import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { dim, green, yellow } from "@visulima/colorize";

import { pail } from "../../io/logger";
import { getOsvBloomStatus } from "../../security/osv-bloom";
import type { AdvisoriesBloomStatusOptions } from "./index";

const formatRelative = (iso: string | undefined): string => {
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

const formatBytes = (bytes: number): string => {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const execute = async ({ options, workspaceRoot }: Toolbox<Console, AdvisoriesBloomStatusOptions>): Promise<void> => {
    if (!workspaceRoot) {
        throw new Error("Could not determine workspace root. Run this command inside a workspace.");
    }

    const status = await getOsvBloomStatus(workspaceRoot, options.cacheDir);
    const isJson = (options.format as string) === "json";

    if (isJson) {
        process.stdout.write(`${JSON.stringify(status, undefined, 2)}\n`);

        return;
    }

    pail.info(`Cache: ${status.cacheDir}`);

    if (!status.present) {
        pail.warn(`No osv-bloom filter yet. Run ${yellow("vis advisories bloom sync")} to populate.`);

        return;
    }

    if (status.manifest) {
        const { manifest } = status;

        pail.info(`Built:  ${manifest.builtAtRfc3339} (${formatRelative(manifest.builtAtRfc3339)})`);
        pail.info(`Fetch:  ${status.fetchedAtIso ?? dim("—")} (${formatRelative(status.fetchedAtIso)})`);
        pail.info(`Filter: ${green(formatBytes(manifest.bloomByteLen))}   m=${manifest.bloomMBits.toLocaleString()} bits   k=${String(manifest.bloomKHashes)}`);
        pail.info(
            `Set:    ${manifest.entryCount.toLocaleString()} entries from ${manifest.advisoryCount.toLocaleString()} advisories (target FPR ${manifest.targetFpr})`,
        );
        pail.info(dim(`Digest: ${manifest.setDigestSha256}`));
    } else {
        pail.warn("filter.bin present but manifest.json missing — `vis advisories bloom sync` will rewrite the cache.");
    }
};

export const advisoriesBloomStatusExecute: CommandExecute<Toolbox> = execute as CommandExecute<Toolbox>;
