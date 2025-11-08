import type { EmailOptions } from "../../types.js";

/**
 * SMTP-specific email options
 */
export interface SmtpEmailOptions extends EmailOptions {
    // No additional options beyond base EmailOptions
}
