import RequiredOptionError from "../../../errors/required-option-error";
import type { NotificationResult, RecipientResult, Result, SmsPayload } from "../../../types";
import type { ProviderFactory } from "../../provider";
import { defineProvider } from "../../provider";
import { toRecipientList } from "../../utils/credentials";
import { requestWithRetry } from "../../utils/http";
import { aggregateSmsResults, sendSequential } from "../../utils/sms";
import type { VonageConfig } from "./types";

const DEFAULT_ENDPOINT = "https://rest.nexmo.com";

interface VonageResponse {
    messages?: { "error-text"?: string; "message-id"?: string; status?: string }[];
}

/**
 * Vonage (Nexmo) SMS provider. Edge-safe — `fetch` + form auth.
 * @see https://developer.vonage.com/en/api/sms
 */
const vonageProvider: ProviderFactory<VonageConfig, SmsPayload> = defineProvider<VonageConfig, SmsPayload>((config?: VonageConfig) => {
    const options = config ?? ({} as VonageConfig);

    if (!options.apiKey) {
        throw new RequiredOptionError("vonage", "apiKey");
    }

    if (!options.apiSecret) {
        throw new RequiredOptionError("vonage", "apiSecret");
    }

    const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    const retries = options.retries ?? 3;
    const timeout = options.timeout ?? 30_000;
    const url = `${endpoint}/sms/json`;

    const sendOne = async (to: string, payload: SmsPayload): Promise<RecipientResult> => {
        const from = payload.from ?? options.from;

        if (!from) {
            return { error: "Missing sender: provide `from` on the payload or provider config", id: to, status: "failed" };
        }

        const form = new URLSearchParams({
            api_key: options.apiKey,
            api_secret: options.apiSecret,
            from,
            text: payload.text,
            to,
        });

        const result = await requestWithRetry<VonageResponse>(
            url,
            {
                body: form.toString(),
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                method: "POST",
                timeout,
            },
            retries,
        );

        if (!result.success || !result.data) {
            return { error: result.error instanceof Error ? result.error.message : "Request failed", id: to, status: "failed" };
        }

        const message = result.data.body.messages?.[0];

        if (message?.status !== "0") {
            return { error: message?.["error-text"] ?? `Vonage status ${message?.status ?? "unknown"}`, id: to, status: "failed" };
        }

        return { id: to, messageId: message["message-id"], status: "sent" };
    };

    return {
        channel: "sms",
        endpoint,
        features: { batchSending: false, deliveryReceipts: true, media: false },
        id: "vonage",
        initialize: () => {},
        isAvailable: () => Boolean(options.apiKey && options.apiSecret),
        options,
        send: async (payload: SmsPayload): Promise<Result<NotificationResult>> => {
            const results = await sendSequential(toRecipientList(payload.to), async (to) => sendOne(to, payload));

            return aggregateSmsResults("vonage", results);
        },
        validateCredentials: () => Boolean(options.apiKey && options.apiSecret),
    };
});

export default vonageProvider;
