/* eslint-disable jsdoc/match-description */
/* eslint-disable no-secrets/no-secrets */

/**
 * Configuration for email provider alias normalization rules.
 */
interface NormalizationConfig {
    domain: string;
    ignoreDots: boolean;
    ignorePlus: boolean;
}

const NORMALIZATION_CONFIGS = new Map<string, NormalizationConfig>([
    ["fastmail.com", { domain: "fastmail.com", ignoreDots: false, ignorePlus: true }],
    ["gmail.com", { domain: "gmail.com", ignoreDots: true, ignorePlus: true }],
    ["gmx.com", { domain: "gmx.com", ignoreDots: false, ignorePlus: true }],
    ["gmx.de", { domain: "gmx.de", ignoreDots: false, ignorePlus: true }],
    ["gmx.net", { domain: "gmx.net", ignoreDots: false, ignorePlus: true }],
    ["hotmail.com", { domain: "hotmail.com", ignoreDots: false, ignorePlus: true }],
    ["icloud.com", { domain: "icloud.com", ignoreDots: false, ignorePlus: true }],
    ["live.com", { domain: "live.com", ignoreDots: false, ignorePlus: true }],
    ["mail.com", { domain: "mail.com", ignoreDots: false, ignorePlus: true }],
    ["msn.com", { domain: "msn.com", ignoreDots: false, ignorePlus: true }],
    ["outlook.com", { domain: "outlook.com", ignoreDots: false, ignorePlus: true }],
    ["protonmail.com", { domain: "protonmail.com", ignoreDots: false, ignorePlus: true }],
    ["yahoo.com", { domain: "yahoo.com", ignoreDots: false, ignorePlus: true }],
    ["zoho.com", { domain: "zoho.com", ignoreDots: false, ignorePlus: true }],
]);

/**
 * Normalizes email aliases for supported email providers.
 * For example: example@gmail.com and example+another@gmail.com point to the same email address.
 * This function normalizes aliases to their canonical form.
 *
 * Supported providers:
 * - Gmail: Removes dots and plus aliases (example+test@gmail.com → example@gmail.com)
 * - Yahoo, Outlook, Hotmail, Live, MSN, iCloud, ProtonMail, Zoho, FastMail, Mail.com, GMX: Removes plus aliases only
 * @param email The email address to normalize.
 * @returns The normalized email address, or the original email if not supported or invalid.
 * @example
 * ```ts
 * import { normalizeEmailAliases } from "@visulima/email/utils/normalize-email-aliases";
 *
 * normalizeEmailAliases("example+test@gmail.com"); // "example@gmail.com"
 * normalizeEmailAliases("ex.ample@gmail.com"); // "example@gmail.com"
 * normalizeEmailAliases("user+tag@yahoo.com"); // "user@yahoo.com"
 * normalizeEmailAliases("user@example.com"); // "user@example.com" (unchanged)
 * ```
 */
const normalizeEmailAliases = (email: string): string => {
    if (!email || typeof email !== "string") {
        return email;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const atIndex = trimmedEmail.indexOf("@");

    if (atIndex === -1 || atIndex === 0 || atIndex === trimmedEmail.length - 1) {
        return email;
    }

    const localPart = trimmedEmail.slice(0, atIndex);
    const domain = trimmedEmail.slice(atIndex + 1);

    if (!localPart || !domain) {
        return email;
    }

    const config = NORMALIZATION_CONFIGS.get(domain);

    if (!config) {
        return trimmedEmail;
    }

    let normalizedLocal = localPart;

    if (config.ignorePlus) {
        const plusIndex = normalizedLocal.indexOf("+");

        if (plusIndex !== -1) {
            normalizedLocal = normalizedLocal.slice(0, plusIndex);
        }
    }

    if (config.ignoreDots) {
        normalizedLocal = normalizedLocal.replaceAll(".", "");
    }

    return `${normalizedLocal}@${domain}`;
};

export default normalizeEmailAliases;
