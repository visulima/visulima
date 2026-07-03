import RequiredOptionError from "../../../errors/required-option-error";
import type { NotificationResult, RecipientResult, Result, SmsPayload } from "../../../types";
import type { ProviderFactory } from "../../provider";
import { defineProvider } from "../../provider";
import { basicAuth, toRecipientList } from "../../utils/credentials";
import { requestWithRetry } from "../../utils/http";
import { aggregateSmsResults, sendSequential } from "../../utils/sms";
import type { TwilioConfig } from "./types";

const DEFAULT_ENDPOINT = "https://api.twilio.com";

/**
 * Twilio SMS/MMS provider. Edge-safe — uses `fetch` + Basic auth, no Node built-ins.
 * @see https://www.twilio.com/docs/sms/api/message-resource
 */
const twilioProvider: ProviderFactory<TwilioConfig, SmsPayload> = defineProvider<TwilioConfig, SmsPayload>((config?: TwilioConfig) => {
    const options = config ?? ({} as TwilioConfig);

    if (!options.accountSid) {
        throw new RequiredOptionError("twilio", "accountSid");
    }

    if (!options.authToken) {
        throw new RequiredOptionError("twilio", "authToken");
    }

    const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    const retries = options.retries ?? 3;
    const timeout = options.timeout ?? 30_000;
    const url = `${endpoint}/2010-04-01/Accounts/${options.accountSid}/Messages.json`;
    const authorization = basicAuth(options.accountSid, options.authToken);

    const sendOne = async (to: string, payload: SmsPayload): Promise<RecipientResult> => {
        const form = new URLSearchParams();

        form.set("To", to);
        form.set("Body", payload.text);

        const from = payload.from ?? options.from;

        if (options.messagingServiceSid) {
            form.set("MessagingServiceSid", options.messagingServiceSid);
        } else if (from) {
            form.set("From", from);
        } else {
            return { error: "Missing sender: provide `from` on the payload or provider config", id: to, status: "failed" };
        }

        for (const media of payload.mediaUrls ?? []) {
            form.append("MediaUrl", media);
        }

        const result = await requestWithRetry<{ error_message?: string; sid?: string }>(
            url,
            {
                body: form.toString(),
                headers: {
                    Authorization: authorization,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                method: "POST",
                timeout,
            },
            retries,
        );

        if (!result.success || !result.data) {
            return { error: result.error instanceof Error ? result.error.message : "Request failed", id: to, status: "failed" };
        }

        if (result.data.status >= 400) {
            return { error: result.data.body.error_message ?? `HTTP ${String(result.data.status)}`, id: to, status: "failed" };
        }

        return { id: to, messageId: result.data.body.sid, status: "sent" };
    };

    return {
        channel: "sms",
        endpoint,
        features: { batchSending: false, deliveryReceipts: true, media: true, scheduling: true },
        id: "twilio",
        initialize: () => {},
        isAvailable: () => Boolean(options.accountSid && options.authToken),
        options,
        send: async (payload: SmsPayload): Promise<Result<NotificationResult>> => {
            const results = await sendSequential(toRecipientList(payload.to), async (to) => sendOne(to, payload));

            return aggregateSmsResults("twilio", results);
        },
        validateCredentials: () => Boolean(options.accountSid && options.authToken),
    };
});

export default twilioProvider;
