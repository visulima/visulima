import NotificationError from "../../../errors/notification-error";
import RequiredOptionError from "../../../errors/required-option-error";
import type { ChatPayload, NotificationResult, Result } from "../../../types";
import type { ProviderFactory } from "../../provider";
import { defineProvider } from "../../provider";
import { requestWithRetry } from "../../utils/http";
import generateMessageId from "../../utils/id";
import type { DiscordConfig } from "./types";

interface DiscordResponse {
    id?: string;
    message?: string;
}

/**
 * Discord chat provider via Incoming Webhooks. Edge-safe — `fetch` only.
 * @see https://discord.com/developers/docs/resources/webhook#execute-webhook
 */
const discordProvider: ProviderFactory<DiscordConfig, ChatPayload> = defineProvider<DiscordConfig, ChatPayload>((config?: DiscordConfig) => {
    const options = config ?? ({} as DiscordConfig);

    if (!options.webhookUrl) {
        throw new RequiredOptionError("discord", "webhookUrl");
    }

    const retries = options.retries ?? 3;
    const timeout = options.timeout ?? 30_000;
    // `?wait=true` makes Discord return the created message (with its id).
    const url = options.webhookUrl.includes("?") ? `${options.webhookUrl}&wait=true` : `${options.webhookUrl}?wait=true`;

    return {
        channel: "chat",
        endpoint: options.webhookUrl,
        features: { batchSending: false, richContent: true },
        id: "discord",
        initialize: () => {},
        isAvailable: () => Boolean(options.webhookUrl),
        options,
        send: async (payload: ChatPayload): Promise<Result<NotificationResult>> => {
            const body: Record<string, unknown> = { content: payload.text, embeds: payload.blocks, username: options.username };

            if (payload.threadId) {
                body.thread_id = payload.threadId;
            }

            const result = await requestWithRetry<DiscordResponse>(
                url,
                { body: JSON.stringify(body), headers: { "Content-Type": "application/json" }, method: "POST", timeout },
                retries,
            );

            if (!result.success || !result.data) {
                return { error: new NotificationError("discord", result.error instanceof Error ? result.error.message : "Request failed"), success: false };
            }

            if (result.data.status >= 400) {
                return { error: new NotificationError("discord", result.data.body.message ?? `HTTP ${String(result.data.status)}`), success: false };
            }

            return {
                data: {
                    channel: "chat",
                    messageId: result.data.body.id ?? generateMessageId("discord"),
                    provider: "discord",
                    sent: true,
                    timestamp: new Date(),
                },
                success: true,
            };
        },
        validateCredentials: () => Boolean(options.webhookUrl),
    };
});

export default discordProvider;
