import type { BaseConfig, EmailOptions } from "../../types";

/**
 * Postal configuration
 */
export interface PostalConfig extends BaseConfig {
    /**
     * Postal server API key
     */
    apiKey: string;

    /**
     * Postal API endpoint
     * Defaults to: https://{host}/api/v1
     */
    endpoint?: string;

    /**
     * Postal server host
     */
    host: string;
}

/**
 * Postal-specific email options
 */
export interface PostalEmailOptions extends EmailOptions {
    /**
     * Postal message ID (for tracking)
     */
    postalMessageId?: string;

    /**
     * Tags for categorization
     */
    tags?: string[];

    /**
     * Postal template ID for template-based emails
     */
    templateId?: number;

    /**
     * Template variables for Postal templates
     */
    templateVariables?: Record<string, unknown>;
}
