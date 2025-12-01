import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createTable } from "@visulima/tabular";

import DisposableEmailSyncManager from "./disposable-email-sync-manager.js";

const filename = fileURLToPath(import.meta.url);
const dirnamePath = dirname(filename);

/**
 * Extracts repository name from GitHub URL
 * @param {string} url - GitHub repository URL
 * @returns {string} Repository name in format "owner/repo"
 */
const extractRepoName = (url) => {
    const match = url.match(/github\.com\/([^/]+\/[^/]+)/);

    if (match) {
        return match[1];
    }

    return url;
};

/**
 * Formats file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size (e.g., "1.6 MB")
 */
const formatFileSize = (bytes) => {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Formats performance string
 * @param {number} downloadTime - Download time in milliseconds
 * @param {number} fileSize - File size in bytes
 * @returns {string} Formatted performance (e.g., "0.31s (1.6 MB)")
 */
const formatPerformance = (downloadTime, fileSize) => {
    const timeSeconds = (downloadTime / 1000).toFixed(2);
    const size = formatFileSize(fileSize);

    return `${timeSeconds}s (${size})`;
};

/**
 * Updates the contributing sources table in README.md
 * @param {Array} repositories - Repository configurations
 * @param {object} stats - Synchronization statistics
 * @param {string} packageRootPath - Path to package root
 */
const updateContributingSourcesTable = async (repositories, stats, packageRootPath) => {
    // Create mapping of URL to stats
    const statsByUrl = new Map();

    for (const repoStat of stats.repositoryStats.values()) {
        statsByUrl.set(repoStat.url, repoStat);
    }

    // Build table rows with repository info and stats
    const tableRows = repositories
        .map((repo) => {
            const repoStat = statsByUrl.get(repo.url);

            if (!repoStat || !repoStat.success) {
                return null;
            }

            const repoName = extractRepoName(repo.url);
            const domains = repoStat.domainsCount.toLocaleString();
            const success = "✅";
            const performance = formatPerformance(repoStat.downloadTime, repoStat.fileSize);

            return {
                repoName,
                domains,
                success,
                performance,
                domainsCount: repoStat.domainsCount,
            };
        })
        .filter((row) => row !== null)
        .sort((a, b) => b.domainsCount - a.domainsCount)
        .map((row) => `| ${row.repoName} | ${row.domains} | ${row.success} | ${row.performance} |`);

    // Build markdown table
    const markdownTable = [
        "| Repository | Domains | Success | Performance |",
        "|------------|---------|---------|-------------|",
        ...tableRows,
    ].join("\n");

    // Read README
    const readmePath = join(packageRootPath, "README.md");
    let readmeContent = await fs.readFile(readmePath, "utf8");

    // Replace content between placeholders
    const startPlaceholder = "<!-- START_PLACEHOLDER_CONTRIBUTING -->";
    const endPlaceholder = "<!-- END_PLACEHOLDER_CONTRIBUTING -->";

    const startIndex = readmeContent.indexOf(startPlaceholder);
    const endIndex = readmeContent.indexOf(endPlaceholder);

    if (startIndex !== -1 && endIndex !== -1) {
        const before = readmeContent.slice(0, startIndex + startPlaceholder.length);
        const after = readmeContent.slice(endIndex);

        readmeContent = `${before}\n\n${markdownTable}\n\n${after}`;

        await fs.writeFile(readmePath, readmeContent, "utf8");

        // eslint-disable-next-line no-console
        console.log(`\n📝 Contributing sources table updated in README.md`);
    } else {
        // eslint-disable-next-line no-console
        console.warn("\n⚠️  Could not find placeholder comments in README.md");
    }
};

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

        // Generate and update contributing sources table in README
        await updateContributingSourcesTable(repositories, result.stats, packageRootPath);
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error("❌ Error during synchronization:", error);

        throw error;
    }
};

await main();
