import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createTable } from "@visulima/tabular";

import DisposableEmailSyncManager from "./disposable-email-sync-manager.js";

const filename = fileURLToPath(import.meta.url);
const dirnamePath = dirname(filename);

/**
 * Main script execution
 */
const main = async () => {
    try {
        // Load repositories from config
        const repositoriesPath = join(dirnamePath, "config", "repositories.json");
        const repositoriesContent = await fs.readFile(repositoriesPath, "utf8");
        /** @type {Array<{name: string, url: string, type: string, blocklist_files?: string[], description?: string, priority?: number}>} */
        // @ts-expect-error - JSON.parse returns unknown, but we know the structure
        const repositories = JSON.parse(repositoriesContent);

        // eslint-disable-next-line no-console
        console.log(`📦 Loaded ${repositories.length} repositories from config`);

        // Initialize sync manager
        const syncManager = new DisposableEmailSyncManager({
            concurrency: 5,
            outputPath: join(dirnamePath, "..", "dist"),
            retries: 3,
            timeout: 30_000,
        });

        // eslint-disable-next-line no-console
        console.log("🚀 Starting domain synchronization...");

        // Run synchronization
        const result = await syncManager.sync(repositories);

        // eslint-disable-next-line no-console
        console.log("\n✅ Synchronization completed!\n");

        // Summary table
        const summaryTable = createTable({
            showHeader: true,
            wordWrap: true,
        });

        summaryTable.setHeaders(["Metric", "Value"]);
        summaryTable.addRows(
            ["Total Domains", result.stats.totalDomains.toLocaleString()],
            ["New Domains", result.stats.newDomains.toLocaleString()],
            ["Removed Domains", result.stats.removedDomains.toLocaleString()],
            ["Duplicates Found", result.stats.duplicates.toLocaleString()],
            ["Processing Time", `${(result.stats.processingTime / 1000).toFixed(2)}s`],
            ["Output Directory", syncManager.syncOptions.outputPath],
        );

        // eslint-disable-next-line no-console
        console.log("📊 Summary");
        // eslint-disable-next-line no-console
        console.log(summaryTable.toString());

        // Repository results table
        const repoStats = [...result.stats.repositoryStats.values()];

        if (repoStats.length > 0) {
            const repoTable = createTable({
                showHeader: true,
                wordWrap: true,
            });

            repoTable.setHeaders(["Status", "Domains", "Time", "Size", "URL"]);

            repoStats.forEach((repo) => {
                /** @type {{success: boolean, domainsCount: number, downloadTime: number, fileSize: number, url: string, error?: string}} */
                // @ts-expect-error - repoStats comes from Map.values() which TypeScript sees as unknown
                const repoData = repo;
                const status = repoData.success ? "✅ Success" : "❌ Failed";
                const domains = repoData.domainsCount.toLocaleString();
                const time = `${repoData.downloadTime}ms`;
                const size = `${(repoData.fileSize / 1024).toFixed(2)} KB`;

                repoTable.addRow([status, domains, time, size, repoData.url]);
            });

            // eslint-disable-next-line no-console
            console.log("\n📦 Repository Results");
            // eslint-disable-next-line no-console
            console.log(repoTable.toString());
        }

        // Create last-updated timestamp file for semantic-release
        const packageRootPath = join(dirnamePath, "..");
        const lastUpdatedPath = join(packageRootPath, ".last-updated.txt");
        const timestamp = new Date().toISOString();

        await fs.writeFile(lastUpdatedPath, timestamp, "utf8");

        // eslint-disable-next-line no-console
        console.log(`\n📝 Last updated timestamp written to: ${lastUpdatedPath}`);
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error("❌ Error during synchronization:", error);

        throw error;
    }
};

await main();
