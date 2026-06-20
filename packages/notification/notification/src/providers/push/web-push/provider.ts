import NotificationError from "../../../errors/notification-error";
import RequiredOptionError from "../../../errors/required-option-error";
import type { NotificationResult, PushPayload, RecipientResult, Result } from "../../../types";
import type { ProviderFactory } from "../../provider";
import { defineProvider } from "../../provider";
import { toRecipientList } from "../../utils/credentials";
import { makeRequest } from "../../utils/http";
import generateMessageId from "../../utils/id";
import type { Bytes } from "../../utils/webcrypto";
import { concatBytes, fromBase64Url, hkdfSha256, randomBytes, toBase64Url, uintToBytes, utf8 } from "../../utils/webcrypto";
import type { PushSubscriptionLike, WebPushConfig } from "./types";

const DEFAULT_TTL = 2_419_200;

// eslint-disable-next-line n/no-unsupported-features/node-builtins
const subtle = (): SubtleCrypto => globalThis.crypto.subtle;

/**
 * Parses the `to` target into a structured push subscription, accepting either an
 * already-parsed object or its JSON string form.
 * @param to The payload recipient (JSON string or subscription object).
 * @returns The parsed subscription, or `undefined` when it is malformed.
 */
const parseSubscription = (to: string): PushSubscriptionLike | undefined => {
    let candidate: unknown = to;

    if (typeof to === "string") {
        try {
            candidate = JSON.parse(to);
        } catch {
            return undefined;
        }
    }

    const subscription = candidate as { endpoint?: unknown; keys?: { auth?: unknown; p256dh?: unknown } } | null;

    if (
        !subscription
        || typeof subscription.endpoint !== "string"
        || typeof subscription.keys?.p256dh !== "string"
        || typeof subscription.keys.auth !== "string"
    ) {
        return undefined;
    }

    return subscription as PushSubscriptionLike;
};

/**
 * Imports a raw P-256 private scalar as an ECDSA signing key by reconstructing the
 * matching JWK from the VAPID public point.
 * @param privateKey The base64url raw private scalar `d`.
 * @param publicKey The base64url uncompressed public point (`0x04 || x || y`).
 * @returns A non-extractable ECDSA P-256 `CryptoKey` usable for signing.
 */
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const importVapidSigningKey = async (privateKey: string, publicKey: string): Promise<CryptoKey> => {
    const point = fromBase64Url(publicKey);
    const x = toBase64Url(point.slice(1, 33));
    const y = toBase64Url(point.slice(33, 65));

    return subtle().importKey(
        "jwk",
        { crv: "P-256", d: privateKey, ext: true, key_ops: ["sign"], kty: "EC", x, y },
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"],
    );
};

/**
 * Builds a signed VAPID JWT (ES256) authorising delivery to a push origin.
 * @param origin The push service origin (`https://host`) used as the `aud` claim.
 * @param subject The `sub` contact claim (`mailto:`/`https:`).
 * @param signingKey The imported ECDSA signing key.
 * @returns The compact-serialised JWT.
 */
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const createVapidJwt = async (origin: string, subject: string, signingKey: CryptoKey): Promise<string> => {
    const header = toBase64Url(utf8(JSON.stringify({ alg: "ES256", typ: "JWT" })));
    const claims = toBase64Url(utf8(JSON.stringify({ aud: origin, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: subject })));
    const signingInput = `${header}.${claims}`;

    const signature = await subtle().sign({ hash: "SHA-256", name: "ECDSA" }, signingKey, utf8(signingInput));

    return `${signingInput}.${toBase64Url(new Uint8Array(signature))}`;
};

/**
 * Encrypts a web-push payload per RFC 8291 (`aes128gcm`). Performs the ECDH against
 * the subscriber's public key, derives the content key + nonce via HKDF-SHA256, and
 * prepends the binary content-coding header (salt, record size, ephemeral key id).
 * @param subscription The target subscription (client public key + auth secret).
 * @param plaintext The serialised message body.
 * @returns The full `aes128gcm` content-encoded body.
 */
const encryptPayload = async (subscription: PushSubscriptionLike, plaintext: Bytes): Promise<Bytes> => {
    const clientPublic = fromBase64Url(subscription.keys.p256dh);
    const authSecret = fromBase64Url(subscription.keys.auth);
    const salt = randomBytes(16);

    const localKeyPair = await subtle().generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const localPublicRaw = new Uint8Array(await subtle().exportKey("raw", localKeyPair.publicKey));

    const clientKey = await subtle().importKey("raw", clientPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const sharedSecret = new Uint8Array(await subtle().deriveBits({ name: "ECDH", public: clientKey }, localKeyPair.privateKey, 256));

    // RFC 8291 §3.4: PRK_key = HKDF(auth, ecdh_secret, "WebPush: info" || ua_public || as_public, 32)
    const keyInfo = concatBytes(utf8("WebPush: info\0"), clientPublic, localPublicRaw);
    const ikm = await hkdfSha256(authSecret, sharedSecret, keyInfo, 32);

    const contentEncryptionKey = await hkdfSha256(salt, ikm, utf8("Content-Encoding: aes128gcm\0"), 16);
    const nonce = await hkdfSha256(salt, ikm, utf8("Content-Encoding: nonce\0"), 12);

    const aesKey = await subtle().importKey("raw", contentEncryptionKey, { name: "AES-GCM" }, false, ["encrypt"]);
    // The padding delimiter `0x02` marks the last (and only) record.
    const padded = concatBytes(plaintext, new Uint8Array([0x02]));
    const ciphertext = new Uint8Array(await subtle().encrypt({ iv: nonce, name: "AES-GCM" }, aesKey, padded));

    // aes128gcm header: salt(16) || record_size(4, BE) || idlen(1) || keyid(localPublicRaw)
    const header = concatBytes(salt, uintToBytes(4096, 4), new Uint8Array([localPublicRaw.length]), localPublicRaw);

    return concatBytes(header, ciphertext);
};

/**
 * Web Push provider (VAPID + RFC 8291 `aes128gcm`). Fully edge-safe — JWT signing and
 * payload encryption run on Web Crypto (ECDSA/ECDH P-256, HKDF, AES-GCM); no `node:*`.
 * The `to` target carries a Push API subscription (object or its JSON string form).
 * @see https://datatracker.ietf.org/doc/html/rfc8291
 * @see https://datatracker.ietf.org/doc/html/rfc8292
 */
const webPushProvider: ProviderFactory<WebPushConfig, PushPayload> = defineProvider<WebPushConfig, PushPayload>((config?: WebPushConfig) => {
    const options = config ?? ({} as WebPushConfig);

    if (!options.vapidPublicKey || !options.vapidPrivateKey || !options.vapidSubject) {
        throw new RequiredOptionError("web-push", ["vapidPublicKey", "vapidPrivateKey", "vapidSubject"]);
    }

    const ttl = options.ttl ?? DEFAULT_TTL;
    const urgency = options.urgency ?? "normal";
    const timeout = options.timeout ?? 30_000;

    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    const sendOne = async (to: string, payload: PushPayload, signingKey: CryptoKey): Promise<RecipientResult> => {
        const subscription = parseSubscription(to);

        if (!subscription) {
            return { error: "Invalid push subscription (expected { endpoint, keys: { p256dh, auth } })", id: to, status: "failed" };
        }

        const { origin } = new URL(subscription.endpoint);
        const jwt = await createVapidJwt(origin, options.vapidSubject, signingKey);

        const message = JSON.stringify({ badge: payload.badge, body: payload.body, data: payload.data, image: payload.imageUrl, title: payload.title });
        const encrypted = await encryptPayload(subscription, utf8(message));

        const headers: Record<string, string> = {
            Authorization: `vapid t=${jwt},k=${options.vapidPublicKey}`,
            "Content-Encoding": "aes128gcm",
            "Content-Type": "application/octet-stream",
            TTL: String(ttl),
            Urgency: urgency,
        };

        const result = await makeRequest<string>(subscription.endpoint, { body: encrypted, headers, method: "POST", timeout });

        if (!result.success || !result.data) {
            return { error: result.error instanceof Error ? result.error.message : "Request failed", id: to, status: "failed" };
        }

        const { status } = result.data;

        if (status === 404 || status === 410) {
            return { error: `Subscription gone (HTTP ${String(status)}) — remove this subscription`, id: to, status: "failed" };
        }

        if (status >= 400) {
            return { error: `HTTP ${String(status)}: ${typeof result.data.body === "string" ? result.data.body : ""}`.trim(), id: to, status: "failed" };
        }

        return { id: to, messageId: generateMessageId("web-push"), status: "sent" };
    };

    return {
        channel: "push",
        features: { batchSending: false, media: false, richContent: true },
        id: "web-push",
        initialize: () => {},
        isAvailable: () => Boolean(options.vapidPublicKey && options.vapidPrivateKey && options.vapidSubject),
        options,
        send: async (payload: PushPayload): Promise<Result<NotificationResult>> => {
            const recipients = toRecipientList(payload.to);
            const signingKey = await importVapidSigningKey(options.vapidPrivateKey, options.vapidPublicKey);

            const recipientResults: RecipientResult[] = [];

            for (const to of recipients) {
                // eslint-disable-next-line no-await-in-loop
                recipientResults.push(await sendOne(to, payload, signingKey));
            }

            const sent = recipientResults.filter((result) => result.status === "sent");

            if (sent.length === 0) {
                return { error: new NotificationError("web-push", recipientResults[0]?.error ?? "All subscriptions failed"), success: false };
            }

            return {
                data: {
                    channel: "push",
                    messageId: sent[0]?.messageId ?? generateMessageId("web-push"),
                    provider: "web-push",
                    recipients: recipientResults,
                    sent: true,
                    timestamp: new Date(),
                },
                success: true,
            };
        },
        validateCredentials: () => Boolean(options.vapidPublicKey && options.vapidPrivateKey && options.vapidSubject),
    };
});

export default webPushProvider;
