import type { BaseConfig, EmailOptions } from "../../types";

/**
 * Infobip configuration
 */
export interface InfobipConfig extends BaseConfig {
    /**
     * Infobip API key
     */
    apiKey: string;

    /**
     * Infobip base URL (e.g., "https://api.infobip.com")
     */
    baseUrl?: string;

    /**
     * Infobip API endpoint
     * Defaults to: https://{baseUrl}/email/3/send
     */
    endpoint?: string;
}

/**
 * Infobip-specific email options
 */
export interface InfobipEmailOptions extends EmailOptions {
    /**
     * Intermediate report (for delivery status updates)
     */
    intermediateReport?: boolean;

    /**
     * Notify URL (for delivery notifications)
     */
    notifyUrl?: string;

    /**
     * Send at (Unix timestamp in milliseconds)
     */
    sendAt?: number;

    /**
     * Infobip template ID for template-based emails
     */
    templateId?: number;

    /**
     * Template variables for Infobip templates
     */
    templateVariables?: Record<string, unknown>;

    /**
     * Tracking URL (for click tracking)
     */
    trackingUrl?: string;
}
