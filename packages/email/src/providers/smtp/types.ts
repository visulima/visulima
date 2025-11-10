import type { BaseConfig, EmailAddress, EmailOptions } from "../../types";

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
 * SMTP-specific email options
 */
export interface SmtpEmailOptions extends EmailOptions {
    /**
     * Delivery Status Notification options
     */
    dsn?: {
        /** Request notification on delay */
        delay?: boolean;
        /** Request notification on failure */
        failure?: boolean;
        /** Request successful delivery notification */
        success?: boolean;
    };

    /** Special Google Mail headers */
    googleMailHeaders?: {
        /** Category for email organization */
        category?: "primary" | "social" | "promotions" | "updates" | "forums";

        /** Feedback ID for engagement tracking */
        feedbackId?: string;

        /** Mark as promotional content */
        promotionalContent?: boolean;
    };

    /** Reference to a previous message ID (for threading) */
    inReplyTo?: string;

    /** List-Unsubscribe header for easy unsubscribe functionality */
    listUnsubscribe?: string | string[];

    /** Message priority: 'high', 'normal', or 'low' */
    priority?: "high" | "normal" | "low";

    /** References to related message IDs */
    references?: string | string[];

    /** Whether to sign the email with DKIM */
    useDkim?: boolean;
}
