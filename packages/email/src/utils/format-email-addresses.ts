import type { EmailAddress } from "../types";
import formatEmailAddressDefault from "./format-email-address";

/**
 * Format email addresses list
 * @param addresses The email address(es) to format (single or array)
 * @returns The formatted email addresses string (comma-separated if multiple)
 */
const formatEmailAddresses = (addresses: EmailAddress | EmailAddress[]): string => {
    if (Array.isArray(addresses)) {
        return addresses.map(formatEmailAddressDefault).join(", ");
    }

    return formatEmailAddressDefault(addresses);
};

export default formatEmailAddresses;
