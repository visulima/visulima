import type { EmailOptions, EmailResult, FeatureFlags, MaybePromise, Result } from "../types";

/**
 * Standard provider interface for email services
 */
export interface Provider<OptionsT = unknown, InstanceT = unknown, EmailOptionsT extends EmailOptions = EmailOptions> {
    features?: FeatureFlags;
    getEmail?: (id: string) => MaybePromise<Result<unknown>>;
    getInstance?: () => InstanceT;
    initialize: (options?: Record<string, unknown>) => MaybePromise<void>;

    isAvailable: () => MaybePromise<boolean>;
    name?: string;

    options?: OptionsT;
    sendEmail: (options: EmailOptionsT) => MaybePromise<Result<EmailResult>>;

    shutdown?: () => MaybePromise<void>;

    validateCredentials?: () => MaybePromise<boolean>;
}

/**
 * Type for provider factory function
 */
export type ProviderFactory<OptionsT = unknown, InstanceT = unknown, EmailOptionsT extends EmailOptions = EmailOptions> = (
    options?: OptionsT,
) => Provider<OptionsT, InstanceT, EmailOptionsT>;

/**
 * Helper function to define an email provider
 */
export const defineProvider = <OptionsT = unknown, InstanceT = unknown, EmailOptionsT extends EmailOptions = EmailOptions>(
    factory: ProviderFactory<OptionsT, InstanceT, EmailOptionsT>,
): ProviderFactory<OptionsT, InstanceT, EmailOptionsT> => factory;
