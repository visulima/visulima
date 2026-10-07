import { randomUUID } from "node:crypto";

/**
 * Generates a unique RFC 5322 Message-ID.
 *
 * The id part is a random UUID; the domain part is the sender's domain, because a Message-ID on a
 * domain the sender does not own (or on `.local`) is a spam signal for receiving MTAs.
 * @param fromEmail The sender's address; its domain becomes the Message-ID's right-hand side.
 * @returns A unique message ID in the format &lt;uuid@domain>.
 */
const generateMessageId = (fromEmail?: string): string => {
    const at = fromEmail?.lastIndexOf("@") ?? -1;
    const domain = fromEmail && at !== -1 && at < fromEmail.length - 1 ? fromEmail.slice(at + 1) : "localhost";

    return `<${randomUUID()}@${domain}>`;
};

export default generateMessageId;
