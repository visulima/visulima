import { createInterface } from "node:readline";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { dim, green, red, yellow } from "@visulima/colorize";
import { readJsonSync, writeJsonSync } from "@visulima/fs";
import { findPackageManagerSync } from "@visulima/package";
import { join } from "@visulima/path";

import { discoverWorkspace } from "../../config/workspace";
import { pail } from "../../io/logger";
import { resolveInstaller, runAdd, runInstall } from "../../pm/pm-runner";
import { presentMarshallFindings } from "../../security/marshalls/decision-prompt";
import { runMarshallPipeline } from "../../security/marshalls/pipeline";
import { isMarshallDisabled } from "../../security/marshalls/registry";
import { resolveExplicitPackages, resolveLatestVersions } from "../../security/marshalls/resolve-explicit";
import type { AcceptedRisk, PackageReportData, SocketSecurityOptions } from "../../security/socket-security";
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
} from "../../security/socket-security";
import { runTyposquatCheck } from "../../security/typosquats";
import { readCatalogs } from "../../util/catalog";
import { conformToCatalog } from "../../util/conform-to-catalog";
import { resolveIndentForExistingFile } from "../../util/editorconfig";
import { parsePackageArgument, toStringArray } from "../../util/utils";
import type { AddOptions } from "./index";

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
            pail.info(`  ${colorFunction(pct)} ${formatReportSummary(report)} ${dim(`[accepted: ${accepted.reason}]`)}`);
        } else {
            pail.info(`  ${colorFunction(pct)} ${formatReportSummary(report)}`);
        }

        if (alertCount > 0) {
            const critHigh = report.alerts.filter((a) => a.severity === "critical" || a.severity === "high").length;

            if (critHigh > 0) {
                pail.warn(`    ${String(critHigh)} critical/high alert${critHigh === 1 ? "" : "s"}`);
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

    pail.warn("");
    pail.warn(`${String(lowScorePackages.length)} package${lowScorePackages.length === 1 ? "" : "s"} scored below the minimum threshold (${pct}%):`);

    for (const report of lowScorePackages) {
        const name = getFullPackageName(report);
        const score = `${String(Math.round(report.score.overall * 100))}%`;

        pail.warn(`  • ${name}@${report.version} — score: ${score} (${scoreLabel(report.score.overall)})`);
    }

    pail.warn("");

    const answer = await ask("Continue adding these packages? [y/N] ");

    if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
        rl.close();

        return false;
    }

    // Offer to print accepted risk snippet
    const rememberAnswer = await ask("Remember this decision? (prints config snippet) [y/N] ");

    rl.close();

    if (rememberAnswer.toLowerCase() === "y" || rememberAnswer.toLowerCase() === "yes") {
        pail.notice("");
        pail.notice("Add the following to security.acceptedRisks in vis.config.ts:");
        pail.notice("");

        for (const report of lowScorePackages) {
            const fullName = getFullPackageName(report);
            const snippet = formatAcceptedRiskSnippet(fullName, report.version, report.score.overall, "Reviewed and accepted");

            pail.notice(snippet);
        }

        pail.notice("");
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
    const lookupPackages = await resolveExplicitPackages(packages);

    if (lookupPackages.length === 0) {
        return true;
    }

    pail.info("");
    pail.info("Socket.dev security check:");

    const reports = await fetchSocketReports(lookupPackages, socketOptions);

    if (reports.size === 0) {
        pail.info("  Could not fetch security data. Proceeding.");

        return true;
    }

    const lowScorePackages = displaySecurityReports(reports, minimumScore, acceptedRisks);

    if (lowScorePackages.length === 0) {
        pail.info("");

        return true;
    }

    // In non-interactive mode (CI, piped), fail instead of prompting
    if (!process.stdin.isTTY) {
        pail.warn(
            `Aborting: ${String(lowScorePackages.length)} package${lowScorePackages.length === 1 ? "" : "s"} below minimum score. Use --no-socket-check to skip.`,
        );

        return false;
    }

    return confirmLowScorePackages(lowScorePackages, minimumScore);
};

/**
 * Sections in package.json we may write a dep into. `--save-peer`,
 * `--save-optional`, `--save-dev` map onto these; default is `dependencies`.
 */
type DepSection = "dependencies" | "devDependencies" | "optionalDependencies" | "peerDependencies";

const SIBLING_SECTIONS: ReadonlyArray<DepSection> = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

const pickDepSection = (options: AddOptions): DepSection => {
    if (options.savePeer) {
        return "peerDependencies";
    }

    if (options.saveOptional) {
        return "optionalDependencies";
    }

    if (options.saveDev) {
        return "devDependencies";
    }

    return "dependencies";
};

const applyExactPrefix = (spec: string, exact: boolean): string => {
    // Catalog refs don't carry semver prefixes — pnpm/bun resolve them
    // through the catalog entry, which has its own range.
    if (spec.startsWith("catalog:")) {
        return spec;
    }

    if (!exact) {
        return spec;
    }

    // Strip leading caret/tilde to get an exact pin. Range operators
    // like ">=" / "<" are left alone — exact-mode plus a range op is
    // operator error, not something to silently rewrite.
    return spec.replace(/^[\^~]/, "");
};

interface PlannedSpec {
    name: string;
    source: string;
    spec: string;
}

/**
 * Resolve a final spec for each input package, preserving input order
 * (so log lines and the package.json diff line up with what the user
 * typed). Missing-constraint deps fall back to registry-latest so
 * `--to` stays a "fix it for me" verb instead of a strict mode that
 * fails on greenfield deps.
 *
 * Exported for unit tests; the wider `applyConformedAdd` is hard to
 * exercise in isolation because of its install side-effect.
 */
const planConformedSpecs = async (packages: string[], catalogs: Map<string, Map<string, string>>): Promise<PlannedSpec[]> => {
    type Slot = { explicit: string } | { kind: "missing"; name: string } | { entry: PlannedSpec; kind: "resolved" };

    const slots: (Slot & { name: string })[] = [];

    for (const argument of packages) {
        const { name, versionSpec } = parsePackageArgument(argument);

        if (!name) {
            continue;
        }

        if (versionSpec !== undefined) {
            slots.push({ explicit: versionSpec, name });

            continue;
        }

        const conformed = conformToCatalog(name, catalogs);

        if (conformed) {
            if (conformed.conflict) {
                pail.warn(`${name}: ambiguous constraint — picking ${conformed.spec} (${conformed.source}). Pass ${name}@<version> to override.`);
            }

            slots.push({ entry: { name, source: conformed.source, spec: conformed.spec }, kind: "resolved", name });

            continue;
        }

        slots.push({ kind: "missing", name });
    }

    const missingNames = slots.filter((s): s is Slot & { kind: "missing"; name: string } => "kind" in s && s.kind === "missing").map((s) => s.name);
    const latest = missingNames.length > 0 ? await resolveLatestVersions(missingNames) : new Map<string, string>();

    return slots.map((slot): PlannedSpec => {
        if ("explicit" in slot) {
            return { name: slot.name, source: "explicit", spec: slot.explicit };
        }

        if (slot.kind === "resolved") {
            return slot.entry;
        }

        const version = latest.get(slot.name);

        if (version === undefined) {
            throw new Error(
                `--to: cannot resolve a version for "${slot.name}" (not in any catalog or sibling, and registry lookup failed). Pass ${slot.name}@<version> explicitly.`,
            );
        }

        const spec = `^${version}`;

        pail.info(`${slot.name}: no existing constraint — using registry latest (${spec}). Add to a catalog to share this version across workspace packages.`);

        return { name: slot.name, source: "registry latest", spec };
    });
};

/**
 * Apply the planned specs to a parsed package.json object: rewrite the
 * destination section, and remove the dep from any *other* dep section
 * so the same name doesn't end up in both `dependencies` and
 * `devDependencies`. Mutates `pkgJson` in place.
 */
const applyPlannedSpecsToPackageJson = (pkgJson: Record<string, unknown>, planned: ReadonlyArray<PlannedSpec>, section: DepSection, exact: boolean): void => {
    for (const { name, spec } of planned) {
        const finalSpec = applyExactPrefix(spec, exact);

        for (const otherSection of SIBLING_SECTIONS) {
            if (otherSection === section) {
                continue;
            }

            const block = pkgJson[otherSection] as Record<string, string> | undefined;

            if (block?.[name] !== undefined) {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete block[name];

                if (Object.keys(block).length === 0) {
                    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                    delete pkgJson[otherSection];
                }
            }
        }

        let block = pkgJson[section] as Record<string, string> | undefined;

        if (block === undefined) {
            block = {};
            pkgJson[section] = block;
        }

        block[name] = finalSpec;
    }
};

interface ApplyConformedAddArgs {
    ignoreScripts: boolean;
    logger: Console;
    options: AddOptions;
    packages: string[];
    pm: ReturnType<typeof resolveInstaller>;
    target: string;
    visConfig: Toolbox<Console, AddOptions>["visConfig"];
    workspaceRoot: string;
}

const applyConformedAdd = async ({
    ignoreScripts,
    logger,
    options,
    packages,
    pm,
    target,
    visConfig,
    workspaceRoot,
}: ApplyConformedAddArgs): Promise<number> => {
    const { workspace } = discoverWorkspace(workspaceRoot, visConfig ?? {});
    const project = workspace.projects[target];

    if (!project) {
        const available = Object.keys(workspace.projects).sort();

        throw new Error(
            `--to: workspace package "${target}" not found. Available: ${available.length > 0 ? available.slice(0, 10).join(", ") : "(none)"}${available.length > 10 ? `, ... (${String(available.length - 10)} more)` : ""}.`,
        );
    }

    const targetPkgPath = join(workspaceRoot, project.root, "package.json");
    const { packageManager } = findPackageManagerSync(workspaceRoot);
    const catalogs = readCatalogs(workspaceRoot, packageManager);

    const section = pickDepSection(options);
    const exact = options.exact ?? false;
    const planned = await planConformedSpecs(packages, catalogs);

    if (planned.length === 0) {
        return 0;
    }

    // Write the resolved deps into the target package.json. Indent is
    // resolved via .editorconfig (then sniffed from the file) so the only
    // diff in the file is the deps we touched.
    const pkgJson = readJsonSync(targetPkgPath) as Record<string, unknown>;

    applyPlannedSpecsToPackageJson(pkgJson, planned, section, exact);

    writeJsonSync(targetPkgPath, pkgJson, {
        indent: resolveIndentForExistingFile(targetPkgPath, { useEditorconfig: visConfig?.editorconfig ?? true }),
        overwrite: true,
    });

    // Log each resolved entry once the write has succeeded so a
    // partial-failure (e.g. read-only fs) doesn't print success lines.
    for (const entry of planned) {
        const finalSpec = applyExactPrefix(entry.spec, exact);

        pail.info(`${green("+")} ${entry.name}@${finalSpec} → ${target}/${section} (${dim(entry.source)})`);
    }

    // Materialize the package.json edit. We can't ride `runAdd` here
    // because no PM accepts `pkg@catalog:` on its add CLI before
    // pnpm 9.5; running install workspace-wide is the only universal
    // path. The frozen-lockfile / typosquat checks were already done
    // up-stack — `runInstall` here is just the side-effect to update
    // node_modules + lockfile.
    return runInstall(
        pm,
        {
            dev: false,
            filter: [],
            force: false,
            frozenLockfile: false,
            ignoreScripts,
            lockfileOnly: false,
            noOptional: false,
            offline: false,
            prod: false,
            recursive: false,
            silent: false,
            workspaceRoot: false,
        },
        workspaceRoot,
        logger,
    );
};

const execute = async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, AddOptions>): Promise<void> => {
    let packages = argument;

    if (!packages || packages.length === 0) {
        throw new Error("No packages specified. Usage: vis add <packages...>");
    }

    // Typosquat check (unless disabled)
    if ((options as Record<string, unknown>).typosquatCheck !== false) {
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

    // Pre-install marshall pipeline (packument-derived author, provenance,
    // metadata, downloads, expired-domains, new-bin, signatures, archived-repo
    // checks). Runs against the post-typosquat-correction args, before the
    // Socket.dev lookup that follows — Socket is a separate paid service with
    // its own UX, while the marshall pipeline is offline-friendly and free.
    if ((options as Record<string, unknown>).marshallCheck !== false) {
        const resolved = await resolveExplicitPackages(packages);

        if (resolved.length > 0) {
            const findings = await runMarshallPipeline(resolved, {
                config: visConfig?.security?.marshalls,
                workspaceRoot: wsRoot,
            });
            const proceed = await presentMarshallFindings(findings);

            if (!proceed) {
                process.exitCode = 1;

                return;
            }
        }
    }

    // Socket.dev pre-add check (unless disabled via --no-socket-check or MARSHALL_DISABLE_SOCKET)
    if ((options as Record<string, unknown>).socketCheck !== false && !isMarshallDisabled("socket")) {
        const socketOptions = buildSocketOptions(visConfig?.security?.socket, visConfig?.security?.policies?.score?.minimum);

        if (socketOptions) {
            // `buildSocketOptions` resolves the effective minimum score (config or default),
            // so we can trust `socketOptions.minimumScore` is always set here.
            const shouldContinue = await runSocketPreCheck(packages, socketOptions, socketOptions.minimumScore ?? DEFAULT_LOW_SCORE_THRESHOLD, visConfig?.security?.acceptedRisks);

            if (!shouldContinue) {
                process.exitCode = 1;

                return;
            }
        }
    }

    // Default to current directory; workspace root used only for PM detection
    const cwd = process.cwd();
    const pm = resolveInstaller(wsRoot ?? cwd, { configBackend: visConfig?.install?.backend, configCorepack: visConfig?.install?.corepack });

    // Secure-by-default: lifecycle scripts are off unless the user opts in
    // with --run-scripts. Mirrors pnpm v10's universal block-then-allowlist
    // model — packages listed in security.policies.installScripts.allow get their scripts
    // run after install via the security-enforcement plugin's
    // `runApprovedScripts` hook (afterCommand). This applies to every PM:
    // pnpm/bun/aube already block by default, npm/yarn need the explicit
    // flag, and the universal default keeps the surface consistent so a
    // workspace doesn't change behavior when its detected PM changes.
    const ignoreScripts = !options.runScripts;

    // Direct-edit the target package.json with a conformed spec
    // (catalog ref or sibling-derived range), then run a workspace
    // install to materialize it. We bypass `runAdd` here because no
    // PM (pre-pnpm 9.5) accepts `<pkg>@catalog:` on its add CLI; the
    // direct-edit path also gives us deterministic behaviour across
    // npm/yarn/bun where catalog references are pnpm-only or bun-only.
    if (options.to) {
        if (options.global || options.workspaceRoot) {
            throw new Error("--to is incompatible with --global / --workspace-root.");
        }

        if (options.filter && toStringArray(options.filter).length > 0) {
            throw new Error("--to and --filter are mutually exclusive — --to already targets one package.");
        }

        if (!wsRoot) {
            throw new Error("--to requires a monorepo workspace. Run from inside a pnpm/bun/yarn/npm workspace.");
        }

        const code = await applyConformedAdd({
            ignoreScripts,
            logger,
            options,
            packages,
            pm,
            target: options.to,
            visConfig,
            workspaceRoot: wsRoot,
        });

        if (code !== 0) {
            process.exitCode = code;
        }

        return;
    }

    const code = runAdd(
        pm,
        {
            exact: options.exact || false,
            filter: toStringArray(options.filter),
            global: options.global || false,
            optional: options.saveOptional || false,
            packages,
            peer: options.savePeer || false,
            saveDev: options.saveDev || false,
            workspace: options.workspace || false,
            workspaceRoot: options.workspaceRoot || false,
        },
        cwd,
        logger,
        { autoInstallPeers: options.autoInstallPeers || false, ignoreScripts },
    );

    if (code !== 0) {
        process.exitCode = code;
    }
};

export default execute as CommandExecute<Toolbox>;
