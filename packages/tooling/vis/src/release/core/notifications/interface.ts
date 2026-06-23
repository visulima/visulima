// fallow-ignore-file circular-dependencies -- channel implementations (slack/webhook/discord) import shared helpers from here, while this module lazy-loads them via dynamic `import()` in the factory. The dynamic back-edge breaks the runtime cycle; the coupling is intentional.

/**
 * Notifications — post-release fan-out to chat / webhook destinations.
 *
 * Modeled on semantic-release's plugin ecosystem
 * (`semantic-release-slack-bot`, `semantic-release-discord-notifier`,
 * etc.) but first-party so the most common cases don't require a
 * userland plugin. Custom channels load via the `plugins` config:
 * `release.notifications.plugins: ["./my-channel.ts"]`.
 *
 * Lifecycle:
 *   - `publishContext` calls `dispatchNotifications` AFTER tags + GH
 *     releases land (so URLs are populated) and BEFORE the publishContext
 *     return.
 *   - Every channel fans out in parallel.
 *   - One channel's failure is logged (warn) but does NOT fail the
 *     publish. The release shipped; a Slack webhook outage shouldn't
 *     cascade.
 *
 * Why a plugin contract instead of "just curl in postPublishCommand"?
 *   - Typed inputs (released[], skipped[], channel, repo) — no template
 *     interpolation footguns
 *   - Concurrent dispatch
 *   - Per-channel soft-fail
 *   - Token redaction (the channel implementations route through the
 *     shell-runner's redactTokens when logging, even for non-shell
 *     I/O like `fetch`)
 *   - First-class doctor checks for required env vars
 */

import type { NotificationsConfig } from "../../types";

export interface NotificationPackage {
    /** Package name. */
    name: string;

    /** dist-tag / channel name (`latest`, `alpha`, …). */
    tag?: string;

    /**
     * URL of the published artifact (npm package page, GH release URL,
     * etc.). Populated by `publishContext` after `createRemoteReleases`.
     * May be absent when the registry has no canonical URL (e.g. a
     * shell-publish target with no `checkPublished` lookup).
     */
    url?: string;
    /** Resolved version. */
    version: string;
}

export interface NotificationContext {
    /** Active channel name (`main`, `alpha`, …). Absent when no channel matched. */
    channel?: string;
    /** ISO-8601 wave-completion timestamp. */
    completedAt: string;
    /** Workspace name pulled from root `package.json#name`, when present. */
    monorepoName?: string;
    /** Packages that successfully published in this wave. */
    published: ReadonlyArray<NotificationPackage>;
    /** Repo slug (`owner/name`) for URL composition. */
    repo?: string;

    /**
     * Packages skipped at the publish gate (stage-rejected / stage-timeout /
     * already-published / etc.). Channel implementations decide whether to
     * surface them.
     */
    skipped: ReadonlyArray<{ name: string; reason: string }>;
}

/**
 * The contract a notification channel implements. Built-in channels
 * (slack, discord, webhook) implement this; custom plugins do too.
 *
 * Implementations MUST be idempotent — `dispatchNotifications` may be
 * retried after a partial failure, and posting the same release twice
 * is annoying.
 */
export interface NotificationChannel {
    /** Stable id used in log messages: `"slack"`, `"discord"`, `"webhook"`, …. */
    readonly id: string;

    /**
     * Send the notification. Throw on hard failure (HTTP non-2xx,
     * network error). The dispatcher catches and logs as a warn-level
     * message; it does NOT propagate.
     */
    send: (context: NotificationContext) => Promise<void>;
}

const arrayify = <T>(value: T | T[] | null | undefined): T[] => {
    // Tolerate `null` alongside `undefined` — config tooling that
    // resolves env vars to null (e.g. templating engines on an unset
    // var) shouldn't crash `new SlackNotificationChannel(null)`.
    if (value === undefined || value === null) {
        return [];
    }

    return Array.isArray(value) ? value : [value];
};

/**
 * Decide whether the wave is a prerelease for notification-skip
 * purposes. Considered a prerelease when ALL published versions have
 * a prerelease component (`1.2.0-alpha.0`). A mixed wave (one alpha
 * + four stables) still notifies — those are rare and probably
 * deliberate.
 */
const isPrereleaseWave = (published: ReadonlyArray<NotificationPackage>): boolean => {
    if (published.length === 0) {
        return false;
    }

    return published.every((pkg) => /-/.test(pkg.version));
};

/**
 * Materialise + dispatch every configured notification channel. Called
 * from `publishContext` after `createRemoteReleases` populates URLs.
 *
 * All channels run in parallel; per-channel failures are isolated to
 * a single warn-level log line. Returns the per-channel outcomes so
 * the orchestrator can surface them on the result object if desired
 * (currently it doesn't — the publish result is unaffected by
 * notification outcomes, by design).
 */
export const dispatchNotifications = async (
    config: NotificationsConfig | undefined,
    context: NotificationContext,
    logger?: { warn: (message: string) => void },
): Promise<{ failed: { error: string; id: string }[]; succeeded: string[] }> => {
    const resolvedLogger = logger ?? { warn: (m: string) => process.stderr.write(`${m}\n`) };
    const result = { failed: [] as { error: string; id: string }[], succeeded: [] as string[] };

    if (!config || context.published.length === 0) {
        return result;
    }

    if ((config.skipPrerelease ?? true) && isPrereleaseWave(context.published)) {
        return result;
    }

    const channels: NotificationChannel[] = [];

    // Hoisted once so both the plugin-load `failed.push` AND the
    // per-channel `failed.push` route their error strings through the
    // shared token regex. Channel paths can embed secrets
    // (`file:///root/.config/secret-token-${TOKEN}.mjs`) and channel
    // errors can embed bearer-style webhook URLs.
    const { redactTokens } = await import("../security");

    // Built-in materialisation. Each kind accepts a single config OR
    // an array — common to want one Slack channel per team but a single
    // operator may also fan out to "production" + "engineering" hooks.
    const { SlackNotificationChannel } = await import("./slack");

    for (const slack of arrayify(config.slack)) {
        channels.push(new SlackNotificationChannel(slack));
    }

    const { DiscordNotificationChannel } = await import("./discord");

    for (const discord of arrayify(config.discord)) {
        channels.push(new DiscordNotificationChannel(discord));
    }

    const { WebhookNotificationChannel } = await import("./webhook");

    for (const webhook of arrayify(config.webhook)) {
        channels.push(new WebhookNotificationChannel(webhook));
    }

    // Plugin loading. Path resolves relative to the workspace root; the
    // module exports a `default` of type `NotificationChannel` OR a
    // factory `(options) => NotificationChannel` when the config uses
    // the tuple form `[path, options]`.
    for (const pluginRef of config.plugins ?? []) {
        try {
            const channel = await loadPluginChannel(pluginRef);

            channels.push(channel);
        } catch (error) {
            const id = typeof pluginRef === "string" ? pluginRef : pluginRef[0];
            const rawMessage = (error as Error).message;
            const safeMessage = redactTokens(rawMessage);

            result.failed.push({ error: `plugin load failed: ${safeMessage}`, id });
            resolvedLogger.warn(`[notifications:${id}] could not load plugin: ${safeMessage}`);
        }
    }

    if (channels.length === 0) {
        return result;
    }

    // Fan out in parallel. Per-channel try/catch so one bad webhook
    // doesn't take the others with it.
    await Promise.all(channels.map(async (channel) => {
        try {
            await channel.send(context);
            result.succeeded.push(channel.id);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            // Redact through the shared token regex BEFORE pushing into
            // `result.failed` — the orchestrator surfaces this on
            // `plan.warnings`, and the underlying fetch rejection from
            // Node embeds the URL ("connect ECONNREFUSED https://hooks.
            // slack.com/services/T/B/SECRET"). Channel implementations
            // additionally wrap their fetch rejections to drop the URL.
            const safeMessage = redactTokens(message);

            result.failed.push({ error: safeMessage, id: channel.id });
            resolvedLogger.warn(`[notifications:${channel.id}] ${safeMessage}`);
        }
    }));

    return result;
};

/**
 * Resolve a `release.notifications.plugins` entry to a NotificationChannel
 * instance. Supports two shapes:
 *   - `"./path-to-module.ts"`  — default export is the channel OR a
 *                                zero-arg factory returning one
 *   - `["./path-to-module.ts", { …options }]`  — default export is a
 *                                factory accepting the options object.
 */
const loadPluginChannel = async (pluginRef: string | [string, Record<string, unknown>]): Promise<NotificationChannel> => {
    const [path, options] = Array.isArray(pluginRef) ? pluginRef : [pluginRef, undefined];

    const { pathToFileURL } = await import("node:url");
    const moduleUrl = path.startsWith(".") ? pathToFileURL(`${process.cwd()}/${path}`).href : path;
    const { dynamicEsmImport } = await import("../changelog/dynamic-import");
    const loaded = await dynamicEsmImport(moduleUrl) as { default?: unknown };
    const exported = loaded.default ?? loaded;

    if (typeof exported === "function") {
        const constructed = (exported as (opts?: Record<string, unknown>) => NotificationChannel)(options);

        if (constructed && typeof constructed === "object" && typeof (constructed).send === "function") {
            return constructed;
        }
    }

    if (exported && typeof exported === "object" && typeof (exported as NotificationChannel).send === "function") {
        return exported as NotificationChannel;
    }

    throw new TypeError(`Notification plugin at ${path} did not export a NotificationChannel (object with .send) or a factory returning one.`);
};

/**
 * Common template substitution shared across built-in channels. Tokens:
 *   {count}        — number of published packages
 *   {packages}     — comma-separated `name@version` list
 *   {firstName}    — first package's name (handy for single-pkg releases)
 *   {firstVersion} — first package's version
 *   {channel}      — active channel name
 *   {repo}         — `owner/name` slug
 *   {date}         — `YYYY-MM-DD`
 */
export const expandNotificationTemplate = (
    template: string,
    context: NotificationContext,
): string => {
    // Defensive coercion: a misconfigured user passing a number /
    // boolean / object as `title` would otherwise throw on .replaceAll
    // and pollute warnings. Coerce non-strings via String(); null and
    // undefined collapse to "" so they render the same as an absent
    // template.
    if (typeof template !== "string") {
        return String(template ?? "");
    }

    const first = context.published[0];

    return template
        .replaceAll("{count}", String(context.published.length))
        .replaceAll("{packages}", context.published.map((p) => `${p.name}@${p.version}`).join(", "))
        .replaceAll("{firstName}", first?.name ?? "")
        .replaceAll("{firstVersion}", first?.version ?? "")
        .replaceAll("{channel}", context.channel ?? "")
        .replaceAll("{repo}", context.repo ?? "")
        .replaceAll("{date}", context.completedAt.slice(0, 10));
};
