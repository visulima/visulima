import type { EmailAddress } from "../../types";

/**
 * Formats a single email address as "Name &lt;email>" or just "email" if no name is provided.
 * @param address The email address object to format.
 * @returns The formatted email address string.
 */
export const formatAddress = (address: EmailAddress): string => {
    if (address.name) {
        return `${address.name} <${address.email}>`;
    }

    return address.email;
};

/**
 * Formats an array of email addresses or a single address as "Name &lt;email>" format.
 * @param addresses The email address(es) to format (single or array).
 * @returns An array of formatted email address strings.
 */
export const formatAddresses = (addresses: EmailAddress | EmailAddress[]): string[] => {
    const addressList = Array.isArray(addresses) ? addresses : [addresses];

    return addressList.map((address) => formatAddress(address));
};

/**
 * Formats a single email address for SendGrid API format.
 * @param address The email address object to format.
 * @returns An object with email and optional name properties.
 */
export const formatSendGridAddress = (address: EmailAddress): { email: string; name?: string } => {
    const result: { email: string; name?: string } = {
        email: address.email,
    };

    if (address.name) {
        result.name = address.name;
    }

    return result;
};

/**
 * Formats email addresses for SendGrid API format.
 * @param addresses The email address(es) to format (single or array).
 * @returns An array of objects with email and optional name properties.
 */
export const formatSendGridAddresses = (addresses: EmailAddress | EmailAddress[]): { email: string; name?: string }[] => {
    const addressList = Array.isArray(addresses) ? addresses : [addresses];

    return addressList.map((address) => formatSendGridAddress(address));
};

/**
 * Formats email addresses as a simple string array containing only email addresses.
 * @param addresses The email address(es) to format (single or array).
 * @returns An array of email address strings.
 */
export const formatAddressEmails = (addresses: EmailAddress | EmailAddress[]): string[] => {
    const addressList = Array.isArray(addresses) ? addresses : [addresses];

    return addressList.map((address) => address.email);
};

/**
 * Formats an email address for Azure API format.
 * @param address The email address object to format.
 * @returns An object with email and optional displayName properties.
 */
export const formatAzureAddress = (address: EmailAddress): { displayName?: string; email: string } => {
    return {
        email: address.email,
        ...(address.name && { displayName: address.name }),
    };
};

/**
 * Formats email addresses for Azure API format.
 * @param addresses The email address(es) to format (single or array).
 * @returns An array of objects with email and optional displayName properties.
 */
export const formatAzureAddresses = (addresses: EmailAddress | EmailAddress[]): { displayName?: string; email: string }[] => {
    const addressList = Array.isArray(addresses) ? addresses : [addresses];

    return addressList.map((address) => formatAzureAddress(address));
};

/**
 * Formats an email address for Mailjet API format.
 * @param address The email address object to format.
 * @returns An object with Email and optional Name properties.
 */
export const formatMailjetAddress = (address: EmailAddress): { Email: string; Name?: string } => {
    const result: { Email: string; Name?: string } = {
        Email: address.email,
    };

    if (address.name) {
        result.Name = address.name;
    }

    return result;
};

/**
 * Formats email addresses for Mailjet API format.
 * @param addresses The email address(es) to format (single or array).
 * @returns An array of objects with Email and optional Name properties.
 */
export const formatMailjetAddresses = (addresses: EmailAddress | EmailAddress[]): { Email: string; Name?: string }[] => {
    const addressList = Array.isArray(addresses) ? addresses : [addresses];

    return addressList.map((address) => formatMailjetAddress(address));
};

/**
 * Formats an email address for Mandrill API format.
 * @param address The email address object to format.
 * @param type The recipient type (default: "to").
 * @returns An object with email, optional name, and type properties.
 */
export const formatMandrillAddress = (address: EmailAddress, type: string = "to"): { email: string; name?: string; type: string } => {
    return {
        email: address.email,
        ...(address.name && { name: address.name }),
        type,
    };
};

/**
 * Formats email addresses for Mandrill API format.
 * @param addresses The email address(es) to format (single or array).
 * @param type The recipient type (default: "to").
 * @returns An array of objects with email, optional name, and type properties.
 */
export const formatMandrillAddresses = (addresses: EmailAddress | EmailAddress[], type: string = "to"): { email: string; name?: string; type: string }[] => {
    const addressList = Array.isArray(addresses) ? addresses : [addresses];

    return addressList.map((address) => formatMandrillAddress(address, type));
};

/**
 * Formats an email address for Postal API format.
 * @param address The email address object to format.
 * @returns An object with address and optional name properties.
 */
export const formatPostalAddress = (address: EmailAddress): { address: string; name?: string } => {
    return {
        address: address.email,
        ...(address.name && { name: address.name }),
    };
};

/**
 * Formats email addresses for Postal API format.
 * @param addresses The email address(es) to format (single or array).
 * @returns An array of objects with address and optional name properties.
 */
export const formatPostalAddresses = (addresses: EmailAddress | EmailAddress[]): { address: string; name?: string }[] => {
    const addressList = Array.isArray(addresses) ? addresses : [addresses];

    return addressList.map((address) => formatPostalAddress(address));
};

/**
 * Formats email addresses for MailPace API format as formatted strings.
 * @param addresses The email address(es) to format (single or array).
 * @returns An array of formatted email address strings.
 */
export const formatMailpaceAddresses = (addresses: EmailAddress | EmailAddress[]): string[] =>
    // MailPace uses the same format as the standard formatAddresses
    formatAddresses(addresses);

/**
 * Formats an email address for Zeptomail API format.
 * @param address The email address object to format.
 * @returns An object with address and optional name properties.
 */
export const formatZeptomailAddress = (address: EmailAddress): { address: string; name?: string } =>
    // Zeptomail uses the same format as Postal
    formatPostalAddress(address);

/**
 * Formats email addresses for Zeptomail API format.
 * @param addresses The email address(es) to format (single or array).
 * @returns An array of objects with email_address containing address and optional name properties.
 */
export const formatZeptomailAddresses = (addresses: EmailAddress | EmailAddress[]): { email_address: { address: string; name?: string } }[] => {
    const addressList = Array.isArray(addresses) ? addresses : [addresses];

    return addressList.map((address) => {
        return {
            email_address: formatZeptomailAddress(address),
        };
    });
};
