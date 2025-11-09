import type { EmailOptions } from "../../types";

/**
 * Nodemailer-specific email options
 */
export interface NodemailerEmailOptions extends EmailOptions {
    /**
     * Override transport for this specific email
     */
    transportOverride?: Record<string, unknown> | string;
}
