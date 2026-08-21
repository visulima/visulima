import type { Provider } from "../../providers/provider";
import type { ChatPayload } from "../../types";
import { getHeader, tryParseObject } from "../../webhooks/types";
import { verifyEd25519 } from "../ed25519";
import { chatReply } from "../reply";
import type { InboundMessage, Receiver, ReceiverOptions } from "../types";
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

/** Comfortably inside Discord's three-second initial-response window. */
const DEFAULT_DEFER_AFTER_MS = 2000;

/** Sentinel resolved by {@link deferAfter}; a unique object cannot collide with a handler result. */
const DEFER = Symbol("defer");

/**
 * Resolves to {@link DEFER} once the deadline passes.
 * @param milliseconds How long to wait.
 * @returns A promise resolving to the defer sentinel.
 */
const deferAfter = async (milliseconds: number): Promise<typeof DEFER> =>
    new Promise((resolve) => {
        const timer = setTimeout(() => resolve(DEFER), milliseconds);

        // Node keeps the process alive for a pending timer; nothing waits on this one once the
        // handler wins the race.
        (timer as unknown as { unref?: () => void }).unref?.();
    });

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
export interface DiscordReceiverOptions extends ReceiverOptions {
    /**
     * How long the handler may run before the interaction is deferred, in milliseconds.
     *
     * Discord discards an interaction whose endpoint does not answer within three seconds, so a
     * handler that outruns this deadline gets a `DEFERRED_CHANNEL_MESSAGE` sent on its behalf and
     * keeps running; its eventual reply has to go out through the Discord API (or `provider`).
     * @default 2000
     */
    deferAfterMs?: number;

    /**
     * The outbound Discord chat provider used by `context.reply()`, which posts a message to
     * the originating channel (use this instead of the deferred HTTP response). Optional.
     */
    provider?: Provider<unknown, ChatPayload>;
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
 * @param options Verification config, the message handler and an optional reply provider.
 * @returns The inbound channel.
 */
export const createDiscordReceiver = (options: DiscordReceiverOptions): Receiver => {
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

            // Discord drops an interaction that is not answered within three seconds. Race the
            // handler against a shorter deadline so slow work defers instead of timing out; the
            // handler keeps running and follows up through the Discord API.
            const handled = Promise.resolve(options.onMessage(message, { body, headers, reply: chatReply("discord", message, options.provider), request }));
            const result = await Promise.race([handled, deferAfter(options.deferAfterMs ?? DEFAULT_DEFER_AFTER_MS)]);

            if (result === DEFER) {
                // Nothing awaits the handler now, so its rejection would surface as an unhandled
                // one. The request itself is already answered.
                handled.catch(() => undefined);

                return jsonResponse({ type: DEFERRED_CHANNEL_MESSAGE });
            }

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
