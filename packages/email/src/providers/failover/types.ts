import type { BaseConfig, EmailOptions } from "../../types";

/**
 * Failover configuration
 */
export interface FailoverConfig extends BaseConfig {
    /**
     * Array of provider instances or provider factories to use in failover order
     * Can be Provider instances or ProviderFactory functions
     */
    mailers: unknown[];

    /**
     * Time in milliseconds to wait before trying the next provider (default: 60)
     */
    retryAfter?: number;
}

/**
 * Failover-specific email options
 */
export interface FailoverEmailOptions extends EmailOptions {
    // No additional options beyond base EmailOptions
}
