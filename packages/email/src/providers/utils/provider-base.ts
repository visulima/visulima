import EmailError from "../../errors/email-error";
import type { MaybePromise } from "../../types";
import createLogger from "../../utils/create-logger";

/**
 * Logger interface with debug, error, info, and warn methods
 */
type Logger = {
    debug: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
};

/**
 * Common provider configuration interface
 */
export interface BaseProviderConfig {
    debug?: boolean;
    logger?: Console;
    timeout?: number;
}

/**
 * Provider initialization state management
 */
export class ProviderState {
    private isInitialized = false;

    /**
     * Checks if the provider has been initialized.
     * @returns True if the provider is initialized, false otherwise.
     */
    public get initialized(): boolean {
        return this.isInitialized;
    }

    /**
     * Marks the provider as initialized.
     */
    public setInitialized(): void {
        this.isInitialized = true;
    }

    /**
     * Ensures the provider is initialized, initializing it if not already done.
     * @param initializeFunction The function to call for initialization.
     * @param providerName The name of the provider (for error messages).
     * @throws {EmailError} When initialization fails.
     */
    public async ensureInitialized(initializeFunction: () => MaybePromise<void>, providerName: string): Promise<void> {
        if (!this.isInitialized) {
            try {
                await initializeFunction();
                this.isInitialized = true;
            } catch (error) {
                throw new EmailError(providerName, `Failed to initialize: ${(error as Error).message}`, { cause: error as Error });
            }
        }
    }
}

/**
 * Creates a logger instance for a provider.
 * @param providerName The name of the provider (used as prefix in log messages).
 * @param customLogger Optional Console instance for logging output.
 * @returns A logger instance with debug, error, info, and warn methods.
 */
export const createProviderLogger = (providerName: string, customLogger?: Console): Logger => createLogger(providerName, customLogger);

/**
 * Checks if an HTTP response indicates success (2xx status codes).
 * @param result The result object containing response data and success status.
 * @param result.data The response data object.
 * @param result.success The success flag indicating if the request was successful.
 * @returns True if the response indicates success, false otherwise.
 */
export const isSuccessfulResponse = (result: { data?: unknown; success: boolean }): boolean => {
    if (!result.success || !result.data) {
        return false;
    }

    const data = result.data as { statusCode?: number };

    return typeof data.statusCode === "number" && data.statusCode >= 200 && data.statusCode < 300;
};

/**
 * Handles errors from provider operations and converts them to EmailError instances.
 * @param providerName The name of the provider where the error occurred.
 * @param operation The operation that failed.
 * @param error The error that occurred.
 * @param logger Optional logger instance for debug messages.
 * @returns An EmailError instance with appropriate error information.
 */
export const handleProviderError = (providerName: string, operation: string, error: unknown, logger?: Logger): EmailError => {
    const message = `Failed to ${operation}: ${(error as Error).message}`;

    if (logger) {
        logger.debug(`Exception ${operation}`, error);
    }

    return new EmailError(providerName, message, { cause: error as Error });
};
