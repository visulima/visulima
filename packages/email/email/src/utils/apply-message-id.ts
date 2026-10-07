import type { EmailOptions } from "../types";
import generateMessageId from "./generate-message-id";
import headersToRecord from "./headers-to-record";
import { sanitizeHeaderValue } from "./sanitize-header";

/**
 * Resolves the Message-ID for an outgoing message and returns headers carrying exactly one.
 *
 * A caller-supplied `Message-ID` header (matched case-insensitively) wins, so threading and
 * idempotency keys the caller relies on survive; otherwise one is generated on the sender's domain.
 * @param emailOptions The email options whose headers and sender are used.
 * @returns The resolved Message-ID and the headers with it set under `Message-ID`.
 */
const applyMessageId = (emailOptions: Pick<EmailOptions, "from" | "headers">): { headers: Record<string, string>; messageId: string } => {
    const headers: Record<string, string> = {};
    let messageId: string | undefined;

    for (const [name, value] of Object.entries(emailOptions.headers ? headersToRecord(emailOptions.headers) : {})) {
        if (name.toLowerCase() === "message-id") {
            // Sanitized here because some providers write the id into raw MIME unescaped.
            messageId = sanitizeHeaderValue(value).trim() || undefined;
        } else {
            headers[name] = value;
        }
    }

    messageId ??= generateMessageId(emailOptions.from.email);
    headers["Message-ID"] = messageId;

    return { headers, messageId };
};

export default applyMessageId;
