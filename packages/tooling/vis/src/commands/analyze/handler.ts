import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { findPackageManagerSync } from "@visulima/package";

import { formatAiAnalysis, runAiAnalysis, validateAnalysisType } from "../../ai/ai-analysis";
import { buildSocketOptions, fetchSocketReports } from "../../security/socket-security";
import type { OutdatedEntry } from "../../util/catalog";
import { extractPrefix, fetchPackageVersions, fetchVulnerabilities, getUpdateType, parseVersion, readCatalogs } from "../../util/catalog";
import type { AnalyzeOptions } from "./index";

const VERSION_PREFIX_REGEX = /^[\^~>=<]+/;

const execute = async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, AnalyzeOptions>): Promise<void> => {
    if (!wsRoot) {
        throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
    }

    const positionalArguments = argument;
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
    const analysisType = validateAnalysisType(options.aiType ?? "impact");

    if (analysisType === "security" || options.security) {
        logger.info("Checking for known vulnerabilities...\n");

        const version = currentRange.replace(VERSION_PREFIX_REGEX, "");
        const vulnMap = await fetchVulnerabilities([{ name: packageName, version }]);
        const vulns = vulnMap.get(packageName);

        if (vulns && vulns.length > 0) {
            entry.vulnerabilities = vulns;
        }

        // Also fetch Socket.dev report if enabled
        const socketOptions = buildSocketOptions(visConfig?.security?.socket);

        if (socketOptions) {
            const reports = await fetchSocketReports([{ name: packageName, version }], socketOptions);
            const report = reports.get(`${packageName}@${version}`);

            if (report) {
                entry.socketReport = {
                    alerts: report.alerts,
                    license: report.license,
                    score: report.score,
                };
            }
        }
    }

    // Run AI analysis
    const result = await runAiAnalysis([entry], logger, visConfig?.ai, analysisType);
    const format = options.format ?? "table";

    if (format === "json") {
        process.stdout.write(`${JSON.stringify(result, undefined, 2)}\n`);
    } else {
        logger.info(formatAiAnalysis(result));
    }
};

export default execute as CommandExecute<Toolbox>;
