import type { Provider } from "../../providers/provider";
import type { SmsPayload } from "../../types";
import { getHeader, tryParseObject } from "../../webhooks/types";
import { isJwtTimeValid, sha256Hex, verifyHs256Jwt } from "../jwt";
import { smsReply } from "../reply";
import type { InboundMessage, Receiver, ReceiverOptions } from "../types";
import { asRawResponse, asString, headersToRecord, noContent, rejectionResponse } from "../utils";

const SIGNATURE_HEADER = "messagebird-signature-jwt";

/**
 * Maps a MessageBird inbound-message (MO) payload to a normalised {@link InboundMessage}, or
 * `undefined` when the body is not a recognised inbound message.
 * @param body The raw request body.
 * @returns The normalised message, or `undefined`.
 */
const parseMessageBird = (body: string): InboundMessage | undefined => {
    const payload = tryParseObject(body);
    const originator = asString(payload?.originator);
    const text = asString(payload?.body);

    if (payload === undefined || originator === undefined) {
        return undefined;
    }

    const createdAt = asString(payload.createdDatetime);

    return {
        channel: "sms",
        conversationId: asString(payload.recipient),
        from: { id: originator },
        id: asString(payload.id) ?? "",
        metadata: { direction: payload.direction },
        provider: "messagebird",
        raw: payload,
        text,
        timestamp: createdAt === undefined ? new Date() : new Date(createdAt),
        type: "message",
    };
};

/**
 * Options for the MessageBird inbound receiver.
 */
export interface MessageBirdReceiverOptions extends ReceiverOptions {
    /** The outbound MessageBird SMS provider used by `context.reply()`. Optional. */
    provider?: Provider<unknown, SmsPayload>;

    /** The webhook signing key from the MessageBird dashboard (verifies the JWT signature). */
    signingKey: string;

    /**
     * The public URL MessageBird signed (the `url_hash` claim covers the full URL). Set this
     * when `request.url` differs from the configured webhook URL (proxy/rewrite). Defaults to
     * `request.url`.
     */
    url?: string;
}

/**
 * Creates a MessageBird inbound receiver. Requests are verified with MessageBird's
 * `messagebird-signature-jwt` scheme: an HS256 JWT signed with the signing key whose claims
 * bind the request — `iss` (`MessageBird`), `jti`, `exp`, `url_hash` (SHA-256 of the full URL)
 * and `payload_hash` (SHA-256 of the body) — each of which is checked before dispatch.
 *
 * MessageBird has no synchronous reply; acknowledge and answer via `context.reply()`.
 * @param options Verification config, the message handler and an optional reply provider.
 * @returns The inbound channel.
 */
export const createMessageBirdReceiver = (options: MessageBirdReceiverOptions): Receiver => {
    return {
        channel: "sms",
        handle: async (request: Request): Promise<Response> => {
            const body = await request.text();
            const headers = headersToRecord(request.headers);
            const token = getHeader(headers, SIGNATURE_HEADER);

            if (token === undefined) {
                return rejectionResponse("missing_signature", request, options.onError);
            }

            const claims = await verifyHs256Jwt(token, options.signingKey);

            if (claims === undefined) {
                return rejectionResponse("invalid_signature", request, options.onError);
            }

            if (claims.iss !== "MessageBird" || typeof claims.jti !== "string" || !isJwtTimeValid(claims)) {
                return rejectionResponse("invalid_signature", request, options.onError);
            }

            if (claims.url_hash !== await sha256Hex(options.url ?? request.url)) {
                return rejectionResponse("invalid_signature", request, options.onError);
            }

            if (body.length > 0 && claims.payload_hash !== await sha256Hex(body)) {
                return rejectionResponse("invalid_signature", request, options.onError);
            }

            const message = parseMessageBird(body);

            if (message === undefined) {
                return noContent();
            }

            const result = await options.onMessage(message, { body, headers, reply: smsReply(message, options.provider), request });

            return asRawResponse(result) ?? noContent();
        },
        provider: "messagebird",
    };
};
