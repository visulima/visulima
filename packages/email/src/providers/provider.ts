import type { EmailOptions, EmailResult, FeatureFlags, MaybePromise, Result } from "../types.js";

/**
 * Standard provider interface for email services
 */
export interface Provider<
    OptionsT = unknown,
    InstanceT = unknown,
    EmailOptionsT extends EmailOptions = EmailOptions,
> {
    name?: string;
    features?: FeatureFlags;
    options?: OptionsT;
    getInstance?: () => InstanceT;

    // Core methods
    initialize: (opts?: Record<string, unknown>) => MaybePromise<void>;
    isAvailable: () => MaybePromise<boolean>;

    // Email-specific methods
    sendEmail: (options: EmailOptionsT) => MaybePromise<Result<EmailResult>>;
    validateCredentials?: () => MaybePromise<boolean>;

    // Optional method to get email details by ID
    getEmail?: (id: string) => MaybePromise<Result<unknown>>;
}

/**
 * Type for provider factory function
 */
export type ProviderFactory<
    OptionsT = unknown,
    InstanceT = unknown,
    EmailOptionsT extends EmailOptions = EmailOptions,
> = (opts?: OptionsT) => Provider<OptionsT, InstanceT, EmailOptionsT>;

/**
 * Helper function to define an email provider
 */
export const defineProvider = <
    OptionsT = unknown,
    InstanceT = unknown,
    EmailOptionsT extends EmailOptions = EmailOptions,
>(
    factory: ProviderFactory<OptionsT, InstanceT, EmailOptionsT>,
): ProviderFactory<OptionsT, InstanceT, EmailOptionsT> => {
    return factory;
};
