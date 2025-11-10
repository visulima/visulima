import type { BaseConfig, EmailOptions } from "../../types";

/**
 * Plunk configuration
 */
export interface PlunkConfig extends BaseConfig {
    apiKey: string;
    endpoint?: string;
}

/**
 * Plunk-specific email options
 */
export interface PlunkEmailOptions extends EmailOptions {
    /**
     * Data to pass to the email template
     */
    data?: Record<string, unknown>;

    /**
     * Subscriber email (used for tracking and analytics)
     * If not provided, uses the first 'to' address
     */
    subscriber?: string;

    /**
     * Subscriber ID (optional identifier for the subscriber)
     */
    subscriberId?: string;

    /**
     * Template ID for template-based emails
     */
    templateId?: string;
}
