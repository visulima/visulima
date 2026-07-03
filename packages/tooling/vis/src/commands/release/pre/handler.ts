/**
 * `vis release pre [enter|exit|status]` — toggle pre-release mode.
 *
 * Pre-mode is changesets-compatible: while active, every
 * `vis release version` produces a prerelease (`1.2.0-alpha.N`)
 * instead of a stable bump. Lives in `.vis/release/pre.json` (tracked
 * in git so the state survives CI runner churn).
 *
 * `enter` and `exit` mutate the worktree; both auto-commit + push
 * pre.json with `[skip ci]` so the registry stays consistent across
 * branches without re-triggering CI. Override with `--no-commit` /
 * `--no-push`.
 */

import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { DEFAULT_CHANGES_DIR } from "../../../release/config";
import { stageAndCommitFile } from "../../../release/core/git";
import { buildContext } from "../../../release/core/orchestrator";
import { buildEnterFile, preModeFilePath, readPreMode, writePreMode } from "../../../release/core/pre-mode";
import { createShellRunner } from "../../../release/core/shell-runner";
import { VisReleaseError } from "../../../release/errors";
import type { ReleasePreOptions } from "./index";

type Action = "enter" | "exit" | "status";

const KNOWN: ReadonlyArray<Action> = ["enter", "exit", "status"];

const parseAction = (raw: string | undefined): Action | undefined => {
    if (raw === undefined || raw === "") {
        return "status";
    }

    return (KNOWN as ReadonlyArray<string>).includes(raw) ? (raw as Action) : undefined;
};

const runEnter = async (cwd: string, options: ReleasePreOptions, logger: Toolbox<Console, ReleasePreOptions>["logger"]): Promise<void> => {
    const tag = options.tag?.[0];

    if (!tag) {
        logger.error("`pre enter` requires a tag, e.g.: vis release pre enter alpha");
        process.exitCode = 1;

        return;
    }

    const ctx = await buildContext({ cwd, skipRegistryLookup: true });
    const changesDir = ctx.config.changesDir ?? DEFAULT_CHANGES_DIR;
    const existing = await readPreMode(cwd, changesDir);

    if (existing) {
        logger.error(`Already in pre-mode (tag "${existing.tag}", mode "${existing.mode}"). Run \`vis release pre exit\` first if you want to switch tags.`);
        process.exitCode = 1;

        return;
    }

    // Snapshot every workspace package's current version. Used by the
    // exit consolidation to compute the right stable bump regardless of
    // how many prerelease counters were burnt in between.
    const file = buildEnterFile(
        tag,
        ctx.packages.map((p) => {
            return { name: p.name, version: p.version };
        }),
    );
    const path = await writePreMode(cwd, changesDir, file);

    logger.info(`Entered pre-mode with tag "${tag}". ${Object.keys(file.initialVersions).length} package version(s) snapshot.`);

    if (options.commit === false) {
        logger.info(`Run \`git add ${path} && git commit -m 'chore(release): enter pre-mode (${tag}) [skip ci]'\` so CI sees the state.`);
    } else {
        const runner = createShellRunner();

        try {
            await stageAndCommitFile({ cwd, runner }, path, `chore(release): enter pre-mode (${tag}) [skip ci]`, {
                author: ctx.config.gitUser,
                push: options.push !== false,
                sign: ctx.config.gitSignCommits === true,
            });
            logger.info(`Committed ${path}${options.push === false ? "" : " + pushed"}.`);
        } catch (error) {
            logger.warn(`Could not commit ${path}: ${(error as Error).message}`);
        }
    }
};

const runExit = async (cwd: string, options: ReleasePreOptions, logger: Toolbox<Console, ReleasePreOptions>["logger"]): Promise<void> => {
    const ctx = await buildContext({ cwd, skipRegistryLookup: true });
    const changesDir = ctx.config.changesDir ?? DEFAULT_CHANGES_DIR;
    const existing = await readPreMode(cwd, changesDir);

    if (!existing) {
        logger.error("Not in pre-mode. Nothing to exit.");
        process.exitCode = 1;

        return;
    }

    if (existing.mode === "exit-pending") {
        logger.info("Pre-mode already in `exit-pending` state. Run `vis release version` to consolidate.");

        return;
    }

    // C6 fix: refuse `pre exit` when the active channel itself carries a
    // prerelease identifier (e.g. on an alpha-channel branch). In that
    // case the operator is asking us to flip to `exit-pending`, but the
    // next `vis release version` would still produce a prerelease via
    // the channel — so consolidation is impossible until they either
    // change branches or back out of `pre exit`. Throw CONFIG_INVALID
    // upfront with a clear hint instead of silently producing a broken
    // exit-pending state.
    if (ctx.channel?.prerelease !== undefined) {
        throw new VisReleaseError({
            code: "CONFIG_INVALID",
            hint: `Switch to a non-prerelease branch (one whose channel has no \`prerelease\` set) before running \`vis release pre exit\`, or stay in pre-mode by skipping the exit. Current channel "${ctx.channel.tag}" pins prerelease "${ctx.channel.prerelease}".`,
            message: `Refusing to exit pre-mode: the active channel "${ctx.channel.tag}" has its own prerelease identifier "${ctx.channel.prerelease}". Exiting would create an unrecoverable state — the next \`vis release version\` would still produce a prerelease via the channel, but the cleanup would delete pre.json making retry impossible.`,
        });
    }

    const next = { ...existing, mode: "exit-pending" as const };
    const path = await writePreMode(cwd, changesDir, next);

    logger.info(`Pre-mode flagged for exit. The next \`vis release version\` will consolidate the prereleases and delete pre.json.`);

    if (options.commit !== false) {
        const runner = createShellRunner();

        try {
            await stageAndCommitFile({ cwd, runner }, path, `chore(release): exit pre-mode (was ${existing.tag}) [skip ci]`, {
                author: ctx.config.gitUser,
                push: options.push !== false,
                sign: ctx.config.gitSignCommits === true,
            });
            logger.info(`Committed ${path}${options.push === false ? "" : " + pushed"}.`);
        } catch (error) {
            logger.warn(`Could not commit ${path}: ${(error as Error).message}`);
        }
    }
};

const runStatus = async (cwd: string, logger: Toolbox<Console, ReleasePreOptions>["logger"]): Promise<void> => {
    const ctx = await buildContext({ cwd, skipRegistryLookup: true });
    const changesDir = ctx.config.changesDir ?? DEFAULT_CHANGES_DIR;
    const file = await readPreMode(cwd, changesDir);

    if (!file) {
        logger.info("Pre-mode: off.");

        return;
    }

    logger.info(`Pre-mode: ${file.mode === "pre" ? "ACTIVE" : "EXIT-PENDING"} (tag "${file.tag}", entered ${file.enteredAt})`);
    logger.info(`  → ${preModeFilePath(cwd, changesDir)}`);
    logger.info(`  → ${Object.keys(file.initialVersions).length} package version(s) snapshot at enter time.`);
};

const execute = async ({ logger, options, workspaceRoot }: Toolbox<Console, ReleasePreOptions>): Promise<void> => {
    const cwd = workspaceRoot ?? process.cwd();
    const action = parseAction(options.action);

    if (action === undefined) {
        logger.error(`Unknown action "${options.action}". Expected one of: enter, exit, status.`);
        process.exitCode = 1;

        return;
    }

    if (action === "enter") {
        await runEnter(cwd, options, logger);

        return;
    }

    if (action === "exit") {
        await runExit(cwd, options, logger);

        return;
    }

    await runStatus(cwd, logger);
};

export default execute as CommandExecute<Toolbox>;
