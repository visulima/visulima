// Export types
export type {
    Attachment,
    AwsSesConfig,
    BaseConfig,
    EmailAddress,
    EmailOptions,
    EmailResult,
    EmailTag,
    FeatureFlags,
    FailoverConfig,
    HttpEmailConfig,
    MailCrabConfig,
    MaybePromise,
    NodemailerConfig,
    ResendConfig,
    Result,
    RoundRobinConfig,
    SmtpConfig,
    ZeptomailConfig,
} from "./types.js";

// Export core provider types (needed for Mail class)
export { defineProvider } from "./providers/provider.js";
export type { Provider, ProviderFactory } from "./providers/provider.js";

// Export Mail class and related
export { createMail, Mail, MailMessage, type Mailable } from "./mail.js";

// Export attachment helpers
export {
    detectMimeType,
    generateContentId,
    readFileAsBuffer,
    type AttachmentDataOptions,
    type AttachmentOptions,
} from "./attachment-helpers.js";

// Export template engine types
export type { TemplateRenderer } from "./template-engines/index.js";

// Export errors
export { EmailError, RequiredOptionError } from "./errors/email-error.js";

// Export utilities
export {
    buildMimeMessage,
    formatEmailAddress,
    formatEmailAddresses,
    generateBoundary,
    generateMessageId,
    isPortAvailable,
    makeRequest,
    retry,
    validateEmail,
    validateEmailOptions,
} from "./utils.js";
