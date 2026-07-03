import NotificationError from "../../../errors/notification-error";
import RequiredOptionError from "../../../errors/required-option-error";
import type { ChatPayload, NotificationResult, Result } from "../../../types";
import type { ProviderFactory } from "../../provider";
import { defineProvider } from "../../provider";
import { requestWithRetry } from "../../utils/http";
import generateMessageId from "../../utils/id";
import type { MsTeamsConfig } from "./types";

/**
 * Microsoft Teams chat provider via Incoming Webhook. When `blocks` is provided it is
 * sent verbatim (e.g. an Adaptive Card / MessageCard), otherwise a plain MessageCard is
 * built from `text`. Edge-safe — `fetch` only.
 * @see https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/connectors-using
 */
const msTeamsProvider: ProviderFactory<MsTeamsConfig, ChatPayload> = defineProvider<MsTeamsConfig, ChatPayload>((config?: MsTeamsConfig) => {
    const options = config ?? ({} as MsTeamsConfig);

    if (!options.webhookUrl) {
        throw new RequiredOptionError("msteams", "webhookUrl");
    }

    const retries = options.retries ?? 3;
    const timeout = options.timeout ?? 30_000;

    return {
        channel: "chat",
        endpoint: options.webhookUrl,
        features: { batchSending: false, richContent: true },
        id: "msteams",
        initialize: () => {},
        isAvailable: () => Boolean(options.webhookUrl),
        options,
        send: async (payload: ChatPayload): Promise<Result<NotificationResult>> => {
            const body = payload.blocks ?? {
                "@context": "https://schema.org/extensions",
                "@type": "MessageCard",
                text: payload.text,
            };

            const result = await requestWithRetry<string>(
                options.webhookUrl,
                {
                    body: JSON.stringify(body),
                    headers: { "Content-Type": "application/json" },
                    method: "POST",
                    timeout,
                },
                retries,
            );

            if (!result.success || !result.data) {
                return { error: new NotificationError("msteams", result.error instanceof Error ? result.error.message : "Request failed"), success: false };
            }

            if (result.data.status >= 400) {
                return { error: new NotificationError("msteams", `HTTP ${String(result.data.status)}: ${result.data.body}`), success: false };
            }

            return {
                data: { channel: "chat", messageId: generateMessageId("msteams"), provider: "msteams", sent: true, timestamp: new Date() },
                success: true,
            };
        },
        validateCredentials: () => Boolean(options.webhookUrl),
    };
});

export default msTeamsProvider;
