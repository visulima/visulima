import type { Bytes } from "../providers/utils/webcrypto";
import { fromBase64Url, subtle, utf8 } from "../providers/utils/webcrypto";
import type { NotificationEvent } from "../types";
import type { WebhookVerifier } from "./types";
import { tryParseObject } from "./types";
import { pemCertificateToSpki } from "./x509";

/**
 * SNS message envelope (the relevant subset). SNS delivers every field as a string.
 */
interface SnsMessage {
    [key: string]: unknown;
    Message?: string;
    MessageId?: string;
    Signature?: string;
    SignatureVersion?: string;
    SigningCertURL?: string;
    SubscribeURL?: string;
    Timestamp?: string;
    TopicArn?: string;
    Type?: string;
}

/**
 * Host allow-list for the `SigningCertURL`: an `sns.REGION.amazonaws.com` host (optionally the
 * China partition). Matches the AWS SDK's validation, preventing an attacker from pointing the
 * verifier at a certificate they control.
 */
const CERT_HOST = /^sns\.[a-z0-9-]{3,}\.amazonaws\.com(?:\.cn)?$/iu;

/**
 * Fields signed for a `Notification`, in canonical order.
 */
const SIGNABLE_NOTIFICATION = ["Message", "MessageId", "Subject", "SubscribeURL", "Timestamp", "TopicArn", "Type"] as const;

/**
 * Fields signed for a `SubscriptionConfirmation` / `UnsubscribeConfirmation`, in canonical order.
 */
const SIGNABLE_SUBSCRIPTION = ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"] as const;

/**
 * Per-URL cache of extracted signing public keys, so repeated deliveries from the same topic do
 * not re-fetch and re-parse the certificate.
 *
 * Bounded: {@link isValidCertUrl} pins the host, but the path is whatever the caller sent, so an
 * unbounded map would grow one entry per distinct `.pem` path a forged delivery names. Real
 * deployments see a handful of signing certificates.
 */
const spkiCache = new Map<string, Bytes>();

/** Maximum number of cached signing keys before the oldest is evicted. */
const SPKI_CACHE_LIMIT = 64;

/** How long the certificate fetch may block the webhook request path. */
const CERT_FETCH_TIMEOUT_MS = 5000;

/**
 * How stale a `Timestamp` may be before the message is rejected.
 *
 * Deliberately far wider than the shared five-minute window the Slack and Telnyx verifiers use:
 * an SNS `Timestamp` records when the message was *published* and does not change across
 * redeliveries, so a tight window would drop legitimate retries. An hour still ends the
 * indefinite replay that an unchecked timestamp allows — the signature itself stays valid for
 * the lifetime of the signing certificate.
 */
const MAX_TIMESTAMP_AGE_MS = 60 * 60 * 1000;

/**
 * Safely parses an SNS message envelope.
 * @param body The request body.
 * @returns The parsed envelope, or `undefined`.
 */
const parseEnvelope = (body: string): SnsMessage | undefined => tryParseObject(body);

/**
 * Reads the `SigningCertURL` field, tolerating the legacy `SigningCertUrl` spelling.
 * @param message The SNS envelope.
 * @returns The certificate URL, or `undefined`.
 */
const certUrlOf = (message: SnsMessage): string | undefined => {
    const url = message.SigningCertURL ?? message.SigningCertUrl;

    return typeof url === "string" ? url : undefined;
};

/**
 * Validates that a `SigningCertURL` is an HTTPS `.pem` on an AWS SNS host.
 * @param url The certificate URL.
 * @returns `true` when the URL is a trusted SNS certificate location.
 */
const isValidCertUrl = (url: string): boolean => {
    try {
        const parsed = new URL(url);

        return parsed.protocol === "https:" && parsed.pathname.endsWith(".pem") && CERT_HOST.test(parsed.hostname);
    } catch {
        return false;
    }
};

/**
 * Builds the canonical string-to-sign: each present signable key as `key\nvalue\n`, in order.
 * @param message The SNS envelope.
 * @param keys The ordered signable keys for the message type.
 * @returns The string AWS signed.
 */
const buildStringToSign = (message: SnsMessage, keys: ReadonlyArray<string>): string => {
    let result = "";

    for (const key of keys) {
        const value = message[key];

        if (typeof value === "string") {
            result += `${key}\n${value}\n`;
        }
    }

    return result;
};

/**
 * Fetches and caches the signing certificate's public key (SPKI).
 * @param url The validated `SigningCertURL`.
 * @returns The SPKI bytes, or `undefined` when the certificate cannot be fetched or parsed.
 */
const loadSpki = async (url: string): Promise<Bytes | undefined> => {
    const cached = spkiCache.get(url);

    if (cached !== undefined) {
        return cached;
    }

    // This runs on the webhook request path; without a timeout an unreachable certificate host
    // holds the handler open until the platform's own (much longer) default fires.
    const response = await globalThis.fetch(url, { signal: AbortSignal.timeout(CERT_FETCH_TIMEOUT_MS) });

    if (!response.ok) {
        return undefined;
    }

    const spki = pemCertificateToSpki(await response.text());

    if (spki !== undefined) {
        if (spkiCache.size >= SPKI_CACHE_LIMIT) {
            // A Map iterates in insertion order, so the first key is the oldest entry.
            const oldest = spkiCache.keys().next().value;

            if (oldest !== undefined) {
                spkiCache.delete(oldest);
            }
        }

        spkiCache.set(url, spki);
    }

    return spki;
};

/**
 * Verifies an AWS SNS message signature (SignatureVersion 1 = RSA-SHA1, 2 = RSA-SHA256) against
 * the certificate at its `SigningCertURL`. Validates the certificate host, rebuilds the
 * canonical string-to-sign, fetches (and caches) the signing certificate, and checks the RSA
 * signature with Web Crypto. Returns `false` on any malformed input, disallowed host, stale
 * `Timestamp`, fetch failure or signature mismatch. Edge-safe — `fetch` + Web Crypto only.
 * @param message The parsed SNS envelope.
 * @returns `true` when the signature is valid.
 */
export const verifySnsMessage = async (message: SnsMessage): Promise<boolean> => {
    const url = certUrlOf(message);
    const version = message.SignatureVersion;

    if (url === undefined || typeof message.Signature !== "string" || typeof message.Type !== "string" || (version !== "1" && version !== "2")) {
        return false;
    }

    if (!isValidCertUrl(url)) {
        return false;
    }

    // `Timestamp` is one of the signed fields, so an attacker cannot move it. Without this check a
    // captured delivery replays successfully for as long as the signing certificate lives.
    const timestampMs = Date.parse(message.Timestamp ?? "");

    if (Number.isNaN(timestampMs) || Math.abs(Date.now() - timestampMs) > MAX_TIMESTAMP_AGE_MS) {
        return false;
    }

    const keys = message.Type === "Notification" ? SIGNABLE_NOTIFICATION : SIGNABLE_SUBSCRIPTION;
    const stringToSign = buildStringToSign(message, keys);

    try {
        const spki = await loadSpki(url);

        if (spki === undefined) {
            return false;
        }

        const key = await subtle().importKey("spki", spki, { hash: version === "1" ? "SHA-1" : "SHA-256", name: "RSASSA-PKCS1-v1_5" }, false, ["verify"]);

        return await subtle().verify("RSASSA-PKCS1-v1_5", key, fromBase64Url(message.Signature), utf8(stringToSign));
    } catch {
        return false;
    }
};

/**
 * Verifier + parser for AWS SNS HTTP/S subscription deliveries.
 *
 * `verify` implements SNS SignatureVersion 1 (RSA-SHA1) and 2 (RSA-SHA256): it validates the
 * `SigningCertURL` host, rebuilds the canonical string-to-sign, fetches and caches the signing
 * certificate, extracts its RSA public key and checks the signature — all with `fetch` + Web
 * Crypto, so it runs on edge runtimes. `headers` and `secret` are unused (SNS is asymmetric).
 * Callers handling `SubscriptionConfirmation` should confirm by requesting the `SubscribeURL`
 * from the parsed metadata.
 */
export const snsWebhook: WebhookVerifier = {
    parse: (body: string): NotificationEvent | undefined => {
        const envelope = parseEnvelope(body);

        if (envelope?.Type === undefined) {
            return undefined;
        }

        const metadata: Record<string, unknown> = { type: envelope.Type };

        if (envelope.Type === "SubscriptionConfirmation" || envelope.Type === "UnsubscribeConfirmation") {
            metadata.subscribeUrl = envelope.SubscribeURL;
        } else if (envelope.Message !== undefined) {
            metadata.message = envelope.Message;
        }

        return {
            messageId: envelope.MessageId ?? "",
            metadata,
            provider: "sns",
            timestamp: envelope.Timestamp === undefined ? new Date() : new Date(envelope.Timestamp),
            type: "delivered",
        };
    },
    verify: async (payload: string): Promise<boolean> => {
        const message = parseEnvelope(payload);

        if (message === undefined) {
            return false;
        }

        return verifySnsMessage(message);
    },
};
