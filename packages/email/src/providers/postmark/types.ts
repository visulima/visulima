import type { BaseConfig, EmailOptions } from "../../types";

/**
 * Postmark configuration
 */
export interface PostmarkConfig extends BaseConfig {
    /**
     * Postmark API endpoint
     * Defaults to: https://api.postmarkapp.com
     */
    endpoint?: string;

    /**
     * Postmark Server API Token
     */
    serverToken: string;
}

/**
 * Postmark-specific email options
 */
export interface PostmarkEmailOptions extends EmailOptions {
    /**
     * Inline CSS for HTML emails
     */
    inlineCss?: boolean;

    /**
     * Message stream ID
     */
    messageStream?: string;

    /**
     * Metadata (key-value pairs)
     */
    metadata?: Record<string, string>;

    /**
     * Postmark template alias (alternative to templateId)
     */
    templateAlias?: string;

    /**
     * Postmark template ID for template-based emails
     */
    templateId?: number;

    /**
     * Template model/variables for Postmark templates
     */
    templateModel?: Record<string, unknown>;

    /**
     * Track links
     */
    trackLinks?: "HtmlAndText" | "HtmlOnly" | "TextOnly" | "None";

    /**
     * Track opens
     */
    trackOpens?: boolean;
}
