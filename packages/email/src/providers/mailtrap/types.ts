import type { BaseConfig, EmailOptions } from "../../types";

/**
 * Mailtrap configuration
 */
export interface MailtrapConfig extends BaseConfig {
    /**
     * Mailtrap API token
     */
    apiToken: string;

    /**
     * Mailtrap API endpoint
     * Defaults to: https://send.api.mailtrap.io
     */
    endpoint?: string;
}

/**
 * Mailtrap-specific email options
 */
export interface MailtrapEmailOptions extends EmailOptions {
    /**
     * Category for categorization
     */
    category?: string;

    /**
     * Custom variables (key-value pairs)
     */
    customVariables?: Record<string, unknown>;

    /**
     * Mailtrap template UUID for template-based emails
     */
    templateUuid?: string;

    /**
     * Template variables for Mailtrap templates
     */
    templateVariables?: Record<string, unknown>;
}
