import NotificationError from "../../../errors/notification-error";
import RequiredOptionError from "../../../errors/required-option-error";
import type { NotificationResult, RecipientResult, Result, SmsPayload } from "../../../types";
import type { ProviderFactory } from "../../provider";
import { defineProvider } from "../../provider";
import { toRecipientList } from "../../utils/credentials";
import { requestWithRetry } from "../../utils/http";
import { aggregateSmsResults } from "../../utils/sms";
import type { MessageBirdConfig } from "./types";

const DEFAULT_ENDPOINT = "https://rest.messagebird.com";

interface MessageBirdResponse {
    errors?: { description?: string }[];
    id?: string;
}

/**
 * MessageBird (Bird) SMS provider. Sends to many recipients in one call.
 * @see https://docs.bird.com/api/sms-messaging
 */
const messageBirdProvider: ProviderFactory<MessageBirdConfig, SmsPayload> = defineProvider<MessageBirdConfig, SmsPayload>((config?: MessageBirdConfig) => {
    const options = config ?? ({} as MessageBirdConfig);

    if (!options.accessKey) {
        throw new RequiredOptionError("messagebird", "accessKey");
    }

    const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    const retries = options.retries ?? 3;
    const timeout = options.timeout ?? 30_000;
    const url = `${endpoint}/messages`;

    return {
        channel: "sms",
        endpoint,
        features: { batchSending: true, deliveryReceipts: true, media: false },
        id: "messagebird",
        initialize: () => {},
        isAvailable: () => Boolean(options.accessKey),
        options,
        send: async (payload: SmsPayload): Promise<Result<NotificationResult>> => {
            const recipients = toRecipientList(payload.to);
            const from = payload.from ?? options.from;

            if (!from) {
                return {
                    error: new NotificationError("messagebird", "Missing originator: provide `from` on the payload or provider config"),
                    success: false,
                };
            }

            const result = await requestWithRetry<MessageBirdResponse>(
                url,
                {
                    body: JSON.stringify({ body: payload.text, originator: from, recipients }),
                    headers: { Authorization: `AccessKey ${options.accessKey}`, "Content-Type": "application/json" },
                    method: "POST",
                    timeout,
                },
                retries,
            );

            if (!result.success || !result.data) {
                return {
                    error: new NotificationError("messagebird", result.error instanceof Error ? result.error.message : "Request failed"),
                    success: false,
                };
            }

            if (result.data.status >= 400) {
                return {
                    error: new NotificationError("messagebird", result.data.body.errors?.[0]?.description ?? `HTTP ${String(result.data.status)}`),
                    success: false,
                };
            }

            const messageId = result.data.body.id ?? "";
            const recipientResults: RecipientResult[] = recipients.map((to) => {
                return { id: to, messageId, status: "sent" };
            });

            return aggregateSmsResults("messagebird", recipientResults);
        },
        validateCredentials: () => Boolean(options.accessKey),
    };
});

export default messageBirdProvider;
