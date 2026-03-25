import type { Command } from "@visulima/cerebro";
import { findPackageManagerSync } from "@visulima/package";

import { formatAiAnalysis, runAiAnalysis, validateAnalysisType } from "../ai-analysis";
import type { OutdatedEntry } from "../catalog";
import { extractPrefix, fetchPackageVersions, fetchVulnerabilities, getUpdateType, parseVersion, readCatalogs } from "../catalog";

const VERSION_PREFIX_REGEX = /^[\^~>=<]+/;

const analyze: Command = {
    argument: {
        description: "Package name to analyze (e.g., react)",
        name: "package",
        required: true,
        type: String,
    },
    description: "Analyze a single package update with AI",
    examples: [
        ["vis analyze react", "Analyze updating react to latest"],
        ["vis analyze react 19.0.0", "Analyze updating react to specific version"],
        ["vis analyze react --ai-type security", "Run security-focused analysis"],
        ["vis analyze react --format json", "Output as JSON"],
    ],
    // eslint-disable-next-line sonarjs/cognitive-complexity -- command handler with multiple flows
    execute: async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }) => {
        if (!wsRoot) {
            throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
        }

        const positionalArguments = argument as string[];
        const packageName = positionalArguments[0];

        if (!packageName) {
            throw new Error("Package name is required. Usage: vis analyze <package> [version]");
        }

        const targetVersionArgument = positionalArguments[1] as string | undefined;
        const { packageManager } = findPackageManagerSync(wsRoot);

        // Find current version from catalogs
        let currentRange: string | undefined;
        let catalogName = "default";
        const catalogs = readCatalogs(wsRoot, packageManager);

        for (const [name, deps] of catalogs) {
            const range = deps.get(packageName);

            if (range) {
                currentRange = range;
                catalogName = name;
                break;
            }
        }

        if (!currentRange) {
            throw new Error(`Package "${packageName}" not found in any catalog or package.json. Make sure it exists in your workspace dependencies.`);
        }

        // Resolve target version
        let targetVersion: string;

        if (targetVersionArgument) {
            targetVersion = targetVersionArgument;
        } else {
            logger.info(`Fetching latest version for ${packageName}...\n`);

            const info = await fetchPackageVersions(packageName);

            if (!info.latest) {
                throw new Error(`Could not determine latest version for "${packageName}".`);
            }

            targetVersion = info.latest;
        }

        // Build OutdatedEntry
        const current = parseVersion(currentRange);
        const target = parseVersion(targetVersion);

        if (!current || !target) {
            throw new Error(`Could not parse versions: current="${currentRange}", target="${targetVersion}".`);
        }

        const updateType = getUpdateType(current, target);

        if (updateType === "none") {
            logger.info(`${packageName} is already at ${targetVersion}. Nothing to analyze.`);

            return;
        }

        const prefix = extractPrefix(currentRange);
        const entry: OutdatedEntry = {
            catalogName,
            currentRange,
            newRange: `${prefix}${targetVersion}`,
            packageName,
            targetVersion,
            updateType,
        };

        // Fetch vulnerabilities if security analysis or explicitly requested
        const analysisType = validateAnalysisType((options["ai-type"] as string | undefined) ?? "impact");

        if (analysisType === "security" || options.security) {
            logger.info("Checking for known vulnerabilities...\n");

            const vulnMap = await fetchVulnerabilities([{ name: packageName, version: currentRange.replace(VERSION_PREFIX_REGEX, "") }]);
            const vulns = vulnMap.get(packageName);

            if (vulns && vulns.length > 0) {
                entry.vulnerabilities = vulns;
            }
        }

        // Run AI analysis
        const result = await runAiAnalysis([entry], logger, visConfig?.ai, analysisType);
        const format = (options.format as string) ?? "table";

        if (format === "json") {
            process.stdout.write(`${JSON.stringify(result, undefined, 2)}\n`);
        } else {
            logger.info(formatAiAnalysis(result));
        }
    },
    name: "analyze",
    options: [
        {
            description: "AI analysis type: impact, security, compatibility, or recommend (default: impact)",
            name: "ai-type",
            type: String,
        },
        {
            defaultValue: false,
            description: "Check for known security vulnerabilities",
            name: "security",
            type: Boolean,
        },
        {
            description: "Output format: table or json (default: table)",
            name: "format",
            type: String,
        },
    ],
};

export default analyze;
