/**
 * Represents a single frame-based spinner animation
 */
export interface SpinnerFrame {
    /** Array of frame strings to display sequentially */
    frames: string[];
    /** Interval in milliseconds between frames */
    interval: number;
}

/**
 * Options for creating a Spinner instance
 */
export interface SpinnerOptions {
    /** Symbol to use on failure */
    failureSymbol?: string;
    /** Whether the spinner is enabled (allows for conditional use) */
    isEnabled?: boolean;
    /** Prefix to display before the spinner */
    prefixText?: string;
    /** Name of the spinner animation to use */
    spinner?: string;
    /** Stream to write output to (defaults to stdout) */
    stream?: NodeJS.WritableStream;
    /** Symbol to use on success */
    successSymbol?: string;
    /** Text to display alongside the spinner */
    text?: string;
    /** Symbol to use on warning */
    warningSymbol?: string;
}

/**
 * Represents the current state of the spinner.
 */
export type SpinnerStatus = "spinning" | "stopped" | "succeeded" | "failed" | "warned";
