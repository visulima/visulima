import NotificationError from "../../../errors/notification-error";
import type { ChatPayload, NotificationResult, Result } from "../../../types";
import type { ProviderFactory } from "../../provider";
import { defineProvider } from "../../provider";
import { requestWithRetry } from "../../utils/http";
import generateMessageId from "../../utils/id";
import type { SlackConfig } from "./types";

const DEFAULT_ENDPOINT = "https://slack.com/api";

interface SlackResponse {
    error?: string;
    ok?: boolean;
    ts?: string;
}

/**
 * Slack chat provider. Supports both Incoming Webhooks (`webhookUrl`) and the Web API
 * (`token` + channel). Edge-safe — `fetch` only.
 * @see https://api.slack.com/methods/chat.postMessage
 */
const slackProvider: ProviderFactory<SlackConfig, ChatPayload> = defineProvider<SlackConfig, ChatPayload>((config?: SlackConfig) => {
    const options = config ?? {};

    if (!options.token && !options.webhookUrl) {
        throw new NotificationError("slack", "Provide either `token` (Web API) or `webhookUrl`", {
            hint: "Set one of token/webhookUrl in the provider config",
        });
    }

    const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    const retries = options.retries ?? 3;
    const timeout = options.timeout ?? 30_000;

    return {
        channel: "chat",
        endpoint,
        features: { batchSending: false, richContent: true },
        id: "slack",
        initialize: () => {},
        isAvailable: () => Boolean(options.token ?? options.webhookUrl),
        options,
        send: async (payload: ChatPayload): Promise<Result<NotificationResult>> => {
            const useWebhook = Boolean(options.webhookUrl);
            const url = useWebhook ? (options.webhookUrl as string) : `${endpoint}/chat.postMessage`;
            const channel = payload.to ?? options.defaultChannel;

            if (!useWebhook && !channel) {
                return { error: new NotificationError("slack", "Missing channel: provide `to` or `defaultChannel`"), success: false };
            }

            const body: Record<string, unknown> = { blocks: payload.blocks, text: payload.text, thread_ts: payload.threadId };

            if (!useWebhook) {
                body.channel = channel;
            }

            const headers: Record<string, string> = { "Content-Type": "application/json" };

            if (!useWebhook) {
                headers.Authorization = `Bearer ${options.token ?? ""}`;
            }

            const result = await requestWithRetry<SlackResponse | string>(url, { body: JSON.stringify(body), headers, method: "POST", timeout }, retries);

            if (!result.success || !result.data) {
                return { error: new NotificationError("slack", result.error instanceof Error ? result.error.message : "Request failed"), success: false };
            }

            // Incoming webhooks return the plain text "ok"; the Web API returns JSON.
            if (useWebhook) {
                if (result.data.status >= 400 || result.data.body !== "ok") {
                    const detail = typeof result.data.body === "string" ? result.data.body : JSON.stringify(result.data.body);

                    return { error: new NotificationError("slack", `Webhook failed: ${detail}`), success: false };
                }

                return {
                    data: { channel: "chat", messageId: generateMessageId("slack"), provider: "slack", sent: true, timestamp: new Date() },
                    success: true,
                };
            }

            const apiBody = result.data.body as SlackResponse;

            if (!apiBody.ok) {
                return { error: new NotificationError("slack", apiBody.error ?? "Slack API error"), success: false };
            }

            return {
                data: {
                    channel: "chat",
                    messageId: apiBody.ts ?? generateMessageId("slack"),
                    provider: "slack",
                    response: apiBody,
                    sent: true,
                    timestamp: new Date(),
                },
                success: true,
            };
        },
        validateCredentials: () => Boolean(options.token ?? options.webhookUrl),
    };
});

export default slackProvider;
