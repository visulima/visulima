import { createInterface } from "node:readline";

import type { Command } from "@visulima/cerebro";
import colorize from "@visulima/colorize";

const { dim, green, red, yellow } = colorize;
import { coerce } from "semver";

import { info, note, warn } from "../output";
import { resolveInstaller, runAdd } from "../pm-runner";
import type { AcceptedRisk, PackageReportData, SocketSecurityOptions } from "../socket-security";
import {
    buildSocketOptions,
    DEFAULT_LOW_SCORE_THRESHOLD,
    fetchSocketReports,
    findAcceptedRisk,
    formatAcceptedRiskSnippet,
    formatReportSummary,
    getFullPackageName,
    scoreColor,
    scoreLabel,
} from "../socket-security";
import { runTyposquatCheck } from "../typosquats";
import { parsePackageArgument, toStringArray } from "../utils";

/**
 * Resolves the latest version for each package from the npm registry.
 * Used to get a concrete version for Socket.dev lookup when only a name is given.
 */
const resolveLatestVersions = async (packageNames: string[], timeoutMs: number = 10_000): Promise<Map<string, string>> => {
    const results = new Map<string, string>();
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    try {
        const fetches = packageNames.map(async (name) => {
            try {
                const response = await fetch(`https://registry.npmjs.org/${name}/latest`, {
                    headers: { Accept: "application/json" },
                    signal: controller.signal,
                });

                if (response.ok) {
                    const data = (await response.json()) as { version?: string };

                    if (data.version) {
                        results.set(name, data.version);
                    }
                }
            } catch {
                // Skip unresolvable packages
            }
        });

        await Promise.all(fetches);
    } finally {
        clearTimeout(timeout);
    }

    return results;
};

/**
 * Displays Socket.dev security reports for packages being added.
 * Returns the list of packages with low scores that need confirmation
 * (excludes packages with accepted risks).
 */
const displaySecurityReports = (
    reports: Map<string, PackageReportData>,
    minimumScore: number,
    acceptedRisks: Record<string, AcceptedRisk> | undefined,
): PackageReportData[] => {
    const lowScorePackages: PackageReportData[] = [];

    for (const report of reports.values()) {
        const { overall } = report.score;
        const color = scoreColor(overall);
        const pct = `${String(Math.round(overall * 100))}%`;
        const alertCount = report.alerts.length;
        const fullName = getFullPackageName(report);
        const accepted = findAcceptedRisk(fullName, report.version, acceptedRisks);

        const colorFunction = color === "red" ? red : color === "yellow" ? yellow : green;

        if (accepted) {
            info(`  ${colorFunction(pct)} ${formatReportSummary(report)} ${dim(`[accepted: ${accepted.reason}]`)}`);
        } else {
            info(`  ${colorFunction(pct)} ${formatReportSummary(report)}`);
        }

        if (alertCount > 0) {
            const critHigh = report.alerts.filter((a) => a.severity === "critical" || a.severity === "high").length;

            if (critHigh > 0) {
                warn(`    ${String(critHigh)} critical/high alert${critHigh === 1 ? "" : "s"}`);
            }
        }

        if (overall < minimumScore && !accepted) {
            lowScorePackages.push(report);
        }
    }

    return lowScorePackages;
};

/**
 * Prompts the user to confirm adding packages with low security scores.
 * Returns true if the user confirms, false otherwise.
 */
const confirmLowScorePackages = async (lowScorePackages: PackageReportData[], minimumScore: number): Promise<boolean> => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });

    const ask = (question: string): Promise<string> =>
        new Promise((resolve) => {
            rl.question(question, (answer) => {
                resolve(answer.trim());
            });
        });

    const pct = String(Math.round(minimumScore * 100));

    warn("");
    warn(`${String(lowScorePackages.length)} package${lowScorePackages.length === 1 ? "" : "s"} scored below the minimum threshold (${pct}%):`);

    for (const report of lowScorePackages) {
        const name = getFullPackageName(report);
        const score = `${String(Math.round(report.score.overall * 100))}%`;

        warn(`  \u2022 ${name}@${report.version} — score: ${score} (${scoreLabel(report.score.overall)})`);
    }

    warn("");

    const answer = await ask("Continue adding these packages? [y/N] ");

    if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
        rl.close();

        return false;
    }

    // Offer to print accepted risk snippet
    const rememberAnswer = await ask("Remember this decision? (prints config snippet) [y/N] ");

    rl.close();

    if (rememberAnswer.toLowerCase() === "y" || rememberAnswer.toLowerCase() === "yes") {
        note("");
        note("Add the following to security.socket.acceptedRisks in vis.config.ts:");
        note("");

        for (const report of lowScorePackages) {
            const fullName = getFullPackageName(report);
            const snippet = formatAcceptedRiskSnippet(fullName, report.version, report.score.overall, "Reviewed and accepted");

            note(snippet);
        }

        note("");
    }

    return true;
};

/**
 * Runs the Socket.dev pre-add security check.
 * Returns true to proceed, false to abort.
 */
const runSocketPreCheck = async (
    packages: string[],
    socketOptions: SocketSecurityOptions,
    minimumScore: number,
    acceptedRisks: Record<string, AcceptedRisk> | undefined,
): Promise<boolean> => {
    const parsed = packages.map(parsePackageArgument);

    // Coerce version specs to concrete semver (handles "^1.2.3", "19", "latest" etc.)
    const coercedSpecs = new Map<string, string>();

    for (const p of parsed) {
        if (p.versionSpec) {
            const coerced = coerce(p.versionSpec);

            if (coerced) {
                coercedSpecs.set(p.name, coerced.version);
            }
        }
    }

    // Resolve packages that couldn't be coerced (dist-tags like "latest", "next")
    const needsResolution = parsed.filter((p) => !coercedSpecs.has(p.name)).map((p) => p.name);
    const resolvedVersions = needsResolution.length > 0 ? await resolveLatestVersions(needsResolution) : new Map<string, string>();

    // Build lookup list with concrete semver only
    const lookupPackages: { name: string; version: string }[] = [];

    for (const p of parsed) {
        const version = coercedSpecs.get(p.name) ?? resolvedVersions.get(p.name);

        if (version) {
            lookupPackages.push({ name: p.name, version });
        }
    }

    if (lookupPackages.length === 0) {
        return true;
    }

    info("");
    info("Socket.dev security check:");

    const reports = await fetchSocketReports(lookupPackages, socketOptions);

    if (reports.size === 0) {
        info("  Could not fetch security data. Proceeding.");

        return true;
    }

    const lowScorePackages = displaySecurityReports(reports, minimumScore, acceptedRisks);

    if (lowScorePackages.length === 0) {
        info("");

        return true;
    }

    // In non-interactive mode (CI, piped), fail instead of prompting
    if (!process.stdin.isTTY) {
        warn(
            `Aborting: ${String(lowScorePackages.length)} package${lowScorePackages.length === 1 ? "" : "s"} below minimum score. Use --no-socket-check to skip.`,
        );

        return false;
    }

    return confirmLowScorePackages(lowScorePackages, minimumScore);
};

// ── Command ─────────────────────────────────────────────────────────

const add: Command = {
    argument: {
        description: "Packages to add (e.g., react react-dom)",
        name: "packages",
        type: String,
    },
    description: "Add packages using the detected package manager",
    examples: [
        ["vis add react react-dom", "Add packages"],
        ["vis add -D typescript @types/react", "Add as dev dependencies"],
        ["vis add react --filter app", "Add to specific workspace package"],
        ["vis add -g typescript", "Add globally (uses npm)"],
        ["vis add lodash -w", "Add to workspace root"],
        ["vis add lodash --no-socket-check", "Add without Socket.dev check"],
        ["vis add lodash --no-typosquat-check", "Skip typosquat name check"],
    ],
    execute: async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }) => {
        let packages = argument;

        if (!packages || packages.length === 0) {
            throw new Error("No packages specified. Usage: vis add <packages...>");
        }

        // Typosquat check (unless disabled)
        if (!options.noTyposquatCheck) {
            const parsed = packages.map((p: string) => parsePackageArgument(p));
            const result = await runTyposquatCheck(
                parsed.map((p) => p.name),
                visConfig?.security?.typosquatAllowlist,
            );

            if (!result.ok) {
                process.exitCode = 1;

                return;
            }

            // Rebuild args with corrected names, preserving version specifiers
            packages = parsed.map((p, i) => {
                const corrected = result.packages[i];

                if (corrected !== p.name) {
                    return p.versionSpec ? `${corrected}@${p.versionSpec}` : (corrected ?? "");
                }

                return packages[i] ?? "";
            });
        }

        // Socket.dev pre-add check (unless disabled)
        if (!options.noSocketCheck) {
            const socketOptions = buildSocketOptions(visConfig?.security?.socket);

            if (socketOptions) {
                const minimumScore = socketOptions.minimumScore ?? DEFAULT_LOW_SCORE_THRESHOLD;

                const shouldContinue = await runSocketPreCheck(packages, socketOptions, minimumScore, visConfig?.security?.socket?.acceptedRisks);

                if (!shouldContinue) {
                    process.exitCode = 1;

                    return;
                }
            }
        }

        // Default to current directory; workspace root used only for PM detection
        const cwd = process.cwd();
        const pm = resolveInstaller(wsRoot ?? cwd, { configBackend: visConfig?.install?.backend });

        const code = runAdd(
            pm,
            {
                exact: (options.exact as boolean) || false,
                filter: toStringArray(options.filter),
                global: (options.global as boolean) || false,
                optional: (options.saveOptional as boolean) || false,
                packages,
                peer: (options.savePeer as boolean) || false,
                saveDev: (options.saveDev as boolean) || false,
                workspace: (options.workspace as boolean) || false,
                workspaceRoot: (options.workspaceRoot as boolean) || false,
            },
            cwd,
            logger,
        );

        if (code !== 0) {
            process.exitCode = code;
        }
    },
    group: "Dependencies",
    name: "add",
    options: [
        { alias: "D", defaultValue: false, description: "Add as dev dependency", name: "save-dev", type: Boolean },
        { alias: "E", defaultValue: false, description: "Save exact version", name: "exact", type: Boolean },
        { alias: "P", defaultValue: false, description: "Add as peer dependency", name: "save-peer", type: Boolean },
        { alias: "O", defaultValue: false, description: "Add as optional dependency", name: "save-optional", type: Boolean },
        { alias: "g", defaultValue: false, description: "Install globally (uses npm)", name: "global", type: Boolean },
        { alias: "w", defaultValue: false, description: "Add to workspace root", name: "workspace-root", type: Boolean },
        { defaultValue: false, description: "Use workspace protocol (pnpm)", name: "workspace", type: Boolean },
        { alias: "F", description: "Filter by workspace package name", multiple: true, name: "filter", type: String },
        { defaultValue: false, description: "Skip typosquat name check before adding", name: "no-typosquat-check", type: Boolean },
        { defaultValue: false, description: "Skip Socket.dev security check before adding", name: "no-socket-check", type: Boolean },
    ],
};

export default add;
