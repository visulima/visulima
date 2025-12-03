import type { BaseConfig, EmailOptions } from "../../types";

/**
 * MailCrab configuration (for local development/testing)
 */
export interface MailCrabConfig extends BaseConfig {
    /**
     * MailCrab host (default: localhost)
     */
    host?: string;

    /**
     * MailCrab port (default: 1025)
     */
    port?: number;

    /**
     * Use secure connection (default: false)
     */
    secure?: boolean;
}

/**
 * MailCrab-specific email options
 */
export type MailCrabEmailOptions = EmailOptions;
