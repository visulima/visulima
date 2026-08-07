import type { Provider } from "../../providers/provider";
import type { SmsPayload } from "../../types";
import { getHeader, tryParseObject } from "../../webhooks/types";
import { isJwtTimeValid, sha256Hex, verifyHs256Jwt } from "../jwt";
import { smsReply } from "../reply";
import type { InboundChannel, InboundChannelOptions, InboundMessage } from "../types";
import { asRawResponse, asString, headersToRecord, noContent, rejectionResponse } from "../utils";

const AUTH_HEADER = "Authorization";
const BEARER_PREFIX = "Bearer ";

/**
 * Reads a Vonage party (`from` / `to`), which is a bare number string on the SMS channel and a
 * `{ type, number }` object on newer channels.
 * @param value The party field.
 * @returns The phone number / address, or `undefined`.
 */
const partyNumber = (value: unknown): string | undefined => {
    if (typeof value === "string") {
        return value;
    }

    return asString((value as Record<string, unknown> | undefined)?.number);
};

/**
 * Maps a Vonage Messages API inbound webhook to a normalised {@link InboundMessage}, or
 * `undefined` when the body is not a recognised inbound message.
 * @param body The raw request body.
 * @returns The normalised message, or `undefined`.
 */
const parseVonage = (body: string): InboundMessage | undefined => {
    const payload = tryParseObject(body);
    const from = partyNumber(payload?.from);

    if (payload === undefined || from === undefined) {
        return undefined;
    }

    const timestamp = asString(payload.timestamp);

    return {
        channel: "sms",
        conversationId: partyNumber(payload.to),
        from: { id: from },
        id: asString(payload.message_uuid) ?? "",
        metadata: { channelType: payload.channel, messageType: payload.message_type },
        provider: "vonage",
        raw: payload,
        text: asString(payload.text),
        timestamp: timestamp === undefined ? new Date() : new Date(timestamp),
        type: "message",
    };
};

/**
 * Options for the Vonage inbound receiver.
 */
export interface VonageInboundOptions extends InboundChannelOptions {
    /** The outbound Vonage SMS provider used by `context.reply()`. Optional. */
    provider?: Provider<unknown, SmsPayload>;
    /** The account signature secret (verifies the `Authorization: Bearer` JWT). */
    signatureSecret: string;
}

/**
 * Creates a Vonage inbound receiver for the Messages API. Requests carry an HS256 JWT in the
 * `Authorization: Bearer` header, signed with the account signature secret; the JWT's
 * `payload_hash` claim (SHA-256 of the raw body) binds it to this request. Both the signature
 * and `payload_hash` are checked, along with the token's validity window, before dispatch.
 *
 * Vonage has no synchronous reply; acknowledge and answer via `context.reply()`.
 * @param options The receiver options.
 * @returns The inbound channel.
 */
export const createVonageInbound = (options: VonageInboundOptions): InboundChannel => {
    return {
        channel: "sms",
        handle: async (request: Request): Promise<Response> => {
            const body = await request.text();
            const headers = headersToRecord(request.headers);
            const auth = getHeader(headers, AUTH_HEADER);

            if (auth?.startsWith(BEARER_PREFIX) !== true) {
                return rejectionResponse("missing_signature", request, options.onError);
            }

            const claims = await verifyHs256Jwt(auth.slice(BEARER_PREFIX.length), options.signatureSecret);

            if (claims === undefined || !isJwtTimeValid(claims)) {
                return rejectionResponse("invalid_signature", request, options.onError);
            }

            if (body.length > 0 && claims.payload_hash !== await sha256Hex(body)) {
                return rejectionResponse("invalid_signature", request, options.onError);
            }

            const message = parseVonage(body);

            if (message === undefined) {
                return noContent();
            }

            const result = await options.onMessage(message, { body, headers, reply: smsReply(message, options.provider), request });

            return asRawResponse(result) ?? noContent();
        },
        provider: "vonage",
    };
};
