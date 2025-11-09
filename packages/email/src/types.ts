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
    batchSending?: boolean;
    customHeaders?: boolean;
    html?: boolean;
    replyTo?: boolean;
    scheduling?: boolean;
    tagging?: boolean;
    templates?: boolean;
    tracking?: boolean;
}

/**
 * Logger interface for email package logging
 */
export interface Logger {
    debug: (message: string, ...args: unknown[]) => void;
    error?: (message: string, ...args: unknown[]) => void;
    info?: (message: string, ...args: unknown[]) => void;
    warn?: (message: string, ...args: unknown[]) => void;
}

/**
 * Base configuration for all providers
 */
export interface BaseConfig {
    debug?: boolean;
    logger?: Logger;
    retries?: number;
    timeout?: number;
}

/**
 * Email address with optional name
 */
export interface EmailAddress {
    email: string;
    name?: string;
}

/**
 * Email attachment
 */
export interface Attachment {
    /**
     * Content-ID for inline attachments (used in HTML with cid:)
     */
    cid?: string;

    /**
     * Attachment content (string, Buffer, or Promise<Uint8Array> for async loading)
     * Required if path, href, or raw are not provided
     */
    content?: string | Buffer | Promise<Uint8Array>;

    /**
     * Content disposition: 'attachment' (default) or 'inline'
     */
    contentDisposition?: "attachment" | "inline";

    /**
     * MIME type of the attachment
     */
    contentType?: string;

    /**
     * Content transfer encoding (e.g., 'base64', '7bit', 'quoted-printable')
     */
    encoding?: string;

    /**
     * Filename for the attachment
     */
    filename: string;

    /**
     * Custom headers for this attachment
     */
    headers?: Record<string, string>;

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
     * File path to read attachment from
     * Alternative to content
     */
    path?: string;

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
 * Priority levels for email messages
 */
export type Priority = "high" | "normal" | "low";

/**
 * Common email options that all providers support
 */
export interface EmailOptions {
    attachments?: Attachment[];
    bcc?: EmailAddress | EmailAddress[];
    cc?: EmailAddress | EmailAddress[];

    from: EmailAddress;
    headers?: Record<string, string>;
    html?: string;
    priority?: Priority;
    replyTo?: EmailAddress;
    subject: string;
    tags?: string[];

    text?: string;

    to: EmailAddress | EmailAddress[];
}

/**
 * Result of sending an email
 */
export interface EmailResult {
    messageId: string;
    provider?: string;
    response?: unknown;
    sent: boolean;
    timestamp: Date;
}

/**
 * Receipt type for email sending results
 * Uses discriminated union for type safety
 */
export type Receipt =
    | {
          /**
           * Indicates that the email was sent successfully
           */
          readonly successful: true;
          /**
           * The unique identifier for the message that was sent
           */
          readonly messageId: string;
          /**
           * Optional provider name
           */
          readonly provider?: string;
          /**
           * Optional response data from provider
           */
          readonly response?: unknown;
          /**
           * Timestamp when email was sent
           */
          readonly timestamp: Date;
      }
    | {
          /**
           * Indicates that the email failed to send
           */
          readonly successful: false;
          /**
           * An array of error messages that occurred during the sending process
           */
          readonly errorMessages: readonly string[];
          /**
           * Optional provider name
           */
          readonly provider?: string;
      };

/**
 * Generic result type
 */
export interface Result<T = unknown> {
    data?: T;
    error?: Error | unknown;
    success: boolean;
}

/**
 * AWS SES configuration
 */
export interface AwsSesConfig extends BaseConfig {
    accessKeyId: string;
    apiVersion?: string;
    endpoint?: string;
    maxAttempts?: number;
    region: string;
    secretAccessKey: string;
    sessionToken?: string;
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
export interface SmtpConfig extends BaseConfig {
    authMethod?: "LOGIN" | "PLAIN" | "CRAM-MD5" | "OAUTH2";
    dkim?: {
        domainName: string;
        keySelector: string;
        privateKey: string;
    };
    host: string;
    maxConnections?: number;
    oauth2?: {
        accessToken?: string;
        clientId: string;
        clientSecret: string;
        expires?: number;
        refreshToken: string;
        user: string;
    };
    password?: string;
    pool?: boolean;
    port: number;
    rejectUnauthorized?: boolean;
    secure?: boolean;
    user?: string;
}

/**
 * HTTP email configuration
 */
export interface HttpEmailConfig {
    apiKey?: string;
    endpoint: string;
    headers?: Record<string, string>;
    method?: "GET" | "POST" | "PUT";
}

/**
 * Zeptomail configuration
 */
export interface ZeptomailConfig extends BaseConfig {
    endpoint?: string;
    token: string;
}

/**
 * Failover configuration
 */
export interface FailoverConfig extends BaseConfig {
    /**
     * Array of provider instances or provider factories to use in failover order
     * Can be Provider instances or ProviderFactory functions
     */
    mailers: unknown[];

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
    mailers: unknown[];

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
     * Default from address (optional, can be overridden per email)
     */
    defaultFrom?: EmailAddress;

    /**
     * Nodemailer transport configuration
     * Can be a transport object or a transport name (e.g., 'smtp', 'sendmail')
     * For SMTP: { host, port, secure, auth: { user, pass } }
     * For Sendmail: { path: '/usr/sbin/sendmail' }
     * For SES: { SES: { ... } }
     * See: https://nodemailer.com/transports/
     */
    transport: Record<string, unknown> | string;
}
