import { getHeader, tryParseObject } from "../../webhooks/types";
import { verifyEd25519 } from "../ed25519";
import type { InboundChannel, InboundChannelOptions, InboundMessage } from "../types";
import { asRawResponse, asReply, asString, headersToRecord, jsonResponse, noContent, rejectionResponse } from "../utils";

const SIGNATURE_HEADER = "X-Signature-Ed25519";
const TIMESTAMP_HEADER = "X-Signature-Timestamp";

/** Discord interaction types. */
const PING = 1;
const APPLICATION_COMMAND = 2;
const MESSAGE_COMPONENT = 3;

/** Discord interaction-response types. */
const PONG = 1;
const CHANNEL_MESSAGE_WITH_SOURCE = 4;
const DEFERRED_CHANNEL_MESSAGE = 5;

/**
 * Extracts the invoking user from a Discord interaction, which lives under `member.user`
 * inside a guild and `user` in a DM.
 * @param payload The decoded Discord interaction request body.
 * @returns The invoking user, or `undefined` when absent.
 */
const interactionUser = (payload: Record<string, unknown>): Record<string, unknown> | undefined => {
    const member = payload.member as Record<string, unknown> | undefined;
    const user = (member?.user ?? payload.user) as Record<string, unknown> | undefined;

    return user;
};

/**
 * Maps a verified Discord interaction to a normalised {@link InboundMessage}, or `undefined`
 * for the `PING` handshake and unrecognised interaction types.
 * @param payload The interaction payload.
 * @returns The normalised message, or `undefined`.
 */
const parseDiscord = (payload: Record<string, unknown>): InboundMessage | undefined => {
    const { type } = payload;
    const user = interactionUser(payload);
    const from = {
        id: asString(user?.id) ?? "",
        isBot: user?.bot === true,
        username: asString(user?.username),
    };
    const base = {
        channel: "chat" as const,
        conversationId: asString(payload.channel_id),
        from,
        id: asString(payload.id) ?? "",
        metadata: { applicationId: payload.application_id, guildId: payload.guild_id, token: payload.token },
        provider: "discord",
        raw: payload,
        timestamp: new Date(),
    };

    if (type === APPLICATION_COMMAND) {
        const data = payload.data as Record<string, unknown> | undefined;

        return { ...base, command: { name: asString(data?.name) ?? "" }, type: "command" };
    }

    if (type === MESSAGE_COMPONENT) {
        const data = payload.data as Record<string, unknown> | undefined;

        return { ...base, text: asString(data?.custom_id), type: "callback" };
    }

    return undefined;
};

/**
 * Options for the Discord inbound receiver.
 */
export interface DiscordInboundOptions extends InboundChannelOptions {
    /** The application's Ed25519 public key (hex), from the Discord developer dashboard. */
    publicKey: string;
}

/**
 * Creates a Discord inbound receiver for the interactions endpoint. Requests are verified
 * with Ed25519 (`X-Signature-Ed25519` over `timestamp + body`) before dispatch, and the
 * `PING` handshake is answered with a `PONG` automatically.
 *
 * A handler may return an {@link ../types.InboundReply} to respond with a channel message
 * (`CHANNEL_MESSAGE_WITH_SOURCE`); returning nothing defers the interaction
 * (`DEFERRED_CHANNEL_MESSAGE`), after which you follow up through the Discord API.
 * @param options The receiver options.
 * @returns The inbound channel.
 */
export const createDiscordInbound = (options: DiscordInboundOptions): InboundChannel => {
    return {
        channel: "chat",
        handle: async (request: Request): Promise<Response> => {
            const body = await request.text();
            const headers = headersToRecord(request.headers);
            const signature = getHeader(headers, SIGNATURE_HEADER);
            const timestamp = getHeader(headers, TIMESTAMP_HEADER);

            if (signature === undefined || timestamp === undefined) {
                return rejectionResponse("missing_signature", request, options.onError);
            }

            if (!await verifyEd25519(options.publicKey, signature, timestamp, body)) {
                return rejectionResponse("invalid_signature", request, options.onError);
            }

            const payload = tryParseObject(body);

            if (payload === undefined) {
                return rejectionResponse("invalid_body", request, options.onError);
            }

            // Answer the interaction endpoint validation ping.
            if (payload.type === PING) {
                return jsonResponse({ type: PONG });
            }

            const message = parseDiscord(payload);

            if (message === undefined) {
                return noContent();
            }

            const result = await options.onMessage(message, { body, headers, request });
            const raw = asRawResponse(result);

            if (raw !== undefined) {
                return raw;
            }

            const reply = asReply(result);

            if (reply !== undefined) {
                return jsonResponse({ data: { content: reply.text, ...reply.raw }, type: CHANNEL_MESSAGE_WITH_SOURCE });
            }

            // No synchronous reply: acknowledge and defer so the handler can follow up out-of-band.
            return jsonResponse({ type: DEFERRED_CHANNEL_MESSAGE });
        },
        provider: "discord",
    };
};
