import type { EmailOptions } from "../../types";

/**
 * HTTP-specific email options
 */
export interface HttpEmailOptions extends EmailOptions {
    /**
     * Custom parameters to include in the request payload
     */
    customParams?: Record<string, unknown>;

    /**
     * Override the endpoint for this specific email
     */
    endpointOverride?: string;

    /**
     * Override the HTTP method for this specific email
     */
    methodOverride?: "GET" | "POST" | "PUT";
}
