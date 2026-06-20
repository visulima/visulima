import type { KeyObject } from "node:crypto";
import { createPrivateKey, sign } from "node:crypto";
import type { ClientHttp2Session } from "node:http2";
import { connect } from "node:http2";

import RequiredOptionError from "../../../errors/required-option-error";
import type { NotificationResult, PushPayload, RecipientResult, Result } from "../../../types";
import type { ProviderFactory } from "../../provider";
import { defineProvider } from "../../provider";
import { toRecipientList } from "../../utils/credentials";
import { aggregateRecipientResults } from "../../utils/sms";
import type { ApnsConfig } from "./types";

const PRODUCTION_HOST = "https://api.push.apple.com";
const SANDBOX_HOST = "https://api.sandbox.push.apple.com";
/** Apple recommends reusing a provider token for up to ~60 min; refresh a little early. */
const TOKEN_TTL_MS = 50 * 60 * 1000;
const HTTP2_OK = 200;

/**
 * Encodes a UTF-8 string as base64url without padding for a JWT segment.
 * @param value The string to encode.
 * @returns The base64url-encoded value.
 */
const base64Url = (value: string): string => Buffer.from(value, "utf8").toString("base64url");

interface ApnsErrorBody {
    reason?: string;
}

/**
 * Builds an ES256 provider authentication token for APNs.
 * @param config The provider configuration carrying the team id, key id and signing key.
 * @param key The parsed private {@link KeyObject} for the signing key.
 * @param issuedAt The token issue time in seconds since the epoch.
 * @returns The signed JWT string.
 */
const buildToken = (config: ApnsConfig, key: KeyObject, issuedAt: number): string => {
    const header = base64Url(JSON.stringify({ alg: "ES256", kid: config.keyId, typ: "JWT" }));
    const claims = base64Url(JSON.stringify({ iat: issuedAt, iss: config.teamId }));
    const signingInput = `${header}.${claims}`;
    const signature = sign("sha256", Buffer.from(signingInput, "utf8"), { dsaEncoding: "ieee-p1363", key }).toString("base64url");

    return `${signingInput}.${signature}`;
};

/**
 * Apple Push Notification service (APNs) provider.
 *
 * NODE-ONLY: APNs mandates HTTP/2 with token-based (JWT/ES256) auth, so this provider uses
 * `node:http2` and `node:crypto`. It is NOT edge/Cloudflare-Workers-safe and will not run on
 * Web-only runtimes that lack `node:http2`.
 * @see https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns
 */
const apnsProvider: ProviderFactory<ApnsConfig, PushPayload> = defineProvider<ApnsConfig, PushPayload>((config?: ApnsConfig) => {
    const options = config ?? ({} as ApnsConfig);

    if (!options.teamId) {
        throw new RequiredOptionError("apns", "teamId");
    }

    if (!options.keyId) {
        throw new RequiredOptionError("apns", "keyId");
    }

    if (!options.signingKey) {
        throw new RequiredOptionError("apns", "signingKey");
    }

    if (!options.bundleId) {
        throw new RequiredOptionError("apns", "bundleId");
    }

    const host = options.production ? PRODUCTION_HOST : SANDBOX_HOST;

    let signingKey: KeyObject | undefined;
    let cachedToken: string | undefined;
    let cachedTokenAt = 0;
    let session: ClientHttp2Session | undefined;

    /**
     * Returns the parsed signing key, parsing the PEM on first use.
     * @returns The private key object.
     */
    const getSigningKey = (): KeyObject => {
        signingKey ??= createPrivateKey({ format: "pem", key: options.signingKey });

        return signingKey;
    };

    /** Returns a cached provider token, refreshing it when it nears expiry. */
    const getToken = (): string => {
        const now = Date.now();

        if (!cachedToken || now - cachedTokenAt > TOKEN_TTL_MS) {
            cachedToken = buildToken(options, getSigningKey(), Math.floor(now / 1000));
            cachedTokenAt = now;
        }

        return cachedToken;
    };

    /** Returns the shared HTTP/2 session, opening one when needed. */
    const getSession = (): ClientHttp2Session => {
        if (!session || session.closed || session.destroyed) {
            session = connect(host);
            session.on("error", (error: Error) => {
                options.logger?.warn(`[@visulima/notification] [apns] HTTP/2 session error: ${error.message}`);
            });
        }

        return session;
    };

    /**
     * Sends the payload to a single device token over the shared HTTP/2 session.
     * @param token The device token.
     * @param body The serialised APNs payload.
     * @returns The per-recipient delivery result.
     */
    const sendOne = async (token: string, body: string): Promise<RecipientResult> =>
        new Promise<RecipientResult>((resolve) => {
            const stream = getSession().request({
                ":method": "POST",
                ":path": `/3/device/${token}`,
                "apns-topic": options.bundleId,
                authorization: `bearer ${getToken()}`,
                "content-type": "application/json",
            });

            let status = 0;
            let responseBody = "";

            stream.setEncoding("utf8");

            stream.on("response", (headers) => {
                status = headers[":status"] ?? 0;
            });

            stream.on("data", (chunk: string) => {
                responseBody += chunk;
            });

            stream.on("error", (error: Error) => {
                resolve({ error: error.message, id: token, status: "failed" });
            });

            stream.on("end", () => {
                if (status === HTTP2_OK) {
                    resolve({ id: token, messageId: token, status: "sent" });

                    return;
                }

                let reason = `HTTP ${String(status)}`;

                if (responseBody) {
                    try {
                        const parsed = JSON.parse(responseBody) as ApnsErrorBody;

                        reason = parsed.reason ?? reason;
                    } catch {
                        reason = responseBody;
                    }
                }

                resolve({ error: reason, id: token, status: "failed" });
            });

            stream.end(body);
        });

    return {
        channel: "push",
        endpoint: host,
        features: { batchSending: false, media: true, richContent: true },
        id: "apns",
        initialize: () => {},
        isAvailable: () => true,
        options,
        send: async (payload: PushPayload): Promise<Result<NotificationResult>> => {
            const recipients = toRecipientList(payload.to);
            const aps: Record<string, unknown> = { alert: { body: payload.body, title: payload.title } };

            if (payload.sound !== undefined) {
                aps.sound = payload.sound;
            }

            if (payload.badge !== undefined) {
                aps.badge = payload.badge;
            }

            // Spread `payload.data` first so the constructed `aps` always wins over any
            // caller-supplied `data.aps`.
            const body = JSON.stringify({ ...payload.data, aps });

            const results: RecipientResult[] = [];

            for (const token of recipients) {
                // eslint-disable-next-line no-await-in-loop
                results.push(await sendOne(token, body));
            }

            return aggregateRecipientResults("push", "apns", results);
        },
        shutdown: () => {
            if (session && !session.closed) {
                session.close();
            }

            session = undefined;
        },
    };
});

export default apnsProvider;
