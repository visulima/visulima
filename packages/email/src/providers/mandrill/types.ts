import type { BaseConfig, EmailOptions } from "../../types";

/**
 * Mandrill configuration
 */
export interface MandrillConfig extends BaseConfig {
    /**
     * Mandrill API key
     */
    apiKey: string;

    /**
     * Mandrill API endpoint
     * Defaults to: https://mandrillapp.com/api/1.0
     */
    endpoint?: string;
}

/**
 * Mandrill-specific email options
 */
export interface MandrillEmailOptions extends EmailOptions {
    /**
     * Global merge variables
     */
    globalMergeVars?: {
        content: unknown;
        name: string;
    }[];

    /**
     * Google Analytics campaign
     */
    googleAnalyticsCampaign?: string;

    /**
     * Google Analytics domains
     */
    googleAnalyticsDomains?: string[];

    /**
     * Per-recipient merge variables
     */
    mergeVars?: {
        rcpt: string;
        vars: {
            content: unknown;
            name: string;
        }[];
    }[];

    /**
     * Metadata (key-value pairs)
     */
    metadata?: Record<string, string>;

    /**
     * Send at timestamp (ISO 8601 format)
     */
    sendAt?: string;

    /**
     * Subaccount ID
     */
    subaccount?: string;

    /**
     * Tags for categorization
     */
    tags?: string[];

    /**
     * Template content (for template-based emails)
     */
    templateContent?: {
        content: string;
        name: string;
    }[];

    /**
     * Mandrill template name
     */
    templateName?: string;

    /**
     * Template variables (merge vars)
     */
    templateVariables?: {
        content: unknown;
        name: string;
    }[];
}
