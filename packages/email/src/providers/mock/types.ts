import type { BaseConfig, EmailOptions, EmailResult, Receipt } from "../../types";

/**
 * Random delay range configuration
 */
export interface RandomDelayRange {
    min: number;
    max: number;
}

/**
 * Mock configuration for testing
 */
export interface MockConfig extends BaseConfig {
    /**
     * Whether to simulate failures (default: false)
     * When true, sendEmail will return an error
     */
    simulateFailure?: boolean;

    /**
     * Failure rate (0-1) for simulating random failures (default: 0)
     * 0 = never fail, 1 = always fail
     */
    failureRate?: number;

    /**
     * Delay in milliseconds before resolving (default: 0)
     * Useful for testing async behavior
     */
    delay?: number;

    /**
     * Random delay range in milliseconds
     * When set, delay will be randomly chosen between min and max
     */
    randomDelayRange?: RandomDelayRange;

    /**
     * Default response to return for send operations
     */
    defaultResponse?: Receipt;
}

/**
 * Mock-specific email options
 */
export interface MockEmailOptions extends EmailOptions {
    // No additional options beyond base EmailOptions
}

/**
 * Stored email entry in mock provider
 */
export interface MockEmailEntry {
    id: string;
    options: EmailOptions;
    result: EmailResult;
    timestamp: Date;
}

