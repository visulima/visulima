import RequiredOptionError from "../../../errors/required-option-error";
import type { NotificationResult, RecipientResult, Result, SmsPayload } from "../../../types";
import type { ProviderFactory } from "../../provider";
import { defineProvider } from "../../provider";
import { toRecipientList } from "../../utils/credentials";
import { requestWithRetry } from "../../utils/http";
import generateMessageId from "../../utils/id";
import { aggregateSmsResults, sendSequential } from "../../utils/sms";
import type { Bytes } from "../../utils/webcrypto";
import { hmacSha256, sha256, toHex, utf8 } from "../../utils/webcrypto";
import type { SnsConfig } from "./types";

const SERVICE = "sns";
const DEFAULT_REGION = "us-east-1";
const MESSAGE_TAG = /<Message>([\s\S]*?)<\/Message>/;
const MESSAGE_ID_TAG = /<MessageId>([\s\S]*?)<\/MessageId>/;

interface SignedRequest {
    headers: Record<string, string>;
    url: string;
}

/**
 * Formats a `Date` as the two AWS timestamp forms SigV4 needs.
 * @param date The instant to format.
 * @returns The compact `amzDate` (ISO basic) and `dateStamp` (yyyymmdd).
 */
const amzDates = (date: Date): { amzDate: string; dateStamp: string } => {
    const amzDate = date.toISOString().replaceAll(/[:-]|\.\d{3}/g, "");

    return { amzDate, dateStamp: amzDate.slice(0, 8) };
};

/**
 * Derives the SigV4 signing key by chaining HMAC-SHA256 over date, region, service
 * and the `aws4_request` terminator, starting from the secret access key.
 * @param secretKey The AWS secret access key.
 * @param dateStamp The `yyyymmdd` request date.
 * @param region The AWS region.
 * @returns The 32-byte signing key.
 */
const deriveSigningKey = async (secretKey: string, dateStamp: string, region: string): Promise<Bytes> => {
    const kDate = await hmacSha256(utf8(`AWS4${secretKey}`), utf8(dateStamp));
    const kRegion = await hmacSha256(kDate, utf8(region));
    const kService = await hmacSha256(kRegion, utf8(SERVICE));

    return hmacSha256(kService, utf8("aws4_request"));
};

/**
 * Builds a SigV4-signed POST request for the SNS `Publish` action. The body is the
 * form-encoded action parameters; auth lives entirely in headers.
 * @param config The provider credentials and region.
 * @param region The resolved AWS region.
 * @param host The SNS host (without scheme).
 * @param url The absolute endpoint URL.
 * @param body The pre-encoded `application/x-www-form-urlencoded` body.
 * @returns The signed URL and request headers.
 */
const signRequest = async (config: SnsConfig, region: string, host: string, url: string, body: string): Promise<SignedRequest> => {
    const { amzDate, dateStamp } = amzDates(new Date());
    const payloadHash = toHex(await sha256(utf8(body)));

    const headers: Record<string, string> = {
        "Content-Type": "application/x-www-form-urlencoded",
        host,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
    };

    if (config.sessionToken) {
        headers["x-amz-security-token"] = config.sessionToken;
    }

    const lowerHeaders: Record<string, string> = {};

    for (const [name, value] of Object.entries(headers)) {
        lowerHeaders[name.toLowerCase()] = value.trim();
    }

    const signedHeaderNames = Object.keys(lowerHeaders).toSorted((a, b) => a.localeCompare(b));
    const signedHeaders = signedHeaderNames.join(";");
    const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${lowerHeaders[name] ?? ""}\n`).join("");

    const canonicalRequest = ["POST", "/", "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const scope = `${dateStamp}/${region}/${SERVICE}/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, toHex(await sha256(utf8(canonicalRequest)))].join("\n");

    const signingKey = await deriveSigningKey(config.secretAccessKey, dateStamp, region);
    const signature = toHex(await hmacSha256(signingKey, utf8(stringToSign)));

    headers.Authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return { headers, url };
};

/**
 * AWS SNS SMS provider. Edge-safe — signs the `Publish` action with Signature V4
 * computed entirely via Web Crypto (HMAC-SHA256 + SHA-256), no `node:crypto`.
 * @see https://docs.aws.amazon.com/sns/latest/api/API_Publish.html
 */
const snsProvider: ProviderFactory<SnsConfig, SmsPayload> = defineProvider<SnsConfig, SmsPayload>((config?: SnsConfig) => {
    const options = config ?? ({} as SnsConfig);

    if (!options.accessKeyId || !options.secretAccessKey) {
        throw new RequiredOptionError("sns", ["accessKeyId", "secretAccessKey"]);
    }

    const region = options.region ?? DEFAULT_REGION;
    const endpoint = options.endpoint ?? `https://sns.${region}.amazonaws.com/`;
    const { host } = new URL(endpoint);
    const retries = options.retries ?? 3;
    const timeout = options.timeout ?? 30_000;

    const sendOne = async (to: string, payload: SmsPayload): Promise<RecipientResult> => {
        const parameters = new URLSearchParams();

        parameters.set("Action", "Publish");
        parameters.set("Version", "2010-03-31");
        parameters.set("PhoneNumber", to);
        parameters.set("Message", payload.text);

        if (payload.from) {
            parameters.set("MessageAttributes.entry.1.Name", "AWS.SNS.SMS.SenderID");
            parameters.set("MessageAttributes.entry.1.Value.DataType", "String");
            parameters.set("MessageAttributes.entry.1.Value.StringValue", payload.from);
        }

        const body = parameters.toString();
        const signed = await signRequest(options, region, host, endpoint, body);

        const result = await requestWithRetry<string>(signed.url, { body, headers: signed.headers, method: "POST", timeout }, retries);

        if (!result.success || !result.data) {
            return { error: result.error instanceof Error ? result.error.message : "Request failed", id: to, status: "failed" };
        }

        if (result.data.status >= 400) {
            const message = MESSAGE_TAG.exec(result.data.body)?.[1];

            return { error: message ?? `HTTP ${String(result.data.status)}`, id: to, status: "failed" };
        }

        const messageId = MESSAGE_ID_TAG.exec(result.data.body)?.[1];

        return { id: to, messageId: messageId ?? generateMessageId("sns"), status: "sent" };
    };

    return {
        channel: "sms",
        endpoint,
        features: { batchSending: false, deliveryReceipts: false, media: false, scheduling: false },
        id: "sns",
        initialize: () => {},
        isAvailable: () => Boolean(options.accessKeyId && options.secretAccessKey),
        options,
        send: async (payload: SmsPayload): Promise<Result<NotificationResult>> => {
            const results = await sendSequential(toRecipientList(payload.to), async (to) => sendOne(to, payload));

            return aggregateSmsResults("sns", results);
        },
        validateCredentials: () => Boolean(options.accessKeyId && options.secretAccessKey),
    };
});

export default snsProvider;
