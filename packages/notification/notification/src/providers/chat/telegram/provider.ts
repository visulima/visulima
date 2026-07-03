import NotificationError from "../../../errors/notification-error";
import RequiredOptionError from "../../../errors/required-option-error";
import type { ChatPayload, NotificationResult, Result } from "../../../types";
import type { ProviderFactory } from "../../provider";
import { defineProvider } from "../../provider";
import { requestWithRetry } from "../../utils/http";
import type { TelegramConfig } from "./types";

const DEFAULT_ENDPOINT = "https://api.telegram.org";

interface TelegramResponse {
    description?: string;
    ok?: boolean;
    result?: { message_id?: number };
}

/**
 * Telegram chat provider via the Bot API. Edge-safe — `fetch` only.
 * @see https://core.telegram.org/bots/api#sendmessage
 */
const telegramProvider: ProviderFactory<TelegramConfig, ChatPayload> = defineProvider<TelegramConfig, ChatPayload>((config?: TelegramConfig) => {
    const options = config ?? ({} as TelegramConfig);

    if (!options.botToken) {
        throw new RequiredOptionError("telegram", "botToken");
    }

    const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    const retries = options.retries ?? 3;
    const timeout = options.timeout ?? 30_000;
    const url = `${endpoint}/bot${options.botToken}/sendMessage`;

    return {
        channel: "chat",
        endpoint,
        features: { batchSending: false, richContent: true },
        id: "telegram",
        initialize: () => {},
        isAvailable: () => Boolean(options.botToken),
        options,
        send: async (payload: ChatPayload): Promise<Result<NotificationResult>> => {
            const chatId = payload.to ?? options.defaultChatId;

            if (chatId === undefined) {
                return { error: new NotificationError("telegram", "Missing chat id: provide `to` or `defaultChatId`"), success: false };
            }

            const body: Record<string, unknown> = { chat_id: chatId, text: payload.text };

            if (options.parseMode) {
                body.parse_mode = options.parseMode;
            }

            const result = await requestWithRetry<TelegramResponse>(
                url,
                {
                    body: JSON.stringify(body),
                    headers: { "Content-Type": "application/json" },
                    method: "POST",
                    timeout,
                },
                retries,
            );

            if (!result.success || !result.data) {
                return { error: new NotificationError("telegram", result.error instanceof Error ? result.error.message : "Request failed"), success: false };
            }

            if (!result.data.body.ok) {
                return { error: new NotificationError("telegram", result.data.body.description ?? `HTTP ${String(result.data.status)}`), success: false };
            }

            return {
                data: {
                    channel: "chat",
                    messageId: String(result.data.body.result?.message_id ?? ""),
                    provider: "telegram",
                    response: result.data.body,
                    sent: true,
                    timestamp: new Date(),
                },
                success: true,
            };
        },
        validateCredentials: () => Boolean(options.botToken),
    };
});

export default telegramProvider;
