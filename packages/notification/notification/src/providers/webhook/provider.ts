import NotificationError from "../../errors/notification-error";
import RequiredOptionError from "../../errors/required-option-error";
import type { BaseConfig, NotificationResult, Result, WebhookPayload } from "../../types";
import type { Provider } from "../provider";
import { requestWithRetry } from "../utils/http";
import generateMessageId from "../utils/id";

export interface WebhookConfig extends BaseConfig {
    /** Default headers merged into every request. */
    headers?: Record<string, string>;
    /** Default HTTP method (default POST). */
    method?: string;
    /** Default target URL (overridable per payload). */
    url?: string;
}

/**
 * Generic outbound webhook provider. Edge-safe — `fetch` only. Useful for custom
 * integrations and as a fan-out sink.
 * @param config Optional config.
 * @returns A webhook-channel provider.
 */
export const webhookProvider = (config: WebhookConfig = {}): Provider<WebhookConfig, WebhookPayload> => {
    const retries = config.retries ?? 3;
    const timeout = config.timeout ?? 30_000;

    return {
        channel: "webhook",
        endpoint: config.url,
        features: {},
        id: "webhook",
        initialize: () => {},
        isAvailable: () => true,
        send: async (payload: WebhookPayload): Promise<Result<NotificationResult>> => {
            const url = payload.url ?? config.url;

            if (!url) {
                throw new RequiredOptionError("webhook", "url");
            }

            const result = await requestWithRetry(
                url,
                {
                    body: typeof payload.body === "string" ? payload.body : JSON.stringify(payload.body),
                    headers: { "Content-Type": "application/json", ...config.headers, ...payload.headers },
                    method: payload.method ?? config.method ?? "POST",
                    timeout,
                },
                retries,
            );

            if (!result.success || !result.data) {
                return { error: new NotificationError("webhook", result.error instanceof Error ? result.error.message : "Request failed"), success: false };
            }

            if (result.data.status >= 400) {
                return { error: new NotificationError("webhook", `HTTP ${String(result.data.status)}`), success: false };
            }

            return {
                data: {
                    channel: "webhook",
                    messageId: generateMessageId("webhook"),
                    provider: "webhook",
                    response: result.data.body,
                    sent: true,
                    timestamp: new Date(),
                },
                success: true,
            };
        },
    };
};
