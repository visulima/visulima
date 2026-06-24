/**
 * `vis release plan` —
 *
 *   default       : pass-through to `release status --json` (machine-readable plan).
 *   --interactive : walk through pending releases, accept or override each bump
 *                   level. With `--write`, the resulting overrides are persisted
 *                   to a new change file under `&lt;changesDir>/`.
 *
 * The interactive flow lets the operator override the auto-computed plan
 * before the version step runs — useful for promoting a routine patch into
 * a full minor when shipping notable changes.
 */

import { join } from "node:path";

import type { CerebroFs, CommandExecute, Toolbox } from "@visulima/cerebro";

import { DEFAULT_CHANGES_DIR } from "../../../release/config";
import { formatChangeFile } from "../../../release/core/change-file";
import { buildContext } from "../../../release/core/orchestrator";
import { randomTimestampSlug } from "../../../release/core/slug";
import type { BumpLevel, ChangeFileSimple, PlannedRelease } from "../../../release/types";
import statusHandler from "../status/handler";
import type { ReleasePlanOptions } from "./index";

const BUMP_LEVELS: ReadonlyArray<BumpLevel> = ["none", "patch", "minor", "major"];

const adjustLevel = (level: BumpLevel, delta: 1 | -1): BumpLevel => {
    const next = BUMP_LEVELS.indexOf(level) + delta;

    return BUMP_LEVELS[Math.min(Math.max(next, 0), BUMP_LEVELS.length - 1)] ?? level;
};

interface ReleaseWithOverride {
    chosen: BumpLevel;
    release: PlannedRelease;
}

const wasOverridden = (item: ReleaseWithOverride): boolean => item.chosen !== item.release.type;

const renderRelease = (release: PlannedRelease, current: BumpLevel): string => {
    const flags: string[] = [];

    if (release.isCascadeBump) {
        flags.push("cascade");
    }

    if (release.isGroupBump) {
        flags.push("group");
    }

    if (release.isDependencyBump && !release.isCascadeBump) {
        flags.push("dep-bump");
    }

    const flagSuffix = flags.length > 0 ? ` [${flags.join(", ")}]` : "";

    return `${release.name}: ${release.oldVersion} → ${release.newVersion} (${current})${flagSuffix}`;
};

const chooseLevel = async (release: PlannedRelease): Promise<BumpLevel> => {
    const { selectPrompt } = await import("../../../release/core/prompts");

    process.stdout.write(`\n${renderRelease(release, release.type)}\n`);

    const action = await selectPrompt<"accept" | "promote" | "demote" | "skip" | "set">("Action?", [
        { label: "accept (keep as-is)", value: "accept" },
        { label: "promote (bump up one level)", value: "promote" },
        { label: "demote (bump down one level)", value: "demote" },
        { label: "set explicitly (major | minor | patch | none)", value: "set" },
        { label: "skip this package", value: "skip" },
    ]);

    if (action === "promote") {
        return adjustLevel(release.type, 1);
    }

    if (action === "demote") {
        return adjustLevel(release.type, -1);
    }

    if (action === "skip") {
        return "none";
    }

    if (action === "set") {
        return selectPrompt<BumpLevel>("Set bump level to?", [
            { label: "major", value: "major" },
            { label: "minor", value: "minor" },
            { label: "patch", value: "patch" },
            { label: "none (skip)", value: "none" },
        ]);
    }

    return release.type;
};

const walkThroughInteractive = async (releases: ReadonlyArray<PlannedRelease>): Promise<ReleaseWithOverride[]> => {
    const out: ReleaseWithOverride[] = [];

    for (const release of releases) {
        out.push({ chosen: await chooseLevel(release), release });
    }

    return out;
};

const writeOverrideChangeFile = async (fs: CerebroFs, cwd: string, changesDir: string, chosen: ReleaseWithOverride[], body: string): Promise<string> => {
    const bumps: Record<string, BumpLevel> = {};

    for (const item of chosen) {
        if (item.chosen === "none") {
            continue;
        }

        bumps[item.release.name] = item.chosen;
    }

    const filePath = join(cwd, changesDir, `${randomTimestampSlug("plan")}.md`);
    const payload: ChangeFileSimple = { bumps };

    await fs.mkdir(join(cwd, changesDir), { recursive: true });
    await fs.writeFile(filePath, formatChangeFile(payload, body));

    return filePath;
};

const runInteractive = async (toolbox: Toolbox<Console, ReleasePlanOptions>): Promise<void> => {
    const { fs, logger, options, workspaceRoot } = toolbox;
    const cwd = workspaceRoot ?? process.cwd();

    if (!process.stdout.isTTY) {
        logger.error("--interactive requires a TTY. Drop the flag to get JSON output.");
        process.exitCode = 1;

        return;
    }

    const ctx = await buildContext({ channel: options.channel, cwd, skipRegistryLookup: true });

    const { printConfigIfRequested } = await import("../../../release/core/print-config");

    if (printConfigIfRequested(options, ctx, logger)) {
        return;
    }

    const { releases } = ctx.plan;

    if (releases.length === 0) {
        logger.info("No pending releases.");

        return;
    }

    if (ctx.channel) {
        logger.info(`Channel: ${ctx.channel.tag}${ctx.channel.prerelease ? ` (preid: ${ctx.channel.prerelease})` : ""} | mode: ${ctx.channel.mode}`);
    }

    logger.info(`Walking through ${releases.length} pending release(s). Press Ctrl-C to abort.`);

    const chosen = await walkThroughInteractive(releases);
    const overriddenCount = chosen.filter((entry) => wasOverridden(entry)).length;
    const skippedCount = chosen.filter((c) => c.chosen === "none").length;

    logger.info("");
    logger.info("Summary:");

    for (const item of chosen) {
        const tag = wasOverridden(item) ? ` (was ${item.release.type})` : "";

        logger.info(`  ${item.release.name}: ${item.chosen}${tag}`);
    }

    logger.info("");
    logger.info(`${overriddenCount} overridden, ${skippedCount} skipped, ${chosen.length - overriddenCount} accepted as-is.`);

    if (options.write) {
        if (overriddenCount === 0) {
            logger.info("Nothing to write — every package was accepted as-is.");

            return;
        }

        const { textPrompt } = await import("../../../release/core/prompts");
        const message = await textPrompt("Changelog body for the override change file:", "Operator-driven plan adjustment via `vis release plan -i`.");
        const changesDir = ctx.config.changesDir ?? DEFAULT_CHANGES_DIR;
        const filePath = await writeOverrideChangeFile(fs, cwd, changesDir, chosen, message);

        logger.info(`Wrote ${filePath}`);
    }
};

const execute = async (toolbox: Toolbox<Console, ReleasePlanOptions>): Promise<void> => {
    if (toolbox.options.interactive) {
        await runInteractive(toolbox);

        return;
    }

    await statusHandler({
        ...toolbox,
        options: {
            ...toolbox.options,
            bump: undefined,
            json: true,
        },
    });
};

export default execute as CommandExecute<Toolbox>;
