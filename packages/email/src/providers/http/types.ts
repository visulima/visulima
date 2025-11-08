import type { EmailOptions } from "../../types.js";

/**
 * HTTP-specific email options
 */
export interface HttpEmailOptions extends EmailOptions {
    /**
     * Custom parameters to include in the request payload
     */
    customParams?: Record<string, unknown>;
}
