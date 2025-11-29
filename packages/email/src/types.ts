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
 * Base configuration for all providers
 */
export interface BaseConfig {
    debug?: boolean;
    logger?: Console;
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
     * Attachment content (string, Buffer, or Promise&lt;Uint8Array> for async loading)
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
 * Represents the headers of an email message.
 * This type is a supertype of the standard `Headers` class, which is used to manage HTTP headers.
 * Note that this type does not include methods for modifying the headers,
 * such as `append`, `delete`, or `set`. It is intended to be used for
 * read-only access to the headers of an email message.
 */
export type ImmutableHeaders = Omit<Headers, "append" | "delete" | "set">;

/**
 * Email headers can be either a plain object or an ImmutableHeaders instance
 */
export type EmailHeaders = Record<string, string> | ImmutableHeaders;

/**
 * Options for calendar event attachments
 */
export interface CalendarEventOptions {
    /**
     * Alternative text for the calendar event
     */
    alternativeText?: string;

    /**
     * Method for the calendar event (e.g., 'REQUEST', 'CANCEL', 'REPLY')
     */
    method?: string;
}

/**
 * Common email options that all providers support
 */
export interface EmailOptions {
    attachments?: Attachment[];
    bcc?: EmailAddress | EmailAddress[];
    cc?: EmailAddress | EmailAddress[];

    from: EmailAddress;
    headers?: EmailHeaders;
    html?: string;
    icalEvent?: CalendarEventOptions & { content?: string; href?: string; path?: string };
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
export type Receipt
    = | {
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
         * Indicates that the email was sent successfully
         */
        readonly successful: true;

        /**
         * Timestamp when email was sent
         */
        readonly timestamp: Date;
    }
    | {
        /**
         * An array of error messages that occurred during the sending process
         */
        readonly errorMessages: ReadonlyArray<string>;

        /**
         * Optional provider name
         */
        readonly provider?: string;

        /**
         * Indicates that the email failed to send
         */
        readonly successful: false;
    };

/**
 * Generic result type
 */
export interface Result<T = unknown> {
    data?: T;
    error?: Error | unknown;
    success: boolean;
}
