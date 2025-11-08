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
    filename: string;
    content: string | Buffer;
    contentType?: string;
    disposition?: string;
    cid?: string;
    path?: string;
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
    error?: Error;
}

/**
 * Error options
 */
export interface ErrorOptions {
    cause?: Error;
    code?: string;
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
