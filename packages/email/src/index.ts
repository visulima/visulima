// Export types
export type {
    Attachment,
    AwsSesConfig,
    BaseConfig,
    EmailAddress,
    EmailOptions,
    EmailResult,
    EmailTag,
    ErrorOptions,
    FeatureFlags,
    HttpEmailConfig,
    MaybePromise,
    ResendConfig,
    Result,
    SmtpConfig,
    ZeptomailConfig,
} from "./types.js";

// Export providers
export {
    awsSesProvider,
    defineProvider,
    httpProvider,
    resendProvider,
    smtpProvider,
    zeptomailProvider,
    type Provider,
    type ProviderFactory,
} from "./providers/index.js";

// Export provider-specific types
export type { AwsSesEmailOptions } from "./providers/aws-ses/types.js";
export type { HttpEmailOptions } from "./providers/http/types.js";
export type { ResendEmailOptions, ResendEmailTag } from "./providers/resend/types.js";
export type { SmtpEmailOptions } from "./providers/smtp/types.js";
export type { ZeptomailEmailOptions } from "./providers/zeptomail/types.js";

// Export Mail class and related
export { createMail, Mail, MailMessage, type Mailable } from "./mail.js";

// Export utilities
export {
    buildMimeMessage,
    createError,
    createRequiredError,
    formatEmailAddress,
    formatEmailAddresses,
    generateBoundary,
    generateMessageId,
    makeRequest,
    retry,
    validateEmail,
    validateEmailOptions,
} from "./utils.js";
