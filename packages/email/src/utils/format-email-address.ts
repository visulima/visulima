import { EmailError } from "../errors/email-error";
import type { EmailAddress } from "../types";
import { validateEmail } from "./validate-email";

/**
 * Format email address as "Name &lt;email@example.com>"
 */
export const formatEmailAddress = (address: EmailAddress): string => {
    if (!validateEmail(address.email)) {
        throw new EmailError("email", `Invalid email address: ${address.email}`);
    }

    return address.name ? `${address.name} <${address.email}>` : address.email;
};
