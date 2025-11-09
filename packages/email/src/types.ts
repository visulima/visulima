import type { Buffer } from "node:buffer";

/**
 * Utility type for values that can be promises
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * Feature flags indicating what capabilities a provider supports
 */
export interface FeatureFlags {
    attachments?: boolean;
    html?: boolean;
    templates?: boolean;
    tracking?: boolean;
    customHeaders?: boolean;
    batchSending?: boolean;
    scheduling?: boolean;
    replyTo?: boolean;
    tagging?: boolean;
}

/**
 * Base configuration for all providers
 */
export interface BaseConfig {
    debug?: boolean;
    timeout?: number;
    retries?: number;
}

/**
 * Email address with optional name
 */
export interface EmailAddress {
    name?: string;
    email: string;
}

/**
 * Email attachment
 */
export interface Attachment {
    /**
     * Filename for the attachment
     */
    filename: string;

    /**
     * Attachment content (string or Buffer)
     * Required if path, href, or raw are not provided
     */
    content?: string | Buffer;

    /**
     * File path to read attachment from
     * Alternative to content
     */
    path?: string;

    /**
     * URL to fetch attachment from
     * Alternative to content or path
     */
    href?: string;

    /**
     * HTTP headers to use when fetching from href
     */
    httpHeaders?: Record<string, string>;

    /**
     * MIME type of the attachment
     */
    contentType?: string;

    /**
     * Content disposition: 'attachment' (default) or 'inline'
     */
    contentDisposition?: "attachment" | "inline";

    /**
     * Content-ID for inline attachments (used in HTML with cid:)
     */
    cid?: string;

    /**
     * Content transfer encoding (e.g., 'base64', '7bit', 'quoted-printable')
     */
    encoding?: string;

    /**
     * Custom headers for this attachment
     */
    headers?: Record<string, string>;

    /**
     * Raw attachment data (alternative to content)
     * Can be used for pre-encoded content
     */
    raw?: string | Buffer;
}

/**
 * Email tag for categorization
 */
export interface EmailTag {
    name: string;
    value: string;
}

/**
 * Common email options that all providers support
 */
export interface EmailOptions {
    // Required fields
    from: EmailAddress;
    to: EmailAddress | EmailAddress[];
    subject: string;

    // Optional fields - commonly supported
    text?: string;
    html?: string;
    cc?: EmailAddress | EmailAddress[];
    bcc?: EmailAddress | EmailAddress[];
    headers?: Record<string, string>;

    // File attachments - providers that don't support it will gracefully ignore
    attachments?: Attachment[];

    // Reply-to address - providers that don't support it will gracefully ignore
    replyTo?: EmailAddress;
}

/**
 * Result of sending an email
 */
export interface EmailResult {
    messageId: string;
    sent: boolean;
    timestamp: Date;
    provider?: string;
    response?: unknown;
}

/**
 * Generic result type
 */
export interface Result<T = unknown> {
    success: boolean;
    data?: T;
    error?: Error | unknown;
}


/**
 * AWS SES configuration
 */
export interface AwsSesConfig extends BaseConfig {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
    endpoint?: string;
    maxAttempts?: number;
    apiVersion?: string;
}

/**
 * Resend configuration
 */
export interface ResendConfig extends BaseConfig {
    apiKey: string;
    endpoint?: string;
}

/**
 * SMTP configuration
 */
export interface SmtpConfig {
    host: string;
    port: number;
    secure?: boolean;
    user?: string;
    password?: string;
    rejectUnauthorized?: boolean;
    pool?: boolean;
    maxConnections?: number;
    timeout?: number;
    dkim?: {
        domainName: string;
        keySelector: string;
        privateKey: string;
    };
    authMethod?: "LOGIN" | "PLAIN" | "CRAM-MD5" | "OAUTH2";
    oauth2?: {
        user: string;
        clientId: string;
        clientSecret: string;
        refreshToken: string;
        accessToken?: string;
        expires?: number;
    };
}

/**
 * HTTP email configuration
 */
export interface HttpEmailConfig {
    endpoint: string;
    apiKey?: string;
    method?: "GET" | "POST" | "PUT";
    headers?: Record<string, string>;
}

/**
 * Zeptomail configuration
 */
export interface ZeptomailConfig extends BaseConfig {
    token: string;
    endpoint?: string;
}

/**
 * Failover configuration
 */
export interface FailoverConfig extends BaseConfig {
    /**
     * Array of provider instances or provider factories to use in failover order
     * Can be Provider instances or ProviderFactory functions
     */
    mailers: Array<unknown>;

    /**
     * Time in milliseconds to wait before trying the next provider (default: 60)
     */
    retryAfter?: number;
}

/**
 * Round Robin configuration
 */
export interface RoundRobinConfig extends BaseConfig {
    /**
     * Array of provider instances or provider factories to use for round-robin distribution
     * Can be Provider instances or ProviderFactory functions
     */
    mailers: Array<unknown>;

    /**
     * Time in milliseconds to wait before retrying with next provider if current is unavailable (default: 60)
     */
    retryAfter?: number;
}

/**
 * MailCrab configuration (for local development/testing)
 */
export interface MailCrabConfig extends BaseConfig {
    /**
     * MailCrab host (default: localhost)
     */
    host?: string;

    /**
     * MailCrab port (default: 1025)
     */
    port?: number;

    /**
     * Use secure connection (default: false)
     */
    secure?: boolean;
}

/**
 * Nodemailer configuration
 * Accepts any nodemailer transport configuration
 * Common transports: SMTP, Sendmail, SES, etc.
 */
export interface NodemailerConfig extends BaseConfig {
    /**
     * Nodemailer transport configuration
     * Can be a transport object or a transport name (e.g., 'smtp', 'sendmail')
     * For SMTP: { host, port, secure, auth: { user, pass } }
     * For Sendmail: { path: '/usr/sbin/sendmail' }
     * For SES: { SES: { ... } }
     * See: https://nodemailer.com/transports/
     */
    transport: Record<string, unknown> | string;

    /**
     * Default from address (optional, can be overridden per email)
     */
    defaultFrom?: EmailAddress;
}
