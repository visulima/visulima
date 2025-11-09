import type { BaseConfig, EmailOptions } from "../../types";

/**
 * Mailgun configuration
 */
export interface MailgunConfig extends BaseConfig {
    /**
     * Mailgun API key
     */
    apiKey: string;

    /**
     * Mailgun domain (required for sending emails)
     */
    domain: string;

    /**
     * Mailgun API endpoint
     * Defaults to US endpoint: https://api.mailgun.net
     * Use https://api.eu.mailgun.net for EU accounts
     */
    endpoint?: string;
}

/**
 * Mailgun-specific email options
 */
export interface MailgunEmailOptions extends EmailOptions {
    /**
     * Campaign ID for tracking
     */
    campaignId?: string;

    /**
     * Enable/disable click tracking
     */
    clickTracking?: boolean;

    /**
     * Delivery time (Unix timestamp or RFC 2822 date)
     */
    deliveryTime?: string | number;

    /**
     * Enable/disable open tracking
     */
    openTracking?: boolean;

    /**
     * Require TLS
     */
    requireTls?: boolean;

    /**
     * Skip verification
     */
    skipVerification?: boolean;

    /**
     * Mailgun tags for categorization
     */
    tags?: string[];

    /**
     * Mailgun template name
     */
    template?: string;

    /**
     * Template variables for Mailgun templates
     */
    templateVariables?: Record<string, unknown>;

    /**
     * Test mode - emails won't actually be sent
     */
    testMode?: boolean;

    /**
     * Enable/disable unsubscribe tracking
     */
    unsubscribeTracking?: boolean;
}
