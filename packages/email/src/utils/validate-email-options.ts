import type { EmailAddress, EmailOptions } from "../types";
import { validateEmail } from "./validate-email";

/**
 * Validate email options
 */
export const validateEmailOptions = <T extends EmailOptions>(options: T): string[] => {
    const errors: string[] = [];

    if (!options.from || !options.from.email) {
        errors.push("Missing required field: from");
    }

    if (!options.to) {
        errors.push("Missing required field: to");
    }

    if (!options.subject) {
        errors.push("Missing required field: subject");
    }

    if (!options.text && !options.html) {
        errors.push("Either text or html content is required");
    }

    if (options.from && options.from.email && !validateEmail(options.from.email)) {
        errors.push(`Invalid from email address: ${options.from.email}`);
    }

    const checkAddresses = (addresses: EmailAddress | EmailAddress[] | undefined, field: string) => {
        if (!addresses)
            return;

        const list = Array.isArray(addresses) ? addresses : [addresses];

        list.forEach((addr) => {
            if (!validateEmail(addr.email)) {
                errors.push(`Invalid ${field} email address: ${addr.email}`);
            }
        });
    };

    checkAddresses(options.to, "to");
    checkAddresses(options.cc, "cc");
    checkAddresses(options.bcc, "bcc");

    if (options.replyTo && !validateEmail(options.replyTo.email)) {
        errors.push(`Invalid replyTo email address: ${options.replyTo.email}`);
    }

    return errors;
};
