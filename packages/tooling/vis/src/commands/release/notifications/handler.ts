/**
 * `vis release notifications test` — dry-run channel verification.
 *
 * Mirrors `dispatchNotifications` from `core/notifications/interface.ts`
 * but with three differences:
 *   1. The `NotificationContext` is synthetic — a believable single-pkg
 *      release by default, or operator-supplied JSON via `--custom-context`.
 *   2. Channels can be filtered by kind (`--channel=slack`) or by id'd
 *      kind (`--channel=slack:eng`) so an operator can poke a single
 *      hook without re-disabling the others.
 *   3. We capture per-channel pass/fail + a fragment of the response
 *      body (or error message) for human-readable output. The publish
 *      path soft-fails channels to `plan.warnings`; here, failures
 *      drive the exit code so this command is useful in CI smoke tests.
 *
 * `skipPrerelease` is intentionally bypassed — operators want to see
 * the dispatch succeed regardless of the synthetic version string.
 */

import { resolve as resolvePath } from "node:path";

import type { CerebroFs, CommandExecute, Toolbox } from "@visulima/cerebro";

import type { NotificationChannel, NotificationContext } from "../../../release/core/notifications/interface";
import { buildContext } from "../../../release/core/orchestrator";
import { createShellRunner } from "../../../release/core/shell-runner";
import type { ReleaseNotificationsOptions } from "./index";

type Action = "test";

const KNOWN_ACTIONS: ReadonlyArray<Action> = ["test"];

const parseAction = (raw: string | undefined): Action | undefined => {
    if (raw === undefined || raw === "") {
        return "test";
    }

    return (KNOWN_ACTIONS as ReadonlyArray<string>).includes(raw) ? (raw as Action) : undefined;
};

const arrayify = <T>(value: T | T[] | null | undefined): T[] => {
    if (value === undefined || value === null) {
        return [];
    }

    return Array.isArray(value) ? value : [value];
};

/**
 * Build a believable synthetic NotificationContext. Mirrors the shape the
 * orchestrator produces post-publish so channel templates that reference
 * `{firstName}` / `{packages}` / `{repo}` render the same way they will
 * for a real release.
 *
 * The repo + monorepoName fields are resolved from the actual workspace
 * when possible — picking a real repo slug makes Slack/Discord previews
 * meaningful instead of placeholder noise.
 */
const buildSyntheticContext = async (fs: CerebroFs, cwd: string): Promise<NotificationContext> => {
    const runner = createShellRunner();

    let repo: string | undefined;
    let monorepoName: string | undefined;

    try {
        const { createRemoteClient, detectRemoteProvider } = await import("../../../release/core/remote/detect");
        const provider = await detectRemoteProvider(cwd, runner, undefined);
        const client = createRemoteClient(provider, {});

        repo = await client.detectRepoSlug(cwd, runner);
    } catch {
        // Repo detection is best-effort: a freshly init'd worktree may
        // not have a remote yet. Fall back to undefined; templates that
        // reference {repo} will simply render an empty string.
    }

    try {
        const rootManifest = JSON.parse(await fs.readFile(`${cwd}/package.json`, "utf8")) as { name?: string };

        monorepoName = rootManifest.name;
    } catch {
        // No root manifest — same fallback as the orchestrator.
    }

    const exampleName = monorepoName ? `${monorepoName.startsWith("@") ? monorepoName : `@${monorepoName}`}/example` : "@scope/example";
    const exampleUrl = repo ? `https://github.com/${repo}/releases/tag/v1.0.0` : "https://github.com/example/example/releases/tag/v1.0.0";

    return {
        channel: "latest",
        completedAt: new Date().toISOString(),
        ...(monorepoName === undefined ? {} : { monorepoName }),
        published: [
            {
                name: exampleName,
                tag: "latest",
                url: exampleUrl,
                version: "1.0.0",
            },
        ],
        ...(repo === undefined ? {} : { repo }),
        skipped: [],
    };
};

/**
 * Decide whether a channel id matches the operator's `--channel` filter.
 *
 * Filter forms:
 *   - "slack"      → matches every channel of kind slack (id "slack",
 *                    "slack:&lt;sub>", …)
 *   - "slack:eng"  → matches exactly the id "slack:eng"
 *
 * Empty / undefined filter matches everything.
 */
const channelMatchesFilter = (channelId: string, filter: string | undefined): boolean => {
    if (!filter) {
        return true;
    }

    if (filter.includes(":")) {
        return channelId === filter;
    }

    return channelId === filter || channelId.startsWith(`${filter}:`);
};

/**
 * Materialise the set of channels from config, with no filtering. We
 * deliberately bypass `dispatchNotifications` here because we need
 * per-channel outcomes (status, response body fragment) for reporting,
 * AND we want to skip the `skipPrerelease` short-circuit (the synthetic
 * version is just a placeholder).
 */
const materialiseChannels = async (
    config: NonNullable<import("../../../release/types").NotificationsConfig> | undefined,
): Promise<{ channels: NotificationChannel[]; pluginFailures: { error: string; id: string }[] }> => {
    const channels: NotificationChannel[] = [];
    const pluginFailures: { error: string; id: string }[] = [];

    if (!config) {
        return { channels, pluginFailures };
    }

    const { SlackNotificationChannel } = await import("../../../release/core/notifications/slack");

    for (const slack of arrayify(config.slack)) {
        channels.push(new SlackNotificationChannel(slack));
    }

    const { DiscordNotificationChannel } = await import("../../../release/core/notifications/discord");

    for (const discord of arrayify(config.discord)) {
        channels.push(new DiscordNotificationChannel(discord));
    }

    const { WebhookNotificationChannel } = await import("../../../release/core/notifications/webhook");

    for (const webhook of arrayify(config.webhook)) {
        channels.push(new WebhookNotificationChannel(webhook));
    }

    // Custom plugin loading. Loosely mirror dispatchNotifications's
    // dynamic-import path so a plugin tested here behaves the same way
    // it will at release time.
    if (config.plugins && config.plugins.length > 0) {
        const { pathToFileURL } = await import("node:url");
        const { dynamicEsmImport } = await import("../../../release/core/changelog/dynamic-import");

        for (const pluginRef of config.plugins) {
            const [path, options] = Array.isArray(pluginRef) ? pluginRef : [pluginRef, undefined];
            const id = path;

            try {
                const moduleUrl = path.startsWith(".") ? pathToFileURL(`${process.cwd()}/${path}`).href : path;
                const loaded = (await dynamicEsmImport(moduleUrl)) as { default?: unknown };
                const exported = (loaded.default ?? loaded) as unknown;

                let constructed: NotificationChannel | undefined;

                if (typeof exported === "function") {
                    constructed = (exported as (opts?: Record<string, unknown>) => NotificationChannel)(options);
                } else if (exported && typeof exported === "object" && typeof (exported as NotificationChannel).send === "function") {
                    constructed = exported as NotificationChannel;
                }

                if (constructed && typeof constructed === "object" && typeof constructed.send === "function") {
                    channels.push(constructed);
                } else {
                    pluginFailures.push({ error: `did not export a NotificationChannel (object with .send) or a factory returning one`, id });
                }
            } catch (error) {
                pluginFailures.push({ error: (error as Error).message, id });
            }
        }
    }

    return { channels, pluginFailures };
};

interface ChannelOutcome {
    error?: string;
    id: string;
    ok: boolean;
}

const dispatchOne = async (channel: NotificationChannel, context: NotificationContext): Promise<ChannelOutcome> => {
    try {
        await channel.send(context);

        return { id: channel.id, ok: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const { redactTokens } = await import("../../../release/core/security");

        return { error: redactTokens(message), id: channel.id, ok: false };
    }
};

const loadCustomContext = async (fs: CerebroFs, path: string): Promise<NotificationContext> => {
    const absolute = resolvePath(process.cwd(), path);
    const raw = await fs.readFile(absolute, "utf8");
    const parsed = JSON.parse(raw) as Partial<NotificationContext>;

    // Light shape coercion: required fields get sensible defaults so the
    // operator's file can be minimal (e.g. just `{"published": […]}`).
    return {
        channel: parsed.channel,
        completedAt: parsed.completedAt ?? new Date().toISOString(),
        ...(parsed.monorepoName === undefined ? {} : { monorepoName: parsed.monorepoName }),
        published: Array.isArray(parsed.published) ? parsed.published : [],
        ...(parsed.repo === undefined ? {} : { repo: parsed.repo }),
        skipped: Array.isArray(parsed.skipped) ? parsed.skipped : [],
    };
};

const execute = async ({ fs, logger, options, workspaceRoot }: Toolbox<Console, ReleaseNotificationsOptions>): Promise<void> => {
    const cwd = workspaceRoot ?? process.cwd();
    const action = parseAction(options.action);

    if (action === undefined) {
        logger.error(`Unknown action "${options.action}". Expected: test.`);
        process.exitCode = 1;

        return;
    }

    let ctx;

    try {
        // skipRegistryLookup: this command is read-only and doesn't need
        // an accurate version baseline; saves N parallel registry probes
        // on a workspace with many packages.
        ctx = await buildContext({ cwd, skipRegistryLookup: true });
    } catch (error) {
        logger.error(`Failed to load release context: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 1;

        return;
    }

    const config = ctx.config.notifications;
    const hasAnyConfig = Boolean(
        config
        && ((config.slack && (Array.isArray(config.slack) ? config.slack.length > 0 : true))
            || (config.discord && (Array.isArray(config.discord) ? config.discord.length > 0 : true))
            || (config.webhook && (Array.isArray(config.webhook) ? config.webhook.length > 0 : true))
            || (config.plugins && config.plugins.length > 0)),
    );

    if (!hasAnyConfig) {
        const payload = {
            channels: [] as ChannelOutcome[],
            hint: "No notifications configured. Add `release.notifications.{slack,discord,webhook,plugins}` to vis.config.ts.",
            ok: true,
        };

        if (options.json) {
            process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
        } else {
            logger.info(payload.hint);
        }

        // Graceful exit — no channels configured is not a failure for this
        // command. The operator gets a hint so they know what to add.
        return;
    }

    // Build context BEFORE channels so a bad --custom-context errors
    // before we touch any plugin code.
    let synthetic: NotificationContext;

    try {
        synthetic = options.customContext ? await loadCustomContext(fs, options.customContext) : await buildSyntheticContext(fs, cwd);
    } catch (error) {
        logger.error(`Could not load NotificationContext: ${(error as Error).message}`);
        process.exitCode = 1;

        return;
    }

    const { channels, pluginFailures } = await materialiseChannels(config);

    const filter = options.channel;
    const filtered = channels.filter((channel) => channelMatchesFilter(channel.id, filter));

    if (filtered.length === 0 && pluginFailures.length === 0) {
        const hint = filter
            ? `No channels matched filter "${filter}". Configured ids: ${channels.map((c) => c.id).join(", ") || "(none)"}.`
            : "No channels could be materialised from the configured notifications block.";

        if (options.json) {
            process.stdout.write(`${JSON.stringify({ channels: [], hint, ok: false }, null, 2)}\n`);
        } else {
            logger.error(hint);
        }

        process.exitCode = 1;

        return;
    }

    // Run in parallel — same as dispatchNotifications. One slow webhook
    // shouldn't stall the report.
    const outcomes = await Promise.all(filtered.map((channel) => dispatchOne(channel, synthetic)));

    // Plugin load failures count as dispatch failures so the operator
    // sees the bad config even when only one plugin is broken.
    const allOutcomes: ChannelOutcome[] = [
        ...outcomes,
        ...pluginFailures.map((failure) => {
            return { error: `plugin load failed: ${failure.error}`, id: failure.id, ok: false };
        }),
    ];

    const failed = allOutcomes.filter((outcome) => !outcome.ok);

    if (options.json) {
        process.stdout.write(
            `${JSON.stringify(
                {
                    channels: allOutcomes,
                    ok: failed.length === 0,
                },
                null,
                2,
            )}\n`,
        );
    } else {
        for (const outcome of allOutcomes) {
            if (outcome.ok) {
                logger.info(`  ${outcome.id}  OK`);
            } else {
                logger.error(`  ${outcome.id}  FAIL — ${outcome.error ?? "unknown error"}`);
            }
        }

        const total = allOutcomes.length;
        const ok = total - failed.length;

        logger.info("");
        logger.info(`Dispatched ${ok}/${total} channel${total === 1 ? "" : "s"}.`);
    }

    if (failed.length > 0) {
        process.exitCode = 1;
    }
};

export default execute as CommandExecute<Toolbox>;
