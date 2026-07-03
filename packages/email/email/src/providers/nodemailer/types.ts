import type { BaseConfig, EmailAddress, EmailOptions } from "../../types";

/**
 * Nodemailer configuration
 * Accepts any nodemailer transport configuration
 * Common transports: SMTP, Sendmail, SES, etc.
 */
export interface NodemailerConfig extends BaseConfig {
    /**
     * Default from address (optional, can be overridden per email)
     */
    defaultFrom?: EmailAddress;

    /**
     * Nodemailer transport configuration
     * Can be a transport object or a transport name (e.g., 'smtp', 'sendmail')
     * For SMTP: { host, port, secure, auth: { user, pass } }
     * For Sendmail: { path: '/usr/sbin/sendmail' }
     * For SES: { SES: { ... } }
     * See: https://nodemailer.com/transports/
     */
    transport: Record<string, unknown> | string;
}

/**
 * Nodemailer-specific email options
 */
export interface NodemailerEmailOptions extends EmailOptions {
    /**
     * Override transport for this specific email
     */
    transportOverride?: Record<string, unknown> | string;
}
