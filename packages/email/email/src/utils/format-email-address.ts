import EmailError from "../errors/email-error";
import type { EmailAddress } from "../types";
import { sanitizeHeaderValue } from "./sanitize-header";
import validateEmailDefault from "./validation/validate-email";

/**
 * Formats an email address as "Name &lt;email@example.com>" or just "email@example.com" if no name is provided.
 * @param address The email address object to format.
 * @returns The formatted email address string in RFC 5322 format.
 * @throws {EmailError} When the email address is invalid.
 */
const formatEmailAddress = (address: EmailAddress): string => {
    if (!validateEmailDefault(address.email)) {
        throw new EmailError("email", `Invalid email address: ${address.email}`);
    }

    if (address.name) {
        const sanitizedName = sanitizeHeaderValue(address.name);

        return `${sanitizedName} <${address.email}>`;
    }

    return address.email;
};

export default formatEmailAddress;
