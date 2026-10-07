/**
 * Returns the ASCII (punycode) form of a domain, or `undefined` when it is not a valid hostname.
 * @param domain The domain part of an address.
 * @returns The ASCII hostname, or `undefined`.
 */
const toAsciiDomain = (domain: string): string | undefined => {
    try {
        const { hostname } = new URL(`http://${domain}`);

        return hostname === "" ? undefined : hostname;
    } catch {
        return undefined;
    }
};

/**
 * Generates a unique RFC 5322 Message-ID.
 *
 * The id part is a random UUID; the domain part is the sender's domain (punycoded, since headers
 * are ASCII), because a Message-ID on a domain the sender does not own (or on `.local`) is a spam
 * signal for receiving MTAs.
 * @param fromEmail The sender's address; its domain becomes the Message-ID's right-hand side.
 * @returns A unique message ID in the format &lt;uuid@domain>, with `localhost` when there is no usable domain.
 */
const generateMessageId = (fromEmail?: string): string => {
    const at = fromEmail?.lastIndexOf("@") ?? -1;
    const domain = fromEmail === undefined || at === -1 ? undefined : toAsciiDomain(fromEmail.slice(at + 1));

    // eslint-disable-next-line n/no-unsupported-features/node-builtins -- Web Crypto global keeps the HTTP providers edge-safe with no node:crypto import
    return `<${globalThis.crypto.randomUUID()}@${domain ?? "localhost"}>`;
};

export default generateMessageId;
