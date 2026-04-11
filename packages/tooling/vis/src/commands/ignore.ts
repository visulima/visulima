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
    exitCodeFor,
    formatDecisionLine,
    isRefReachable,
    readLastCommitMessage,
    resolveCiBaseSha,
    validateGitRef,
} from "./ignore-helpers";

const ignore: Command = {
    argument: {
        description: "Project name to check (required)",
        name: "project",
        type: String,
    },
    description: "Exit with inverted codes for CI \"Ignored Build Step\" gating (Vercel/Netlify)",
    examples: [
        ["vis ignore my-app", "Check if my-app is affected and decide whether to build"],
        ["vis ignore my-app --base $VERCEL_GIT_PREVIOUS_SHA", "Explicit base ref"],
        ["vis ignore my-app --json", "Emit the decision as JSON instead of text"],
        ["vis ignore my-app --verbose", "Print debug info about the decision path"],
        ["vis ignore my-app --exit-zero-on-build", "Normal exit semantics (0=build, 0=skip)"],
    ],
    execute: async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }) => {
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
         * We deliberately call `process.exit` directly (rather than
         * `throw`-ing or setting `process.exitCode`) because Vercel and
         * Netlify care about the literal exit code, and cerebro's
         * error-handler plugin would clobber thrown errors with 1.
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
            return emit({
                action: "build",
                message: "Missing project argument. Usage: vis ignore <project>",
                project: "",
                reason: "missing-project-argument",
            });
        }

        if (!wsRoot) {
            return emit({
                action: "build",
                message: "Could not determine workspace root — building defensively",
                project,
                reason: "workspace-error",
            });
        }

        const workspaceRoot = wsRoot;

        // 1) Commit-message gating takes precedence over git-diff.
        const commitMessage = await readLastCommitMessage(workspaceRoot);
        const commitSubject = commitMessage.trim().split("\n")[0] ?? "";

        debug(`commit: ${commitSubject}`);

        if (commitMessage && commitHasForceDeployMessage(commitMessage, project)) {
            return emit({
                action: "build",
                message: `Force-deploy keyword in commit: "${commitSubject}"`,
                project,
                reason: "commit-force-deploy",
            });
        }

        if (commitMessage && commitHasSkipMessage(commitMessage, project)) {
            return emit({
                action: "skip",
                message: `Skip keyword in commit: "${commitSubject}"`,
                project,
                reason: "commit-skip",
            });
        }

        // 2) Discover workspace and verify the project exists.
        let workspace;

        try {
            ({ workspace } = discoverWorkspace(workspaceRoot, visConfig));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            return emit({
                action: "build",
                message: `Workspace discovery failed (${message}) — building defensively`,
                project,
                reason: "workspace-error",
            });
        }

        if (!Object.hasOwn(workspace.projects, project)) {
            return emit({
                action: "build",
                message: `Project "${project}" not found in workspace — building defensively`,
                project,
                reason: "project-unknown",
            });
        }

        const projectGraph = buildProjectGraph(workspaceRoot, workspace);

        // 3) Resolve base ref: explicit flag > CI env var > HEAD~1, with
        //    reachability fallback for shallow clones.
        const explicitBase = (options.base as string | undefined)?.trim();
        const ciBase = resolveCiBaseSha();
        let baseRef = explicitBase || ciBase || "HEAD~1";
        const headRef = ((options.head as string | undefined)?.trim()) || "HEAD";

        validateGitRef(baseRef);
        validateGitRef(headRef);

        debug(`resolved base ref: ${baseRef} (source: ${explicitBase ? "flag" : ciBase ? "ci-env" : "default"})`);

        if (!(await isRefReachable(workspaceRoot, baseRef))) {
            debug(`base ref ${baseRef} not reachable — falling back to HEAD~1`);
            baseRef = "HEAD~1";
        }

        debug(`comparing ${baseRef}...${headRef}`);

        // 4) Validate scope options.
        const validScopes = new Set<AffectedScope>(["deep", "direct", "none"]);
        const downstream = ((options.downstream as string | undefined) ?? "deep") as AffectedScope;
        const upstream = ((options.upstream as string | undefined) ?? "none") as AffectedScope;

        if (!validScopes.has(downstream)) {
            throw new Error(`Invalid --downstream value: "${downstream}". Must be "none", "direct", or "deep".`);
        }

        if (!validScopes.has(upstream)) {
            throw new Error(`Invalid --upstream value: "${upstream}". Must be "none", "direct", or "deep".`);
        }

        // 5) Run affected detection.
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

        if (result.changedFiles.length === 0) {
            return emit({
                action: "skip",
                affectedProjects: [],
                base: baseRef,
                head: headRef,
                message: `No files changed between ${baseRef}...${headRef}`,
                project,
                reason: "no-changes",
            });
        }

        if (result.affectedProjects.includes(project)) {
            return emit({
                action: "build",
                affectedProjects: result.affectedProjects,
                base: baseRef,
                head: headRef,
                message: `Build ${project}: affected by ${result.changedFiles.length} changed file(s)`,
                project,
                reason: "project-affected",
            });
        }

        return emit({
            action: "skip",
            affectedProjects: result.affectedProjects,
            base: baseRef,
            head: headRef,
            message: `Skip ${project}: not affected by changes between ${baseRef}...${headRef}`,
            project,
            reason: "project-not-affected",
        });
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
            description: "Downstream scope: \"none\", \"direct\", or \"deep\"",
            name: "downstream",
            type: String,
        },
        {
            defaultValue: "none",
            description: "Upstream scope: \"none\", \"direct\", or \"deep\"",
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
