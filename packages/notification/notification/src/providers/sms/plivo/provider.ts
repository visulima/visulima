import NotificationError from "../../../errors/notification-error";
import RequiredOptionError from "../../../errors/required-option-error";
import type { NotificationResult, RecipientResult, Result, SmsPayload } from "../../../types";
import type { ProviderFactory } from "../../provider";
import { defineProvider } from "../../provider";
import { basicAuth, toRecipientList } from "../../utils/credentials";
import { requestWithRetry } from "../../utils/http";
import { aggregateSmsResults } from "../../utils/sms";
import type { PlivoConfig } from "./types";

const DEFAULT_ENDPOINT = "https://api.plivo.com";

interface PlivoResponse {
    error?: string;
    message_uuid?: string[];
}

/**
 * Plivo SMS provider. Sends to many recipients in one call (`dst` joined by `&lt;`).
 * @see https://www.plivo.com/docs/sms/api/message
 */
const plivoProvider: ProviderFactory<PlivoConfig, SmsPayload> = defineProvider<PlivoConfig, SmsPayload>((config?: PlivoConfig) => {
    const options = config ?? ({} as PlivoConfig);

    if (!options.authId) {
        throw new RequiredOptionError("plivo", "authId");
    }

    if (!options.authToken) {
        throw new RequiredOptionError("plivo", "authToken");
    }

    const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    const retries = options.retries ?? 3;
    const timeout = options.timeout ?? 30_000;
    const url = `${endpoint}/v1/Account/${options.authId}/Message/`;
    const authorization = basicAuth(options.authId, options.authToken);

    return {
        channel: "sms",
        endpoint,
        features: { batchSending: true, deliveryReceipts: true, media: true },
        id: "plivo",
        initialize: () => {},
        isAvailable: () => Boolean(options.authId && options.authToken),
        options,
        send: async (payload: SmsPayload): Promise<Result<NotificationResult>> => {
            const recipients = toRecipientList(payload.to);
            const from = payload.from ?? options.from;

            if (!from) {
                return { error: new NotificationError("plivo", "Missing sender: provide `from` on the payload or provider config"), success: false };
            }

            const result = await requestWithRetry<PlivoResponse>(
                url,
                {
                    body: JSON.stringify({ dst: recipients.join("<"), src: from, text: payload.text }),
                    headers: { Authorization: authorization, "Content-Type": "application/json" },
                    method: "POST",
                    timeout,
                },
                retries,
            );

            if (!result.success || !result.data) {
                return { error: new NotificationError("plivo", result.error instanceof Error ? result.error.message : "Request failed"), success: false };
            }

            if (result.data.status >= 400) {
                return { error: new NotificationError("plivo", result.data.body.error ?? `HTTP ${String(result.data.status)}`), success: false };
            }

            const { body } = result.data;
            const messageId = body.message_uuid?.[0] ?? "";
            const recipientResults: RecipientResult[] = recipients.map((to, index) => {
                return {
                    id: to,
                    messageId: body.message_uuid?.[index],
                    status: "sent",
                };
            });

            return aggregateSmsResults("plivo", recipientResults.length > 0 ? recipientResults : [{ id: recipients[0] ?? "", messageId, status: "sent" }]);
        },
        validateCredentials: () => Boolean(options.authId && options.authToken),
    };
});

export default plivoProvider;
