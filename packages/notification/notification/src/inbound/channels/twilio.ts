import type { Provider } from "../../providers/provider";
import type { SmsPayload } from "../../types";
import { twilioWebhook } from "../../webhooks/twilio";
import { getHeader } from "../../webhooks/types";
import { smsReply } from "../reply";
import type { InboundAttachment, InboundMessage, Receiver, ReceiverOptions } from "../types";
import { asRawResponse, asReply, headersToRecord, rejectionResponse } from "../utils";

const SIGNATURE_HEADER = "X-Twilio-Signature";
const WHATSAPP_PREFIX = "whatsapp:";

/**
 * Control characters XML 1.0 forbids in character data: U+0000–U+0008, U+000B, U+000C and
 * U+000E–U+001F. Tab, LF and CR are legal and are deliberately absent.
 */
// eslint-disable-next-line no-control-regex -- matching the control characters is the point
const XML_ILLEGAL_CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/gu;

/**
 * Escapes the five XML predefined entities and drops the control characters XML forbids, so
 * message text is safe to embed in TwiML.
 *
 * Handler output routinely echoes the inbound `Body`, which is user-controlled. A single stray
 * control character makes the document unparseable, and Twilio then reports a document-parse
 * error instead of delivering the reply.
 * @param value The text to escape.
 * @returns The escaped text.
 */
const escapeXml = (value: string): string =>
    value
        .replaceAll(XML_ILLEGAL_CONTROLS, "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&apos;");

/**
 * Builds a TwiML response document, optionally carrying a single message element.
 * @param text The reply text, or `undefined` for an empty acknowledgement.
 * @returns The TwiML response.
 */
const twiml = (text: string | undefined): Response => {
    const inner = text === undefined ? "" : `<Message>${escapeXml(text)}</Message>`;
    // eslint-disable-next-line no-secrets/no-secrets -- static TwiML document scaffold, not a credential
    const document = `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;

    return new Response(document, { headers: { "content-type": "text/xml; charset=utf-8" }, status: 200 });
};

/**
 * Maps a verified Twilio inbound webhook to a normalised {@link InboundMessage}. The channel
 * is reported as `"sms"`; WhatsApp is distinguished by the `whatsapp:` address prefix (kept
 * in `metadata.transport`), with the prefix stripped from the participant ids.
 * @param parameters The decoded form parameters.
 * @returns The normalised message.
 */
const parseTwilio = (parameters: URLSearchParams): InboundMessage => {
    const from = parameters.get("From") ?? "";
    const to = parameters.get("To") ?? "";
    const isWhatsApp = from.startsWith(WHATSAPP_PREFIX) || to.startsWith(WHATSAPP_PREFIX);
    const mediaCount = Number.parseInt(parameters.get("NumMedia") ?? "0", 10);
    const attachments: InboundAttachment[] = [];

    for (let index = 0; index < mediaCount; index += 1) {
        const url = parameters.get(`MediaUrl${String(index)}`);

        if (url !== null) {
            attachments.push({ contentType: parameters.get(`MediaContentType${String(index)}`) ?? undefined, url });
        }
    }

    return {
        attachments: attachments.length > 0 ? attachments : undefined,
        channel: "sms",
        conversationId: to.replace(WHATSAPP_PREFIX, ""),
        from: { id: from.replace(WHATSAPP_PREFIX, ""), name: parameters.get("ProfileName") ?? undefined },
        id: parameters.get("MessageSid") ?? parameters.get("SmsSid") ?? "",
        metadata: { transport: isWhatsApp ? "whatsapp" : "sms" },
        provider: "twilio",
        raw: Object.fromEntries(parameters),
        text: parameters.get("Body") ?? undefined,
        timestamp: new Date(),
        type: "message",
    };
};

/**
 * Options for the Twilio inbound receiver (SMS and WhatsApp).
 */
export interface TwilioReceiverOptions extends ReceiverOptions {
    /** The Twilio auth token, used to verify `X-Twilio-Signature`. */
    authToken: string;

    /**
     * The outbound Twilio SMS provider used by `context.reply()`, which addresses the reply
     * back to the sender (re-applying the `whatsapp:` prefix for WhatsApp). Optional.
     */
    provider?: Provider<unknown, SmsPayload>;

    /**
     * The public URL Twilio signed the request against. Twilio's signature covers the exact
     * webhook URL it was configured with, so behind a proxy or rewrite (where `request.url`
     * differs) set this to the configured URL. Defaults to `request.url`.
     */
    url?: string;
}

/**
 * Creates a Twilio inbound receiver for incoming SMS and WhatsApp messages. Requests are
 * verified with Twilio's signature scheme (base64 HMAC-SHA1 over the request URL plus sorted
 * form parameters) before dispatch.
 *
 * A handler may return an {@link ../types.InboundReply}; its `text` is serialised into a TwiML
 * message element. Returning nothing acknowledges with an empty TwiML document.
 * @param options Verification config, the message handler and an optional reply provider.
 * @returns The inbound channel.
 */
export const createTwilioReceiver = (options: TwilioReceiverOptions): Receiver => {
    return {
        channel: "sms",
        handle: async (request: Request): Promise<Response> => {
            const body = await request.text();
            const headers = headersToRecord(request.headers);

            // twilioWebhook.verify reconstructs the signature base from the signed URL header.
            headers["x-twilio-signature-url"] = options.url ?? request.url;

            const verified = await twilioWebhook.verify(body, headers, options.authToken);

            if (!verified) {
                const reason = getHeader(headers, SIGNATURE_HEADER) === undefined ? "missing_signature" : "invalid_signature";

                return rejectionResponse(reason, request, options.onError);
            }

            const message = parseTwilio(new URLSearchParams(body));
            const result = await options.onMessage(message, { body, headers, reply: smsReply(message, options.provider), request });
            const raw = asRawResponse(result);

            if (raw !== undefined) {
                return raw;
            }

            return twiml(asReply(result)?.text);
        },
        provider: "twilio",
    };
};
