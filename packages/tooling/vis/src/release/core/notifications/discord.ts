/**
 * Discord notification channel.
 *
 * Uses Discord's webhook API. The webhook URL is server+channel-
 * scoped on Discord's side (no shared OAuth). Operators paste it
 * into `release.notifications.discord.webhook` directly or via env
 * substitution (`${DISCORD_WEBHOOK_URL}`).
 *
 * Discord renders one embed per webhook payload — we use a single
 * embed with a title + description containing the package list. For
 * very large waves (>25 packages) the description is truncated with a
 * "... +N more" footer to stay under Discord's 4096-char limit.
 */

import type { DiscordConfig } from "../../types";
import type { NotificationChannel, NotificationContext } from "./interface";
import { expandNotificationTemplate } from "./interface";

const DESCRIPTION_LIMIT = 4096;
const SAFE_DESCRIPTION_LIMIT = 3800; // leave headroom for "... +N more" footer

const formatPackageBullet = (pkg: NotificationContext["published"][number]): string => {
    if (pkg.url) {
        return `• [\`${pkg.name}@${pkg.version}\`](${pkg.url})`;
    }

    return `• \`${pkg.name}@${pkg.version}\``;
};

const buildDescription = (context: NotificationContext): string => {
    const lines = context.published.map((entry) => formatPackageBullet(entry));
    let description = lines.join("\n");

    // Discord embed description has a hard 4096-char limit. Truncate
    // gracefully when we're over budget.
    if (description.length > SAFE_DESCRIPTION_LIMIT) {
        let runningLength = 0;
        const kept: string[] = [];

        for (const line of lines) {
            if (runningLength + line.length + 1 > SAFE_DESCRIPTION_LIMIT) {
                kept.push(`*… +${lines.length - kept.length} more*`);
                break;
            }

            kept.push(line);
            runningLength += line.length + 1;
        }

        description = kept.join("\n");
    }

    return description.slice(0, DESCRIPTION_LIMIT);
};

export class DiscordNotificationChannel implements NotificationChannel {
    public readonly id: string;

    public constructor(private readonly config: DiscordConfig) {
        this.id = config.id ? `discord:${config.id}` : "discord";
    }

    public async send(context: NotificationContext): Promise<void> {
        const title = this.config.title
            ? expandNotificationTemplate(this.config.title, context)
            : `🚀 Released ${context.published.length} package${context.published.length === 1 ? "" : "s"}`;

        const embed: Record<string, unknown> = {
            // Discord uses an integer RGB colour. Default to a calm
            // blue-ish that doesn't scream alert.
            color: this.config.color ?? 0x3B_82_F6,
            description: buildDescription(context),
            fields: [] as { inline?: boolean; name: string; value: string }[],
            timestamp: context.completedAt,
            title,
        };

        const fields: { inline?: boolean; name: string; value: string }[] = [];

        if (context.channel) {
            fields.push({ inline: true, name: "Channel", value: `\`${context.channel}\`` });
        }

        if (context.repo) {
            fields.push({ inline: true, name: "Repository", value: `[${context.repo}](https://github.com/${context.repo})` });
        }

        if (context.skipped.length > 0 && this.config.includeSkipped !== false) {
            const skipText = context.skipped
                .map((s) => `\`${s.name}\` — ${s.reason}`)
                .join("\n")
                .slice(0, 1024);

            fields.push({ inline: false, name: `Skipped (${context.skipped.length})`, value: skipText });
        }

        if (fields.length > 0) {
            embed["fields"] = fields;
        }

        const body = {
            ...(this.config.username ? { username: this.config.username } : {}),
            ...(this.config.avatarUrl ? { avatar_url: this.config.avatarUrl } : {}),
            embeds: [embed],
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
            // (which Discord treats as a bearer secret in the path) never
            // surfaces in logs or in `result.failed[].error`.
            const reason = error instanceof Error ? error.name : "NetworkError";

            throw new Error(`Discord webhook fetch failed (${reason})`, { cause: error });
        }

        if (!response.ok) {
            const errorBody = await response.text().catch(() => "");

            throw new Error(`Discord webhook returned ${response.status} ${response.statusText}${errorBody ? `: ${errorBody.slice(0, 200)}` : ""}`);
        }
    }
}
