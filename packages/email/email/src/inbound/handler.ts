import type { MaybePromise } from "../types";
import parseCloudflareInbound from "./providers/cloudflare";
import parseMailgunInbound from "./providers/mailgun";
import parsePostmarkInbound from "./providers/postmark";
import parseSendGridInbound from "./providers/sendgrid";
import parseSesInbound from "./providers/ses";
import { extractReply } from "./reply-parser";
import type { InboundEmail } from "./types";

/**
 * The inbound providers {@link parseInbound} can normalize.
 */
export type InboundProvider = "cloudflare" | "mailgun" | "postmark" | "sendgrid" | "ses";

/**
 * Normalizes a provider-specific inbound webhook payload into the common {@link InboundEmail} shape.
 * @param provider The provider the payload came from.
 * @param payload The raw (already JSON/form-decoded) payload.
 * @returns The normalized inbound email.
 */
export const parseInbound = (provider: InboundProvider, payload: unknown): InboundEmail => {
    switch (provider) {
        case "cloudflare": {
            return parseCloudflareInbound(payload as Parameters<typeof parseCloudflareInbound>[0]);
        }
        case "mailgun": {
            return parseMailgunInbound(payload as Parameters<typeof parseMailgunInbound>[0]);
        }
        case "sendgrid": {
            return parseSendGridInbound(payload as Parameters<typeof parseSendGridInbound>[0]);
        }
        case "ses": {
            return parseSesInbound(payload as Parameters<typeof parseSesInbound>[0]);
        }
        default: {
            return parsePostmarkInbound(payload as Parameters<typeof parsePostmarkInbound>[0]);
        }
    }
};

/**
 * Options for {@link defineInboundHandler}.
 */
export interface InboundHandlerOptions {
    /**
     * Invoked when a payload fails to parse or `onMessage` throws. When omitted, the error propagates.
     * @param error The thrown error.
     * @param provider The provider being handled.
     * @param payload The offending payload.
     */
    onError?: (error: unknown, provider: InboundProvider, payload: unknown) => MaybePromise<void>;

    /**
     * Invoked with each normalized inbound message.
     * @param email The normalized inbound email.
     */
    onMessage: (email: InboundEmail) => MaybePromise<void>;

    /**
     * Strip quoted history from the plain-text body (via {@link extractReply}) before `onMessage`.
     * @default false
     */
    stripReply?: boolean;
}

/**
 * A unified inbound handler created by {@link defineInboundHandler}.
 */
export interface InboundHandler {
    /**
     * Parses a provider payload, optionally strips quoted history, and dispatches it to `onMessage`.
     * @param provider The provider the payload came from.
     * @param payload The raw payload.
     * @returns The normalized email, or `undefined` when an error was handled by `onError`.
     */
    handle: (provider: InboundProvider, payload: unknown) => Promise<InboundEmail | undefined>;
}

/**
 * Creates a single inbound entry point over the five provider parsers — parse, optionally strip the
 * reply quote, then dispatch to your `onMessage` callback.
 * @param options Handler options. See {@link InboundHandlerOptions}.
 * @returns The handler. See {@link InboundHandler}.
 * @example
 * ```ts
 * const handler = defineInboundHandler({ stripReply: true, onMessage: (email) => saveReply(email) });
 *
 * app.post("/inbound/postmark", async (req) => { await handler.handle("postmark", req.body); });
 * ```
 */
export const defineInboundHandler = (options: InboundHandlerOptions): InboundHandler => {
    return {
        handle: async (provider, payload) => {
            try {
                const email = parseInbound(provider, payload);

                if (options.stripReply && email.text !== undefined) {
                    email.text = extractReply(email.text);
                }

                await options.onMessage(email);

                return email;
            } catch (error) {
                if (options.onError) {
                    await options.onError(error, provider, payload);

                    return undefined;
                }

                throw error;
            }
        },
    };
};
