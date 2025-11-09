import type { BaseConfig, EmailOptions } from "../../types";

/**
 * Mailomat configuration
 */
export interface MailomatConfig extends BaseConfig {
    /**
     * Mailomat API key
     */
    apiKey: string;

    /**
     * Mailomat API endpoint
     * Defaults to: https://api.mailomat.com
     */
    endpoint?: string;
}

/**
 * Mailomat-specific email options
 */
export interface MailomatEmailOptions extends EmailOptions {
    /**
     * Tags for categorization
     */
    tags?: string[];

    /**
     * Mailomat template ID for template-based emails
     */
    templateId?: string;

    /**
     * Template variables for Mailomat templates
     */
    templateVariables?: Record<string, unknown>;
}
