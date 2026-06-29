import { splitAddress } from "../internal/address";

/**
 * The result of sub-address (tag) detection.
 */
interface TagResult {
    /** The local part with the tag and separator removed (the "real" mailbox). */
    baseLocalPart: string;
    /** True when a sub-address tag was found. */
    hasTag: boolean;
    /** The separator that introduced the tag (`+` or `-`), if any. */
    separator?: string;
    /** The detected tag value (everything after the separator), if any. */
    tag?: string;
}

/**
 * Domains whose providers use `-` (rather than `+`) for sub-addressing.
 * Ported from the mailer's alias rules; the verifier stays mailer-free.
 */
const DASH_SUBADDRESSING_DOMAINS: ReadonlySet<string> = new Set(["fastmail.com", "fastmail.fm", "yahoo.co.uk", "yahoo.com"]);

/**
 * Detects plus-addressing / sub-addressing tags in an email address.
 *
 * Most providers (Gmail, Outlook, iCloud, Proton, …) delimit the tag with `+`;
 * a few (Fastmail, Yahoo) use `-`. The returned {@link TagResult.baseLocalPart}
 * is the canonical mailbox with the tag stripped.
 * @param email The email address to inspect.
 * @returns The tag detection result.
 * @example
 * ```ts
 * import { detectTag } from "@visulima/email-verifier/checks/tag";
 *
 * detectTag("user+newsletter@gmail.com");
 * // { hasTag: true, tag: "newsletter", separator: "+", baseLocalPart: "user" }
 * ```
 */
const detectTag = (email: string): TagResult => {
    const parts = splitAddress(email);

    if (!parts) {
        return { baseLocalPart: "", hasTag: false };
    }

    const { domain, localPart } = parts;

    const plusIndex = localPart.indexOf("+");

    if (plusIndex > 0) {
        return {
            baseLocalPart: localPart.slice(0, plusIndex),
            hasTag: true,
            separator: "+",
            tag: localPart.slice(plusIndex + 1),
        };
    }

    if (DASH_SUBADDRESSING_DOMAINS.has(domain)) {
        const dashIndex = localPart.indexOf("-");

        if (dashIndex > 0) {
            return {
                baseLocalPart: localPart.slice(0, dashIndex),
                hasTag: true,
                separator: "-",
                tag: localPart.slice(dashIndex + 1),
            };
        }
    }

    return { baseLocalPart: localPart, hasTag: false };
};

export type { TagResult };
export { detectTag };
export default detectTag;
