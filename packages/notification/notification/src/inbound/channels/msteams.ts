import type { Provider } from "../../providers/provider";
import { fromBase64Url } from "../../providers/utils/webcrypto";
import type { ChatPayload } from "../../types";
import { hmacBase64, timingSafeEqual } from "../../webhooks/crypto";
import { getHeader, tryParseObject } from "../../webhooks/types";
import { chatReply } from "../reply";
import type { InboundMessage, Receiver, ReceiverOptions } from "../types";
import { asDate, asRawResponse, asReply, asString, headersToRecord, jsonResponse, noContent, rejectionResponse } from "../utils";

const AUTH_HEADER = "Authorization";
const HMAC_PREFIX = "HMAC ";

/**
 * Maps a Microsoft Teams Bot Framework activity to a normalised {@link InboundMessage}, or
 * `undefined` for non-message activities the receiver does not dispatch.
 * @param body The raw request body.
 * @returns The normalised message, or `undefined`.
 */
const parseTeams = (body: string): InboundMessage | undefined => {
    const activity = tryParseObject(body);

    if (activity?.type !== "message") {
        return undefined;
    }

    const from = activity.from as Record<string, unknown> | undefined;
    const conversation = activity.conversation as Record<string, unknown> | undefined;
    const timestamp = asString(activity.timestamp);

    return {
        channel: "chat",
        conversationId: asString(conversation?.id),
        from: { id: asString(from?.id) ?? "", name: asString(from?.name) },
        id: asString(activity.id) ?? "",
        metadata: { channelId: activity.channelId, serviceUrl: activity.serviceUrl },
        provider: "msteams",
        raw: activity,
        text: asString(activity.text),
        threadId: asString(conversation?.id),
        timestamp: asDate(timestamp),
        type: "message",
    };
};

/**
 * Options for the Microsoft Teams inbound receiver (outgoing webhook).
 */
export interface MsTeamsReceiverOptions extends ReceiverOptions {
    /** The outbound Teams chat provider used by `context.reply()`. Optional. */
    provider?: Provider<unknown, ChatPayload>;

    /**
     * The security token (HMAC key) Teams issued when the outgoing webhook was created. It is
     * base64-decoded to key the HMAC that verifies the `Authorization` header.
     */
    securityToken: string;
}

/**
 * Creates a Microsoft Teams inbound receiver for outgoing webhooks. Requests are verified with
 * Teams' HMAC scheme — base64 HMAC-SHA256 over the raw request body, keyed by the
 * base64-decoded security token, carried in the `Authorization` header as `HMAC` plus the
 * signature.
 *
 * A handler may return an {@link ../types.InboundReply}; its `text` is serialised into a Bot
 * Framework message activity in the HTTP response, which Teams renders as the reply.
 * @param options Verification config, the message handler and an optional reply provider.
 * @returns The inbound channel.
 */
export const createMsTeamsReceiver = (options: MsTeamsReceiverOptions): Receiver => {
    return {
        channel: "chat",
        handle: async (request: Request): Promise<Response> => {
            const body = await request.text();
            const headers = headersToRecord(request.headers);
            const auth = getHeader(headers, AUTH_HEADER);

            if (auth?.startsWith(HMAC_PREFIX) !== true) {
                return rejectionResponse("missing_signature", request, options.onError);
            }

            let expected: string;

            try {
                expected = await hmacBase64(fromBase64Url(options.securityToken), body, "SHA-256");
            } catch {
                return rejectionResponse("invalid_signature", request, options.onError);
            }

            if (!timingSafeEqual(expected, auth.slice(HMAC_PREFIX.length))) {
                return rejectionResponse("invalid_signature", request, options.onError);
            }

            const message = parseTeams(body);

            if (message === undefined) {
                return noContent();
            }

            const result = await options.onMessage(message, { body, headers, reply: chatReply("msteams", message, options.provider), request });
            const raw = asRawResponse(result);

            if (raw !== undefined) {
                return raw;
            }

            const reply = asReply(result);

            if (reply !== undefined) {
                return jsonResponse({ text: reply.text, type: "message", ...reply.raw });
            }

            return new Response(undefined, { status: 200 });
        },
        provider: "msteams",
    };
};
