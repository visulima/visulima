/**
 * Slack notification channel.
 *
 * Uses Slack's incoming-webhook API. The webhook URL is workspace-
 * scoped on Slack's side (no shared OAuth token); operators paste it
 * directly into `release.notifications.slack.webhook` or reference an
 * env var like `${SLACK_WEBHOOK_URL}` (resolved by the visulima config
 * loader's standard env-substitution).
 *
 * Message format: a header block + a section listing each package with
 * its URL (when known) + a context block tagging the channel.
 * Operators wanting heavier customisation should write a custom plugin
 * via `release.notifications.plugins`.
 */

import type { SlackConfig } from "../../types";
import type { NotificationChannel, NotificationContext } from "./interface";
import { expandNotificationTemplate } from "./interface";

interface SlackBlock {
    accessory?: { text: { text: string; type: "plain_text" }; type: "button"; url: string };
    elements?: { text: string; type: "mrkdwn" }[];
    text?: { text: string; type: "mrkdwn" | "plain_text" };
    type: "context" | "divider" | "header" | "section";
}

const formatPackageBullet = (pkg: NotificationContext["published"][number]): string => {
    if (pkg.url) {
        return `• <${pkg.url}|${pkg.name}@${pkg.version}>`;
    }

    return `• ${pkg.name}@${pkg.version}`;
};

export class SlackNotificationChannel implements NotificationChannel {
    public readonly id: string;

    public constructor(private readonly config: SlackConfig) {
        // Suffix the id with a short hash of the webhook so two slack
        // channels (e.g. "engineering" + "releases") get distinct log
        // lines and per-channel doctor checks.
        this.id = config.id ? `slack:${config.id}` : "slack";
    }

    public async send(context: NotificationContext): Promise<void> {
        const title = this.config.title
            ? expandNotificationTemplate(this.config.title, context)
            : `🚀 Released ${context.published.length} package${context.published.length === 1 ? "" : "s"}`;

        const blocks: SlackBlock[] = [{ text: { text: title, type: "plain_text" }, type: "header" }];

        if (context.published.length > 0) {
            blocks.push({
                text: {
                    text: context.published.map((entry) => formatPackageBullet(entry)).join("\n"),
                    type: "mrkdwn",
                },
                type: "section",
            });
        }

        const contextBits: string[] = [];

        if (context.channel) {
            contextBits.push(`channel: \`${context.channel}\``);
        }

        if (context.repo) {
            contextBits.push(`<https://github.com/${context.repo}|${context.repo}>`);
        }

        // M-5 guard: `Date.parse` returns NaN on garbage input (e.g. a
        // custom plugin populating `completedAt` with a bogus string).
        // Slack falls back to plain text for `<!date^NaN^...>` blocks,
        // but the rendered preview looks broken. Skip the fancy date
        // block entirely on parse failure — the plain ISO string is
        // already in the fallback `|${context.completedAt}>` slot.
        const completedAtMs = Date.parse(context.completedAt);

        if (Number.isFinite(completedAtMs)) {
            contextBits.push(`<!date^${Math.floor(completedAtMs / 1000)}^{date_short_pretty} at {time}|${context.completedAt}>`);
        } else {
            contextBits.push(context.completedAt);
        }

        blocks.push({
            elements: [{ text: contextBits.join("  •  "), type: "mrkdwn" }],
            type: "context",
        });

        if (context.skipped.length > 0 && this.config.includeSkipped !== false) {
            blocks.push({ type: "divider" });
            blocks.push({
                text: {
                    text: `*Skipped (${context.skipped.length}):* ${context.skipped.map((s) => `\`${s.name}\` (${s.reason})`).join(", ")}`,
                    type: "mrkdwn",
                },
                type: "section",
            });
        }

        const body = {
            blocks,
            text: title, // Plain-text fallback for notifications + screen readers.
            ...(this.config.channelOverride ? { channel: this.config.channelOverride } : {}),
            ...(this.config.username ? { username: this.config.username } : {}),
            ...(this.config.iconEmoji ? { icon_emoji: this.config.iconEmoji } : {}),
        };

        let response: Response;

        try {
            response = await fetch(this.config.webhook, {
                body: JSON.stringify(body),
                headers: { "Content-Type": "application/json" },
                method: "POST",
            });
        } catch (error) {
            // Wrap the underlying network/DNS error so the webhook URL
            // (which Slack treats as a bearer secret in the path) never
            // surfaces in logs or in `result.failed[].error`.
            const reason = error instanceof Error ? error.name : "NetworkError";

            throw new Error(`Slack webhook fetch failed (${reason})`, { cause: error });
        }

        if (!response.ok) {
            const errorBody = await response.text().catch(() => "");

            throw new Error(`Slack webhook returned ${response.status} ${response.statusText}${errorBody ? `: ${errorBody.slice(0, 200)}` : ""}`);
        }
    }
}
