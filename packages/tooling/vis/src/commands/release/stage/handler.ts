/**
 * `vis release stage [list|approve|reject]` — wraps `npm stage *` so the
 * human-review step that staged-publishing requires (2FA-gated approval)
 * has a vis-aware surface.
 *
 * `approve --all` reads the most recent release wave's stage ids from
 * `.vis/release/.state.json` so an operator can promote the entire batch
 * with one command instead of pasting ids one at a time.
 */

import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { DEFAULT_CHANGES_DIR } from "../../../release/config";
import { buildContext } from "../../../release/core/orchestrator";
import { createShellRunner } from "../../../release/core/shell-runner";
import { readStagedRegistry, removePendingStages, writeStagedRegistry } from "../../../release/core/staged-registry";
import { acquireLock, releaseLock } from "../../../release/core/state";
import type { ReleaseStageOptions } from "./index";

type Action = "approve" | "list" | "reject";

const KNOWN_ACTIONS: ReadonlyArray<Action> = ["approve", "list", "reject"];

/**
 * Resolve the subcommand. Unknown values surface as `undefined` so the
 * caller can print a clear error instead of silently running `list` on a
 * typo like `vis release stage aprove`.
 */
const parseAction = (raw: string | undefined): Action | undefined => {
    if (raw === undefined || raw === "") {
        return "list";
    }

    return (KNOWN_ACTIONS as ReadonlyArray<string>).includes(raw) ? (raw as Action) : undefined;
};

/**
 * Merge what npm thinks is staged with what we recorded in
 * `.vis/release/staged.json`. Three flavors of entry can appear:
 *
 *   1. **synced** — both sources agree: visible to npm AND in our registry
 *   2. **registry-only** — recorded by a prior `vis release publish` that
 *      timed out, but `npm stage list` doesn't return it (different
 *      auth scope, OIDC token, etc.) — still important to surface
 *   3. **npm-only** — staged outside vis (manual `npm stage publish`)
 *
 * All three are real; we list all three so the operator can pick which
 * to approve / reject regardless of where the stage was created.
 */
const runList = async (
    runner: ReturnType<typeof createShellRunner>,
    cwd: string,
    options: ReleaseStageOptions,
    logger: Toolbox<Console, ReleaseStageOptions>["logger"],
): Promise<void> => {
    const args = ["stage", "list", "--json"];

    // Accept either `--filter @scope/pkg` or the bare positional form
    // `vis release stage list @scope/pkg`. The positional shape ends up
    // in stage-ids (defaultOption: true captures the action; subsequent
    // positionals fall through to stage-ids). Prefer --filter when both
    // are present.
    const positionalFilter = options.stageIds?.[0];
    const filterArg = options.filter ?? positionalFilter;

    if (filterArg) {
        args.push(filterArg);
    }

    const npmResult = await runner.run("npm", args, { cwd, silent: true });
    const ctx = await buildContext({ cwd });
    const fullRegistry = await readStagedRegistry(cwd, ctx.config.changesDir ?? DEFAULT_CHANGES_DIR);

    // Apply the same filter to the registry view so `list @scope/pkg`
    // shows a consistent result across both sources.
    const registry = filterArg
        ? { ...fullRegistry, pending: fullRegistry.pending.filter((entry) => entry.name === filterArg) }
        : fullRegistry;

    let npmEntries: { id?: string; package?: string; tag?: string; version?: string }[] = [];

    if (npmResult.exitCode === 0 && npmResult.stdout.trim()) {
        try {
            npmEntries = JSON.parse(npmResult.stdout);
        } catch {
            // npm changed the JSON shape — keep the registry view alive
            // and print the raw npm output so the operator can still see it.
            process.stdout.write(`${npmResult.stdout}\n`);
        }
    }

    if (options.json) {
        process.stdout.write(`${JSON.stringify({ npm: npmEntries, registry: registry.pending }, null, 2)}\n`);

        return;
    }

    if (npmEntries.length === 0 && registry.pending.length === 0) {
        logger.info("No staged versions awaiting approval.");

        return;
    }

    const idsInNpm = new Set(npmEntries.map((entry) => entry.id).filter(Boolean));
    const idsInRegistry = new Set(registry.pending.map((entry) => entry.id));

    for (const entry of npmEntries) {
        const tag = idsInRegistry.has(entry.id ?? "") ? "" : "  [npm-only]";

        logger.info(`  ${entry.id ?? "<no-id>"}  ${entry.package ?? "?"}@${entry.version ?? "?"}  → ${entry.tag ?? "latest"}${tag}`);
    }

    for (const entry of registry.pending) {
        if (idsInNpm.has(entry.id)) {
            continue;
        }

        logger.info(`  ${entry.id}  ${entry.name}@${entry.version}  → ${entry.tag ?? "latest"}  [registry-only, ${entry.reason}]`);
    }
};

const collectIdsForApprove = async (
    cwd: string,
    options: ReleaseStageOptions,
    logger: Toolbox<Console, ReleaseStageOptions>["logger"],
): Promise<string[] | undefined> => {
    if (options.all) {
        const ctx = await buildContext({ cwd });
        const registry = await readStagedRegistry(cwd, ctx.config.changesDir ?? DEFAULT_CHANGES_DIR);

        if (registry.pending.length === 0) {
            logger.error("No pending stages in .vis/release/staged.json. Approve manually with explicit ids, or rerun `vis release publish` with publish.stage: true.");

            return undefined;
        }

        return registry.pending.map((entry) => entry.id);
    }

    const ids = options.stageIds ?? [];

    if (ids.length === 0) {
        logger.error("Pass stage ids positionally, or use --all to approve every pending stage in .vis/release/staged.json.");

        return undefined;
    }

    return ids;
};

const runApproveOrReject = async (
    action: "approve" | "reject",
    runner: ReturnType<typeof createShellRunner>,
    cwd: string,
    options: ReleaseStageOptions,
    logger: Toolbox<Console, ReleaseStageOptions>["logger"],
): Promise<void> => {
    const ids = action === "approve"
        ? await collectIdsForApprove(cwd, options, logger)
        : options.stageIds;

    if (!ids || ids.length === 0) {
        if (action === "reject") {
            logger.error("Pass stage ids positionally to reject.");
        }

        process.exitCode = 1;

        return;
    }

    const successes: string[] = [];
    const failures: { id: string; reason: string }[] = [];

    for (const id of ids) {
        // npm stage approve / reject prompts for 2FA interactively;
        // intentionally let stdio inherit (silent: false) so the prompt
        // reaches the operator's terminal.
        const result = await runner.run("npm", ["stage", action, id], { cwd, silent: false });

        if (result.exitCode === 0) {
            successes.push(id);
        } else {
            failures.push({ id, reason: result.stderr.trim() || `exit ${result.exitCode}` });
        }
    }

    logger.info("");

    if (successes.length > 0) {
        logger.info(`${action === "approve" ? "Approved" : "Rejected"} ${successes.length} stage(s).`);

        // Drain successful ids from the persistent registry so the next
        // release wave doesn't see them as still pending. Same commit-with-
        // [skip ci] flow as the publish step uses, with --no-commit / --no-push
        // escape hatches for operators driving this from a non-CI context
        // where the side-effect commit isn't wanted.
        let rejectedEntries: { name: string; version: string }[] = [];

        try {
            const ctx = await buildContext({ cwd });
            const changesDir = ctx.config.changesDir ?? DEFAULT_CHANGES_DIR;
            const registry = await readStagedRegistry(cwd, changesDir);

            // Capture rejected entries' (name, version) BEFORE the drain so
            // we can print orphan-edit hints below. Only meaningful for
            // reject — approve doesn't orphan anything.
            if (action === "reject") {
                const successSet = new Set(successes);

                rejectedEntries = registry.pending
                    .filter((entry) => successSet.has(entry.id))
                    .map((entry) => { return { name: entry.name, version: entry.version }; });
            }

            const next = removePendingStages(registry, successes);

            if (next !== registry) {
                const write = await writeStagedRegistry(cwd, changesDir, next);

                if (write.changed && options.commit !== false) {
                    const { stageAndCommitFile } = await import("../../../release/core/git");
                    const message = write.removed
                        ? `chore(release): clear pending stage registry [skip ci]`
                        : `chore(release): ${action} ${successes.length} stage${successes.length === 1 ? "" : "s"} [skip ci]`;

                    await stageAndCommitFile(
                        { cwd, runner },
                        write.path,
                        message,
                        {
                            author: ctx.config.gitUser,
                            push: options.push !== false,
                            sign: ctx.config.gitSignCommits === true,
                        },
                    );

                    logger.info(`Updated ${write.path} and committed${options.push === false ? "" : " + pushed"}.`);
                } else if (write.changed) {
                    logger.info(`Updated ${write.path}. Commit + push it so the next release wave sees the resolved state.`);
                }
            }
        } catch (error) {
            // Best-effort registry maintenance — never overshadow the
            // primary approve/reject success.
            logger.warn(`Could not update staged registry: ${(error as Error).message}`);
        }

        // Orphan-CHANGELOG hint (C5 fix). On reject, the per-package
        // CHANGELOG.md section for the rejected version was written during
        // the version phase but the version never installed — leaving the
        // section as an orphan. We don't auto-edit (too risky: operator
        // may have amended the section with context); we print a clear
        // pointer instead. Workspace CHANGELOG.md is unaffected — that's
        // written by the publish phase using result.published[].
        if (rejectedEntries.length > 0) {
            logger.info("");
            logger.info("Orphan CHANGELOG sections to review:");

            for (const entry of rejectedEntries) {
                logger.info(`  Edit CHANGELOG.md for ${entry.name} to remove the orphan ${entry.version} section before the next wave`);
            }

            logger.info("(Workspace CHANGELOG.md is unaffected — its wave entry is written from the publish phase against actually-published versions.)");
        }
    }

    if (failures.length > 0) {
        for (const f of failures) {
            logger.error(`  ${f.id}: ${f.reason}`);
        }

        process.exitCode = 1;
    }
};

const execute = async ({ logger, options, workspaceRoot }: Toolbox<Console, ReleaseStageOptions>): Promise<void> => {
    const cwd = workspaceRoot ?? process.cwd();
    const action = parseAction(options.action);

    if (action === undefined) {
        logger.error(`Unknown action "${options.action}". Expected one of: list, approve, reject.`);
        process.exitCode = 1;

        return;
    }

    const runner = createShellRunner();

    if (action === "list") {
        // Read-only — no lock needed, two concurrent `list` invocations
        // can run safely.
        await runList(runner, cwd, options, logger);

        return;
    }

    // Approve / reject mutate staged.json (and commit + push) — acquire
    // the same process lock that `vis release publish` uses so a local
    // approve doesn't race with CI mid-publish. Skip the lock when
    // --no-commit is set: the operator is opting out of git side-effects,
    // so they're driving the synchronisation themselves.
    let lockChangesDir: string | undefined;
    let lockAcquired = false;

    if (options.commit !== false) {
        try {
            const ctx = await buildContext({ cwd });

            lockChangesDir = ctx.config.changesDir ?? DEFAULT_CHANGES_DIR;
            await acquireLock(cwd, lockChangesDir);
            lockAcquired = true;
        } catch (error) {
            logger.error(`Could not acquire release lock: ${(error as Error).message}`);
            process.exitCode = 1;

            return;
        }
    }

    try {
        await runApproveOrReject(action, runner, cwd, options, logger);
    } finally {
        if (lockAcquired && lockChangesDir) {
            await releaseLock(cwd, lockChangesDir);
        }
    }
};

export default execute as CommandExecute<Toolbox>;
