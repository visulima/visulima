/**
 * `vis ignore &lt;project>` — CI build gating for deployment platforms.
 *
 * Exits with inverted codes so it can be wired directly into Vercel's
 * "Ignored Build Step" field or Netlify's `ignore` command:
 *
 *   exit 0 → platform cancels the build (project is NOT affected)
 *   exit 1 → platform continues the build (project IS affected)
 *
 * Inspired by `nx-ignore` from nrwl/nx-labs, but reuses vis's own
 * `getAffectedProjects` so it doesn't need to bootstrap a parallel
 * Nx installation on the deploy runner. Pure helpers live in
 * `./ignore-helpers` for test isolation.
 */

import type { Command } from "@visulima/cerebro";
import type { AffectedOptions, AffectedScope } from "@visulima/task-runner";
import { getAffectedProjects } from "@visulima/task-runner";

import { buildProjectGraph, discoverWorkspace } from "../workspace";
import type { IgnoreDecision } from "./ignore-helpers";
import {
    commitHasForceDeployMessage,
    commitHasSkipMessage,
    decideBuild,
    decideSkip,
    exitCodeFor,
    formatDecisionLine,
    isRefReachable,
    readLastCommitMessage,
    resolveCiBaseSha,
    validateGitRef,
} from "./ignore-helpers";

const VALID_SCOPES = new Set<AffectedScope>(["deep", "direct", "none"]);

const ignore: Command = {
    argument: {
        description: "Project name to check (required)",
        name: "project",
        type: String,
    },
    description: 'Exit with inverted codes for CI "Ignored Build Step" gating (Vercel/Netlify)',
    examples: [
        ["vis ignore my-app", "Check if my-app is affected and decide whether to build"],
        ["vis ignore my-app --base $VERCEL_GIT_PREVIOUS_SHA", "Explicit base ref"],
        ["vis ignore my-app --json", "Emit the decision as JSON instead of text"],
        ["vis ignore my-app --verbose", "Print debug info about the decision path"],
        ["vis ignore my-app --exit-zero-on-build", "Normal exit semantics (0=build, 0=skip)"],
    ],
    execute: async ({ argument, logger, options, visConfig, workspaceRoot }) => {
        const project = (argument[0] as string | undefined) ?? "";
        const isJson = Boolean(options.json);
        const isVerbose = Boolean(options.verbose);
        const exitZeroOnBuild = Boolean(options["exit-zero-on-build"]);

        const debug = (message: string): void => {
            if (isVerbose && !isJson) {
                logger.info(`\u2771 ${message}`);
            }
        };

        /**
         * Terminal sink: renders the decision and calls `process.exit`.
         * Direct `process.exit` is deliberate — Vercel and Netlify read
         * the literal exit code, and cerebro's error-handler plugin
         * would clobber thrown errors with a 1 exit code carrying the
         * wrong semantic (error, not "build").
         */
        const emit = (decision: IgnoreDecision): never => {
            if (isJson) {
                process.stdout.write(`${JSON.stringify(decision)}\n`);
            } else {
                logger.info(formatDecisionLine(decision));
            }

            process.exit(exitCodeFor(decision, exitZeroOnBuild));
        };

        if (!project) {
            return emit(decideBuild("", "missing-project-argument", "Missing project argument. Usage: vis ignore <project>"));
        }

        if (!workspaceRoot) {
            return emit(decideBuild(project, "workspace-error", "Could not determine workspace root — building defensively"));
        }

        const commitMessage = await readLastCommitMessage(workspaceRoot);
        const commitSubject = commitMessage.trim().split("\n")[0] ?? "";

        debug(`commit: ${commitSubject}`);

        if (commitMessage && commitHasForceDeployMessage(commitMessage, project)) {
            return emit(decideBuild(project, "commit-force-deploy", `Force-deploy keyword in commit: "${commitSubject}"`));
        }

        if (commitMessage && commitHasSkipMessage(commitMessage, project)) {
            return emit(decideSkip(project, "commit-skip", `Skip keyword in commit: "${commitSubject}"`));
        }

        let workspace;
        let packageJsons;

        try {
            ({ packageJsons, workspace } = discoverWorkspace(workspaceRoot, visConfig));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            return emit(decideBuild(project, "workspace-error", `Workspace discovery failed (${message}) — building defensively`));
        }

        if (!Object.hasOwn(workspace.projects, project)) {
            return emit(decideBuild(project, "project-unknown", `Project "${project}" not found in workspace — building defensively`));
        }

        // The buildProjectGraph → validateGitRef → isRefReachable →
        // getAffectedProjects chain is wrapped in a single try/catch so
        // any throw in this section falls back to the defensive-build
        // emit() path instead of bubbling up to cerebro's error handler
        // (which would exit with error semantics — wrong for a CI hook).
        try {
            const explicitBase = (options.base as string | undefined)?.trim();
            const ciBase = resolveCiBaseSha();
            let baseRef = explicitBase || ciBase || "HEAD~1";
            const headRef = (options.head as string | undefined)?.trim() || "HEAD";

            validateGitRef(baseRef);
            validateGitRef(headRef);

            debug(`resolved base ref: ${baseRef} (source: ${explicitBase ? "flag" : ciBase ? "ci-env" : "default"})`);

            // Kick off the git rev-parse reachability probe without
            // awaiting so the synchronous `buildProjectGraph` work
            // overlaps with the child-process round-trip. Saves
            // 20–50ms per deploy on warm CI runners.
            const reachablePromise = isRefReachable(workspaceRoot, baseRef);
            const projectGraph = buildProjectGraph(workspaceRoot, workspace, packageJsons);

            if (!(await reachablePromise)) {
                debug(`base ref ${baseRef} not reachable — falling back to HEAD~1`);
                baseRef = "HEAD~1";
            }

            debug(`comparing ${baseRef}...${headRef}`);

            const downstream = ((options.downstream as string | undefined) ?? "deep") as AffectedScope;
            const upstream = ((options.upstream as string | undefined) ?? "none") as AffectedScope;

            if (!VALID_SCOPES.has(downstream)) {
                throw new Error(`Invalid --downstream value: "${downstream}". Must be "none", "direct", or "deep".`);
            }

            if (!VALID_SCOPES.has(upstream)) {
                throw new Error(`Invalid --upstream value: "${upstream}". Must be "none", "direct", or "deep".`);
            }

            const affectedOptions: AffectedOptions = {
                base: baseRef,
                downstream,
                head: headRef,
                projectGraph,
                projects: workspace.projects,
                upstream,
                workspaceRoot,
            };

            const result = await getAffectedProjects(affectedOptions);

            debug(`changed files: ${result.changedFiles.length}`);
            debug(`affected projects: ${result.affectedProjects.join(", ") || "(none)"}`);

            const refs = { base: baseRef, head: headRef };

            if (result.changedFiles.length === 0) {
                return emit(decideSkip(project, "no-changes", `No files changed between ${baseRef}...${headRef}`, { ...refs, affectedProjects: [] }));
            }

            if (result.affectedProjects.includes(project)) {
                return emit(
                    decideBuild(project, "project-affected", `Build ${project}: affected by ${result.changedFiles.length} changed file(s)`, {
                        ...refs,
                        affectedProjects: result.affectedProjects,
                    }),
                );
            }

            return emit(
                decideSkip(project, "project-not-affected", `Skip ${project}: not affected by changes between ${baseRef}...${headRef}`, {
                    ...refs,
                    affectedProjects: result.affectedProjects,
                }),
            );
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            logger.error(`Affected detection failed: ${errorMessage}`);

            return emit(decideBuild(project, "workspace-error", `Affected detection failed (${errorMessage}) — building defensively`));
        }
    },
    group: "Run & Execute",
    name: "ignore",
    options: [
        {
            description: "Git base ref for comparison. Defaults to CI provider env vars, then HEAD~1.",
            name: "base",
            type: String,
        },
        {
            defaultValue: "HEAD",
            description: "Git head ref for comparison",
            name: "head",
            type: String,
        },
        {
            defaultValue: "deep",
            description: 'Downstream scope: "none", "direct", or "deep"',
            name: "downstream",
            type: String,
        },
        {
            defaultValue: "none",
            description: 'Upstream scope: "none", "direct", or "deep"',
            name: "upstream",
            type: String,
        },
        {
            defaultValue: false,
            description: "Emit the decision as JSON on stdout instead of human text",
            name: "json",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Exit 0 on build (normal semantics) instead of 1 (inverted Vercel/Netlify semantics)",
            name: "exit-zero-on-build",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Enable verbose debug output",
            name: "verbose",
            type: Boolean,
        },
    ],
};

export default ignore;
