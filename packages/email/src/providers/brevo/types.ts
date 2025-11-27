import type { BaseConfig, EmailAddress, EmailOptions } from "../../types";

/**
 * Brevo configuration
 */
export interface BrevoConfig extends BaseConfig {
    /**
     * Brevo API key
     */
    apiKey: string;

    /**
     * Brevo API endpoint
     * Defaults to: https://api.brevo.com/v3
     */
    endpoint?: string;
}

/**
 * Brevo-specific email options
 */
export interface BrevoEmailOptions extends EmailOptions {
    /**
     * Batch ID for batch sending
     */
    batchId?: string;

    /**
     * Headers (custom headers)
     */
    headers?: Record<string, string>;

    /**
     * Reply-to email address (can override base replyTo)
     */
    replyTo?: EmailAddress;

    /**
     * Scheduled date/time
     * - If string: ISO 8601 format (e.g., "2025-01-15T10:00:00Z")
     * - If number: Unix timestamp in seconds (not milliseconds)
     */
    scheduledAt?: string | number;

    /**
     * Tags for categorization
     */
    tags?: string[];

    /**
     * Brevo template ID for template-based emails
     */
    templateId?: number;

    /**
     * Template parameters for Brevo templates
     */
    templateParams?: Record<string, unknown>;
}
