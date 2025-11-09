import type { BaseConfig, EmailOptions } from "../../types";

/**
 * Mailjet configuration
 */
export interface MailjetConfig extends BaseConfig {
    /**
     * Mailjet API Key
     */
    apiKey: string;

    /**
     * Mailjet API Secret
     */
    apiSecret: string;

    /**
     * Mailjet API endpoint
     * Defaults to: https://api.mailjet.com
     */
    endpoint?: string;
}

/**
 * Mailjet-specific email options
 */
export interface MailjetEmailOptions extends EmailOptions {
    /**
     * Custom campaign name
     */
    campaign?: string;

    /**
     * Custom ID for tracking
     */
    customId?: string;

    /**
     * Deduplicate campaign (prevent duplicate emails)
     */
    deduplicateCampaign?: boolean;

    /**
     * Delivery time (Unix timestamp)
     */
    deliveryTime?: number;

    /**
     * Event payload (for webhooks)
     */
    eventPayload?: string;

    /**
     * Priority (1-5, where 1 is highest)
     */
    priority?: number;

    /**
     * Mailjet template ID for template-based emails
     */
    templateId?: number;

    /**
     * Template language (for multilingual templates)
     */
    templateLanguage?: boolean;

    /**
     * Template variables for Mailjet templates
     */
    templateVariables?: Record<string, unknown>;

    /**
     * URL tags (for tracking)
     */
    urlTags?: Record<string, string>;
}
