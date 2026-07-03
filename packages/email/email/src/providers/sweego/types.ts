import type { BaseConfig, EmailOptions } from "../../types";

/**
 * Sweego configuration
 */
export interface SweegoConfig extends BaseConfig {
    /**
     * Sweego API key
     */
    apiKey: string;

    /**
     * Sweego API endpoint
     * Defaults to: https://api.sweego.com
     */
    endpoint?: string;
}

/**
 * Sweego-specific email options
 */
export interface SweegoEmailOptions extends EmailOptions {
    /**
     * Tags for categorization
     */
    tags?: string[];

    /**
     * Sweego template ID for template-based emails
     */
    templateId?: string;

    /**
     * Template variables for Sweego templates
     */
    templateVariables?: Record<string, unknown>;
}
