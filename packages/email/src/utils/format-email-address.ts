import { EmailError } from "../errors/email-error";
import type { EmailAddress } from "../types";
import validateEmailDefault from "./validate-email";

/**
 * Format email address as "Name &lt;email@example.com>"
 * @param address The email address object to format
 * @returns The formatted email address string
 * @throws {EmailError} When the email address is invalid
 */
const formatEmailAddress = (address: EmailAddress): string => {
    if (!validateEmailDefault(address.email)) {
        throw new EmailError("email", `Invalid email address: ${address.email}`);
    }

    return address.name ? `${address.name} <${address.email}>` : address.email;
};

export default formatEmailAddress;
