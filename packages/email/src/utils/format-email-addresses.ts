import type { EmailAddress } from "../types";
import { formatEmailAddress } from "./format-email-address";

/**
 * Format email addresses list
 */
export const formatEmailAddresses = (addresses: EmailAddress | EmailAddress[]): string => {
    if (Array.isArray(addresses)) {
        return addresses.map(formatEmailAddress).join(", ");
    }

    return formatEmailAddress(addresses);
};
