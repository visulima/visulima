import type { BaseConfig, EmailOptions } from "../../types";

/**
 * Round Robin configuration
 */
export interface RoundRobinConfig extends BaseConfig {
    /**
     * Array of provider instances or provider factories to use for round-robin distribution
     * Can be Provider instances or ProviderFactory functions
     */
    mailers: unknown[];

    /**
     * Time in milliseconds to wait before retrying with next provider if current is unavailable (default: 60)
     */
    retryAfter?: number;
}

/**
 * Round Robin-specific email options
 */
export interface RoundRobinEmailOptions extends EmailOptions {
    // No additional options beyond base EmailOptions
}
