import type { EmailAddress, EmailOptions } from "../../types";
import validateEmailDefault from "./validate-email";

/**
 * Validates email options and returns any validation errors.
 * @param options The email options to validate.
 * @returns Array of error messages (empty if validation passes).
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
const validateEmailOptions = <T extends EmailOptions>(options: T): string[] => {
    const errors: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!options.from?.email) {
        errors.push("Missing required field: from");
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!options.to) {
        errors.push("Missing required field: to");
    }

    if (!options.subject) {
        errors.push("Missing required field: subject");
    }

    if (!options.text && !options.html) {
        errors.push("Either text or html content is required");
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/prefer-optional-chain
    if (options.from && options.from.email && !validateEmailDefault(options.from.email)) {
        errors.push(`Invalid from email address: ${options.from.email}`);
    }

    const checkAddresses = (addresses: EmailAddress | EmailAddress[] | undefined, field: string) => {
        if (!addresses) {
            return;
        }

        const list = Array.isArray(addresses) ? addresses : [addresses];

        list.forEach((addr) => {
            if (!validateEmailDefault(addr.email)) {
                errors.push(`Invalid ${field} email address: ${addr.email}`);
            }
        });
    };

    checkAddresses(options.to, "to");
    checkAddresses(options.cc, "cc");
    checkAddresses(options.bcc, "bcc");

    if (options.replyTo && !validateEmailDefault(options.replyTo.email)) {
        errors.push(`Invalid replyTo email address: ${options.replyTo.email}`);
    }

    return errors;
};

export default validateEmailOptions;
