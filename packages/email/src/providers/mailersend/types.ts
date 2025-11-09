import type { BaseConfig, EmailOptions } from "../../types";

/**
 * MailerSend configuration
 */
export interface MailerSendConfig extends BaseConfig {
    /**
     * MailerSend API token
     */
    apiToken: string;

    /**
     * MailerSend API endpoint
     * Defaults to: https://api.mailersend.com
     */
    endpoint?: string;
}

/**
 * MailerSend-specific email options
 */
export interface MailerSendEmailOptions extends EmailOptions {
    /**
     * Domain ID (optional, for domain-specific sending)
     */
    domainId?: string;

    /**
     * Personalization (per-recipient variables)
     */
    personalization?: {
        data: Record<string, unknown>;
        email: string;
    }[];

    /**
     * Scheduled at (Unix timestamp)
     */
    scheduledAt?: number;

    /**
     * Tags for categorization
     */
    tags?: string[];

    /**
     * MailerSend template ID for template-based emails
     */
    templateId?: string;

    /**
     * Template variables for MailerSend templates
     */
    templateVariables?: Record<string, unknown>;
}
