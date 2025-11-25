import { EmailError } from "../../errors/email-error";
import type { Logger, MaybePromise } from "../../types";
import { createLogger } from "../../utils/create-logger";
import { makeRequest } from "../../utils/make-request";

/**
 * Common provider configuration interface
 */
export interface BaseProviderConfig {
    debug?: boolean;
    logger?: Logger;
    timeout?: number;
}

/**
 * Provider initialization state management
 */
export class ProviderState {
    private isInitialized = false;

    /**
     * Check if provider is initialized
     */
    get initialized(): boolean {
        return this.isInitialized;
    }

    /**
     * Mark provider as initialized
     */
    setInitialized(): void {
        this.isInitialized = true;
    }

    /**
     * Ensure provider is initialized, initialize if not
     */
    async ensureInitialized(initializeFunction: () => MaybePromise<void>, providerName: string): Promise<void> {
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
 * Create a logger for a provider
 */
export function createProviderLogger(providerName: string, debug?: boolean, customLogger?: Logger): Logger {
    return createLogger(providerName, debug, customLogger);
}

/**
 * Check if an HTTP response indicates success (2xx status codes)
 */
export function isSuccessfulResponse(result: { data?: unknown; success: boolean }): boolean {
    if (!result.success || !result.data) {
        return false;
    }

    const data = result.data as { statusCode?: number };

    return typeof data.statusCode === "number" && data.statusCode >= 200 && data.statusCode < 300;
}

/**
 * Standard availability check for API-based providers
 */
export async function checkApiAvailability(
    endpoint: string,
    headers: Record<string, string>,
    logger: Logger,
    providerName: string,
    timeout = 30_000,
): Promise<boolean> {
    try {
        logger.debug("Checking API availability");

        const result = await makeRequest(endpoint, {
            headers,
            method: "GET",
            timeout,
        });

        logger.debug("API availability check response:", {
            error: result.error?.message,
            statusCode: (result.data as { statusCode?: number })?.statusCode,
            success: result.success,
        });

        return isSuccessfulResponse(result);
    } catch (error) {
        logger.debug("Error checking availability:", error);

        return false;
    }
}

/**
 * Standard credential validation for API-based providers
 */
export async function validateApiCredentials(
    endpoint: string,
    headers: Record<string, string>,
    logger: Logger,
    providerName: string,
    timeout = 30_000,
): Promise<boolean> {
    try {
        const result = await makeRequest(endpoint, {
            headers,
            method: "GET",
            timeout,
        });

        return isSuccessfulResponse(result);
    } catch {
        return false;
    }
}

/**
 * Standard error handling for provider operations
 */
export function handleProviderError(providerName: string, operation: string, error: unknown, logger?: Logger): EmailError {
    const message = `Failed to ${operation}: ${(error as Error).message}`;

    if (logger) {
        logger.debug(`Exception ${operation}`, error);
    }

    return new EmailError(providerName, message, { cause: error as Error });
}
