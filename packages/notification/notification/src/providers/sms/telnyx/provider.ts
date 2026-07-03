import RequiredOptionError from "../../../errors/required-option-error";
import type { NotificationResult, RecipientResult, Result, SmsPayload } from "../../../types";
import type { ProviderFactory } from "../../provider";
import { defineProvider } from "../../provider";
import { toRecipientList } from "../../utils/credentials";
import { requestWithRetry } from "../../utils/http";
import { aggregateSmsResults, sendSequential } from "../../utils/sms";
import type { TelnyxConfig } from "./types";

const DEFAULT_ENDPOINT = "https://api.telnyx.com";

interface TelnyxResponse {
    data?: { id?: string };
    errors?: { detail?: string }[];
}

/**
 * Telnyx SMS/MMS provider (v2 API). Edge-safe — `fetch` + Bearer auth.
 * @see https://developers.telnyx.com/api/messaging/send-message
 */
const telnyxProvider: ProviderFactory<TelnyxConfig, SmsPayload> = defineProvider<TelnyxConfig, SmsPayload>((config?: TelnyxConfig) => {
    const options = config ?? ({} as TelnyxConfig);

    if (!options.apiKey) {
        throw new RequiredOptionError("telnyx", "apiKey");
    }

    const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    const retries = options.retries ?? 3;
    const timeout = options.timeout ?? 30_000;
    const url = `${endpoint}/v2/messages`;

    const sendOne = async (to: string, payload: SmsPayload): Promise<RecipientResult> => {
        const from = payload.from ?? options.from;

        if (!from && !options.messagingProfileId) {
            return { error: "Missing sender: provide `from`, provider `from`, or `messagingProfileId`", id: to, status: "failed" };
        }

        const body: Record<string, unknown> = { text: payload.text, to };

        if (from) {
            body.from = from;
        }

        if (options.messagingProfileId) {
            body.messaging_profile_id = options.messagingProfileId;
        }

        if (payload.mediaUrls && payload.mediaUrls.length > 0) {
            body.media_urls = payload.mediaUrls;
        }

        const result = await requestWithRetry<TelnyxResponse>(
            url,
            {
                body: JSON.stringify(body),
                headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
                method: "POST",
                timeout,
            },
            retries,
        );

        if (!result.success || !result.data) {
            return { error: result.error instanceof Error ? result.error.message : "Request failed", id: to, status: "failed" };
        }

        if (result.data.status >= 400) {
            return { error: result.data.body.errors?.[0]?.detail ?? `HTTP ${String(result.data.status)}`, id: to, status: "failed" };
        }

        return { id: to, messageId: result.data.body.data?.id, status: "sent" };
    };

    return {
        channel: "sms",
        endpoint,
        features: { batchSending: false, deliveryReceipts: true, media: true, scheduling: true },
        id: "telnyx",
        initialize: () => {},
        isAvailable: () => Boolean(options.apiKey),
        options,
        send: async (payload: SmsPayload): Promise<Result<NotificationResult>> => {
            const results = await sendSequential(toRecipientList(payload.to), async (to) => sendOne(to, payload));

            return aggregateSmsResults("telnyx", results);
        },
        validateCredentials: () => Boolean(options.apiKey),
    };
});

export default telnyxProvider;
