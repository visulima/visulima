import type { EmailAddress } from "../../types";

/**
 * Format a single email address as "Name &lt;email>" or just "email"
 */
export function formatAddress(address: EmailAddress): string {
    if (address.name) {
        return `${address.name} <${address.email}>`;
    }

    return address.email;
}

/**
 * Format an array of email addresses or a single address as "Name &lt;email>" format
 */
export function formatAddresses(addresses: EmailAddress | EmailAddress[]): string[] {
    const addressList = Array.isArray(addresses) ? addresses : [addresses];

    return addressList.map(formatAddress);
}

/**
 * Format a single email address for SendGrid API format {email, name?}
 */
export function formatSendGridAddress(address: EmailAddress): { email: string; name?: string } {
    return {
        email: address.email,
        ...address.name && { name: address.name },
    };
}

/**
 * Format email addresses for SendGrid API format
 */
export function formatSendGridAddresses(addresses: EmailAddress | EmailAddress[]): { email: string; name?: string }[] {
    const addressList = Array.isArray(addresses) ? addresses : [addresses];

    return addressList.map(formatSendGridAddress);
}

/**
 * Format email addresses as simple string array (just emails)
 */
export function formatAddressEmails(addresses: EmailAddress | EmailAddress[]): string[] {
    const addressList = Array.isArray(addresses) ? addresses : [addresses];

    return addressList.map((address) => address.email);
}

/**
 * Format email address for Azure API format {email, displayName?}
 */
export function formatAzureAddress(address: EmailAddress): { displayName?: string; email: string } {
    return {
        email: address.email,
        ...address.name && { displayName: address.name },
    };
}

/**
 * Format email addresses for Azure API format
 */
export function formatAzureAddresses(addresses: EmailAddress | EmailAddress[]): { displayName?: string; email: string }[] {
    const addressList = Array.isArray(addresses) ? addresses : [addresses];

    return addressList.map(formatAzureAddress);
}

/**
 * Format email address for Mailjet API format {Email, Name?}
 */
export function formatMailjetAddress(address: EmailAddress): { Email: string; Name?: string } {
    return {
        Email: address.email,
        ...address.name && { Name: address.name },
    };
}

/**
 * Format email addresses for Mailjet API format
 */
export function formatMailjetAddresses(addresses: EmailAddress | EmailAddress[]): { Email: string; Name?: string }[] {
    const addressList = Array.isArray(addresses) ? addresses : [addresses];

    return addressList.map(formatMailjetAddress);
}

/**
 * Format email address for Mandrill API format {email, name?, type?}
 */
export function formatMandrillAddress(address: EmailAddress, type: string = "to"): { email: string; name?: string; type: string } {
    return {
        email: address.email,
        ...address.name && { name: address.name },
        type,
    };
}

/**
 * Format email addresses for Mandrill API format
 */
export function formatMandrillAddresses(addresses: EmailAddress | EmailAddress[], type: string = "to"): { email: string; name?: string; type: string }[] {
    const addressList = Array.isArray(addresses) ? addresses : [addresses];

    return addressList.map((address) => formatMandrillAddress(address, type));
}

/**
 * Format email address for Postal API format {address, name?}
 */
export function formatPostalAddress(address: EmailAddress): { address: string; name?: string } {
    return {
        address: address.email,
        ...address.name && { name: address.name },
    };
}

/**
 * Format email addresses for Postal API format
 */
export function formatPostalAddresses(addresses: EmailAddress | EmailAddress[]): { address: string; name?: string }[] {
    const addressList = Array.isArray(addresses) ? addresses : [addresses];

    return addressList.map(formatPostalAddress);
}

/**
 * Format email addresses for MailPace API format (formatted strings)
 */
export function formatMailpaceAddresses(addresses: EmailAddress | EmailAddress[]): string[] {
    const addressList = Array.isArray(addresses) ? addresses : [addresses];

    return addressList.map((address) => formatAddress(address));
}

export function formatZeptomailAddress(address: EmailAddress): { address: string; name?: string } {
    return {
        address: address.email,
        ...address.name && { name: address.name },
    };
}

export function formatZeptomailAddresses(addresses: EmailAddress | EmailAddress[]): { email_address: { address: string; name?: string } }[] {
    const addressList = Array.isArray(addresses) ? addresses : [addresses];

    return addressList.map((address) => {
        return {
            email_address: formatZeptomailAddress(address),
        };
    });
}
