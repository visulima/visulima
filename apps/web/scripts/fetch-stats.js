/**
 * Pre-fetches npm download stats and GitHub stats at build time.
 * Writes results to src/data/stats.json so the app can read them without runtime API calls.
 *
 * Supports incremental updates: reads existing stats.json and only fetches
 * data from the last cached date to now, merging with previously cached data.
 *
 * Output format:
 * {
 *   weeklyDownloads: { "packem": 328, ... },
 *   totalDownloads:  { "packem": 73201, ... },
 *   monthlyChart:    { "packem": [{ month: "2024-01", downloads: 1234 }, ...], ... },
 *   stars: 37,
 *   contributors: 10,
 *   fetchedAt: "..."
 * }
 *
 * Usage: node scripts/fetch-stats.js
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, "../src/data/stats.json");

const PACKAGES = [
    "ansi",
    "api-platform",
    "boxen",
    "bytes",
    "cerebro",
    "colorize",
    "command-line-args",
    "connect",
    "content-safety",
    "crud",
    "deep-clone",
    "dev-toolbar",
    "disposable-email-domains",
    "email",
    "error",
    "error-handler",
    "find-cache-dir",
    "fmt",
    "fs",
    "health-check",
    "html",
    "humanizer",
    "inspector",
    "is-ansi-color-supported",
    "iso-locale",
    "jsdoc-open-api",
    "object",
    "ono",
    "package",
    "packem",
    "pagination",
    "pail",
    "path",
    "prisma-dmmf-transformer",
    "redact",
    "source-map",
    "storage",
    "storage-client",
    "string",
    "tabular",
    "tsconfig",
    "vite-overlay",
];

const GITHUB_REPOS = ["visulima/visulima", "visulima/packem"];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const loadCache = () => {
    if (!existsSync(OUTPUT_PATH)) {
        return null;
    }

    try {
        const raw = readFileSync(OUTPUT_PATH, "utf-8");
        const data = JSON.parse(raw);

        if (data.fetchedAt && data.monthlyChart) {
            return data;
        }
    } catch {
        console.warn("  Could not parse existing stats.json, starting fresh.");
    }

    return null;
};

/**
 * Returns the first day of the month of the last fetch (YYYY-MM-DD),
 * so we re-fetch that (potentially partial) month plus any new months.
 */
const getCacheCutoffDate = (cache) => {
    if (!cache?.fetchedAt) {
        return null;
    }

    const lastFetched = new Date(cache.fetchedAt);
    return `${lastFetched.toISOString().substring(0, 7)}-01`;
};

const toDateString = (date) => {
    return date.toISOString().split("T")[0];
};

const fetchWithRetry = async (url, maxRetries = 5) => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url);

            if (response.status === 429) {
                if (attempt < maxRetries) {
                    const waitMs = 5000 * (attempt + 1);
                    console.warn(`    Rate limited, waiting ${waitMs / 1000}s...`);
                    await delay(waitMs);
                    continue;
                }

                return null;
            }

            if (!response.ok) {
                return null;
            }

            return await response.json();
        } catch (error) {
            if (attempt < maxRetries) {
                await delay(3000);
                continue;
            }

            console.warn(`    Fetch error: ${error.message}`);
            return null;
        }
    }

    return null;
};

const fetchPackageDownloads = async (pkg, period) => {
    const data = await fetchWithRetry(`https://api.npmjs.org/downloads/point/${period}/@visulima/${pkg}`);

    return data?.downloads || 0;
};

/**
 * Fetch daily download data for a package over a date range,
 * then aggregate into monthly totals for the chart.
 *
 * If a cutoffDate is provided, only fetches from that date to now.
 * npm API limits range queries to 18 months max.
 */
const fetchPackageMonthlyChart = async (pkg, cutoffDate) => {
    const now = new Date();
    const dailyByMonth = {};

    const windows = cutoffDate ? buildWindows(new Date(cutoffDate), now) : buildFullHistoryWindows(now);

    for (const { start, end } of windows) {
        await delay(1500);
        const data = await fetchWithRetry(`https://api.npmjs.org/downloads/range/${start}:${end}/@visulima/${pkg}`);

        if (data?.downloads) {
            for (const day of data.downloads) {
                const month = day.day.substring(0, 7);

                if (!dailyByMonth[month]) {
                    dailyByMonth[month] = 0;
                }

                dailyByMonth[month] += day.downloads;
            }
        }
    }

    return Object.keys(dailyByMonth)
        .sort()
        .map((month) => ({ month, downloads: dailyByMonth[month] }));
};

/**
 * Build 18-month windows going back ~5 years from now (full history).
 */
const buildFullHistoryWindows = (now) => {
    const windows = [];
    let endDate = new Date(now);

    for (let i = 0; i < 4; i++) {
        const startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 17);

        windows.push({ start: toDateString(startDate), end: toDateString(endDate) });

        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() - 1);
    }

    windows.reverse();
    return windows;
};

/**
 * Build 18-month windows covering the range [startDate, endDate].
 */
const buildWindows = (startDate, endDate) => {
    const windows = [];
    let cursor = new Date(startDate);

    while (cursor < endDate) {
        const windowEnd = new Date(cursor);
        windowEnd.setMonth(windowEnd.getMonth() + 17);

        const actualEnd = windowEnd > endDate ? endDate : windowEnd;

        windows.push({
            start: toDateString(cursor),
            end: toDateString(actualEnd),
        });

        cursor = new Date(actualEnd);
        cursor.setDate(cursor.getDate() + 1);
    }

    return windows;
};

/**
 * Merge cached monthly chart data with newly fetched data.
 * New data overwrites cached months (since partial months get re-fetched).
 */
const mergeMonthlyChart = (cached, fresh) => {
    const byMonth = {};

    if (cached) {
        for (const entry of cached) {
            byMonth[entry.month] = entry.downloads;
        }
    }

    for (const entry of fresh) {
        byMonth[entry.month] = entry.downloads;
    }

    return Object.keys(byMonth)
        .sort()
        .map((month) => ({ month, downloads: byMonth[month] }));
};

const fetchRepoStars = async (repo) => {
    const data = await fetchWithRetry(`https://api.github.com/repos/${repo}`);
    return data?.stargazers_count || 0;
};

const fetchRepoContributors = async (repo) => {
    try {
        const response = await fetch(`https://api.github.com/repos/${repo}/contributors?per_page=1&anon=true`);

        if (response.ok) {
            const linkHeader = response.headers.get("Link");

            if (linkHeader) {
                const match = /page=(\d+)>; rel="last"/.exec(linkHeader);

                if (match) {
                    return parseInt(match[1], 10);
                }
            } else {
                const data = await response.json();

                if (Array.isArray(data)) {
                    return data.length;
                }
            }
        }
    } catch {
        // ignore
    }

    return 0;
};

const main = async () => {
    const cache = loadCache();
    const cutoffDate = getCacheCutoffDate(cache);

    if (cache) {
        console.log(`Found cached stats from ${cache.fetchedAt}`);
        console.log(`Fetching incremental data from ${cutoffDate}...\n`);
    } else {
        console.log("No cache found, fetching all data from scratch...\n");
    }

    console.log("Fetching npm download stats...\n");

    const weeklyDownloads = {};
    const totalDownloads = {};
    const monthlyChart = {};

    for (const pkg of PACKAGES) {
        // Weekly downloads: always fetch fresh
        weeklyDownloads[pkg] = await fetchPackageDownloads(pkg, "last-week");
        await delay(1000);

        // Total downloads: always fetch fresh (single cheap API call)
        totalDownloads[pkg] = await fetchPackageDownloads(pkg, "2015-01-01:2030-01-01");
        await delay(1000);

        console.log(`  ${pkg}: weekly=${weeklyDownloads[pkg]}, total=${totalDownloads[pkg]}`);

        // Fetch monthly chart data (incremental if cache exists)
        const cachedChart = cache?.monthlyChart?.[pkg];

        if (cachedChart && cutoffDate) {
            console.log(`    Fetching chart data from ${cutoffDate}...`);
            const freshChart = await fetchPackageMonthlyChart(pkg, cutoffDate);
            monthlyChart[pkg] = mergeMonthlyChart(cachedChart, freshChart);
            console.log(`    ${freshChart.length} new months fetched, ${monthlyChart[pkg].length} months total`);
        } else {
            console.log(`    Fetching full chart data...`);
            monthlyChart[pkg] = await fetchPackageMonthlyChart(pkg, null);
            console.log(`    ${monthlyChart[pkg].length} months of data`);
        }
    }

    console.log("\nFetching GitHub stats...");

    let stars = 0;
    let contributors = 0;

    for (const repo of GITHUB_REPOS) {
        const repoStars = await fetchRepoStars(repo);
        const repoContribs = await fetchRepoContributors(repo);

        stars += repoStars;
        contributors += repoContribs;
        console.log(`  ${repo}: stars=${repoStars}, contributors=${repoContribs}`);
    }

    const stats = {
        weeklyDownloads,
        totalDownloads,
        monthlyChart,
        stars,
        contributors,
        fetchedAt: new Date().toISOString(),
    };

    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
    writeFileSync(OUTPUT_PATH, JSON.stringify(stats, null, 4) + "\n");

    const weeklySum = Object.values(weeklyDownloads).reduce((a, b) => a + b, 0);
    const totalSum = Object.values(totalDownloads).reduce((a, b) => a + b, 0);

    console.log(`\nDone! Written to ${OUTPUT_PATH}`);
    console.log(`  Weekly: ${weeklySum.toLocaleString()}`);
    console.log(`  Total:  ${totalSum.toLocaleString()}`);
    console.log(`  Stars:  ${stars}`);
    console.log(`  Contributors: ${contributors}`);
};

main().catch((error) => {
    console.error("Failed to fetch stats:", error);
    process.exit(1);
});
