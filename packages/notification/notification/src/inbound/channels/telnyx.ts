import type { Provider } from "../../providers/provider";
import type { SmsPayload } from "../../types";
import { isWithinReplayWindow, REPLAY_WINDOW_SECONDS } from "../../webhooks/crypto";
import { getHeader, tryParseObject } from "../../webhooks/types";
import { verifyEd25519Base64 } from "../ed25519";
import { smsReply } from "../reply";
import type { InboundAttachment, InboundMessage, Receiver, ReceiverOptions } from "../types";
import { asDate, asRawResponse, asString, headersToRecord, noContent, rejectionResponse } from "../utils";

const SIGNATURE_HEADER = "telnyx-signature-ed25519";
const TIMESTAMP_HEADER = "telnyx-timestamp";

/**
 * Extracts media attachments from a Telnyx inbound message payload.
 * @param payload The `data.payload` object.
 * @returns The attachments, or `undefined` when none are present.
 */
const parseMedia = (payload: Record<string, unknown>): InboundAttachment[] | undefined => {
    const { media } = payload;

    if (!Array.isArray(media) || media.length === 0) {
        return undefined;
    }

    return media.map((item) => {
        const entry = item as Record<string, unknown>;

        return { contentType: asString(entry.content_type), url: asString(entry.url) };
    });
};

/**
 * Maps a verified Telnyx `message.received` webhook to a normalised {@link InboundMessage}, or
 * `undefined` for other event types (e.g. outbound delivery receipts).
 * @param body The raw request body.
 * @returns The normalised message, or `undefined`.
 */
const parseTelnyx = (body: string): InboundMessage | undefined => {
    const envelope = tryParseObject(body);
    const data = envelope?.data as Record<string, unknown> | undefined;
    const payload = data?.payload as Record<string, unknown> | undefined;

    if (payload === undefined || asString(data?.event_type) !== "message.received") {
        return undefined;
    }

    const from = payload.from as Record<string, unknown> | undefined;
    const to = payload.to as Record<string, unknown>[] | undefined;
    const receivedAt = asString(payload.received_at);

    return {
        attachments: parseMedia(payload),
        channel: "sms",
        conversationId: asString(to?.[0]?.phone_number),
        from: { id: asString(from?.phone_number) ?? "" },
        id: asString(payload.id) ?? "",
        metadata: { direction: payload.direction, messagingProfileId: payload.messaging_profile_id, transport: asString(payload.type) },
        provider: "telnyx",
        raw: envelope,
        text: asString(payload.text),
        timestamp: asDate(receivedAt),
        type: "message",
    };
};

/**
 * Options for the Telnyx inbound receiver.
 */
export interface TelnyxReceiverOptions extends ReceiverOptions {
    /** The outbound Telnyx SMS provider used by `context.reply()`. Optional. */
    provider?: Provider<unknown, SmsPayload>;
    /** The account's Ed25519 public key (base64), from the Telnyx Mission Control portal. */
    publicKey: string;
}

/**
 * Creates a Telnyx inbound receiver for incoming SMS/MMS. Requests are verified with Telnyx's
 * Ed25519 scheme — the `telnyx-signature-ed25519` header (base64) over `{timestamp}|{body}`,
 * checked against the account public key, with the `telnyx-timestamp` held to a 5-minute
 * replay window.
 *
 * Telnyx has no synchronous reply, so acknowledge and answer through `context.reply()` (or the
 * outbound Telnyx provider).
 * @param options Verification config, the message handler and an optional reply provider.
 * @returns The inbound channel.
 */
export const createTelnyxReceiver = (options: TelnyxReceiverOptions): Receiver => {
    return {
        channel: "sms",
        handle: async (request: Request): Promise<Response> => {
            const body = await request.text();
            const headers = headersToRecord(request.headers);
            const signature = getHeader(headers, SIGNATURE_HEADER);
            const timestamp = getHeader(headers, TIMESTAMP_HEADER);

            if (signature === undefined || timestamp === undefined) {
                return rejectionResponse("missing_signature", request, options.onError);
            }

            if (!isWithinReplayWindow(timestamp, REPLAY_WINDOW_SECONDS)) {
                return rejectionResponse("invalid_signature", request, options.onError);
            }

            if (!await verifyEd25519Base64(options.publicKey, signature, `${timestamp}|${body}`)) {
                return rejectionResponse("invalid_signature", request, options.onError);
            }

            const message = parseTelnyx(body);

            if (message === undefined) {
                return noContent();
            }

            const result = await options.onMessage(message, { body, headers, reply: smsReply(message, options.provider), request });

            return asRawResponse(result) ?? noContent();
        },
        provider: "telnyx",
    };
};
