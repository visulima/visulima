import type { BaseConfig, EmailOptions } from "../../types";

/**
 * MailPace configuration
 */
export interface MailPaceConfig extends BaseConfig {
    /**
     * MailPace API token
     */
    apiToken: string;

    /**
     * MailPace API endpoint
     * Defaults to: https://app.mailpace.com/api/v1
     */
    endpoint?: string;
}

/**
 * MailPace-specific email options
 */
export interface MailPaceEmailOptions extends Omit<EmailOptions, "attachments"> {
    /**
     * Attachments (MailPace specific format)
     */
    attachments?: {
        content: string;
        content_type?: string;
        name: string;
    }[];

    /**
     * List unsubscribe header
     */
    listUnsubscribe?: string;

    /**
     * Tags for categorization
     */
    tags?: string[];

    /**
     * MailPace template ID for template-based emails
     */
    templateId?: number;

    /**
     * Template variables for MailPace templates
     */
    templateVariables?: Record<string, unknown>;
}
