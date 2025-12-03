import type { EmailOptions } from "../types";

/**
 * Options for DKIM signing
 */
export interface DkimOptions {
    /**
     * Body canonicalization algorithm ('simple' or 'relaxed')
     * Default: 'simple'
     */
    bodyCanon?: "relaxed" | "simple";

    /**
     * Domain name used for DKIM signing
     */
    domainName: string;

    /**
     * Header canonicalization algorithm ('simple' or 'relaxed')
     * Default: 'simple'
     */
    headerCanon?: "relaxed" | "simple";

    /**
     * List of header names to ignore when signing
     */
    headersToIgnore?: string[];

    /**
     * Key selector used for DNS lookup
     */
    keySelector: string;

    /**
     * Passphrase for the private key (if encrypted)
     */
    passphrase?: string;

    /**
     * Private key for signing (PEM format)
     * Can be a string with the key content or a path prefixed with 'file://'
     */
    privateKey: string;
}

/**
 * Options for S/MIME signing
 */
export interface SmimeSignOptions {
    /**
     * Path to the certificate file (PEM format)
     */
    certificate: string;

    /**
     * Path to intermediate certificates (optional)
     */
    intermediateCerts?: string[];

    /**
     * Signing options flags
     * Reserved for future use
     */
    options?: number;

    /**
     * Passphrase for the private key (if encrypted)
     */
    passphrase?: string;

    /**
     * Path to the private key file (PEM format)
     */
    privateKey: string;
}

/**
 * Options for S/MIME encryption
 */
export interface SmimeEncryptOptions {
    /**
     * Encryption algorithm (cipher)
     * Supported: 'aes-256-cbc', 'aes-192-cbc', 'aes-128-cbc'
     * Default: 'aes-256-cbc'
     */
    algorithm?: string;

    /**
     * Certificate(s) for encryption
     * Can be a single certificate path or a map of email -> certificate path
     */
    certificates: string | Record<string, string>;
}

/**
 * Interface for email signers
 */
export interface EmailSigner {
    /**
     * Sign an email message
     * @param email The email options to sign
     * @returns The signed email options (may include additional headers or modified content)
     */
    sign: (email: EmailOptions) => Promise<EmailOptions>;
}

/**
 * Interface for email encrypters
 */
export interface EmailEncrypter {
    /**
     * Encrypt an email message
     * @param email The email options to encrypt
     * @returns The encrypted email options (content will be encrypted)
     */
    encrypt: (email: EmailOptions) => Promise<EmailOptions>;
}
