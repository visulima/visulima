import type { BaseConfig, EmailOptions } from "../../types";

/**
 * SendGrid configuration
 */
export interface SendGridConfig extends BaseConfig {
    apiKey: string;
    endpoint?: string;
}

/**
 * SendGrid-specific email options
 */
export interface SendGridEmailOptions extends EmailOptions {
    /**
     * ASM (Advanced Suppression Management) group ID for unsubscribe
     */
    asmGroupId?: number;

    /**
     * Batch ID for batch sending
     */
    batchId?: string;

    /**
     * IP pool name
     */
    ipPoolName?: string;

    /**
     * Mail settings (click tracking, open tracking, etc.)
     */
    mailSettings?: {
        bypassListManagement?: boolean;
        footer?: {
            enable?: boolean;
            html?: string;
            text?: string;
        };
        sandboxMode?: boolean;
    };

    /**
     * Send at timestamp (Unix timestamp)
     */
    sendAt?: number;

    /**
     * Dynamic template data for SendGrid dynamic templates
     */
    templateData?: Record<string, unknown>;

    /**
     * SendGrid template ID for template-based emails
     */
    templateId?: string;

    /**
     * Tracking settings
     */
    trackingSettings?: {
        clickTracking?: {
            enable?: boolean;
            enableText?: boolean;
        };
        ganalytics?: {
            enable?: boolean;
            utmCampaign?: string;
            utmContent?: string;
            utmMedium?: string;
            utmSource?: string;
            utmTerm?: string;
        };
        openTracking?: {
            enable?: boolean;
            substitutionTag?: string;
        };
        subscriptionTracking?: {
            enable?: boolean;
            html?: string;
            substitutionTag?: string;
            text?: string;
        };
    };
}
