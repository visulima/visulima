export { type AttachmentDataOptions, type AttachmentOptions, detectMimeType, generateContentId, readFileAsBuffer } from "./attachment-helpers.js";
export { EmailError, RequiredOptionError } from "./errors/email-error.js";
export { createMail, Mail, type Mailable, MailMessage } from "./mail.js";
export type { Provider, ProviderFactory } from "./providers/provider.js";
export { defineProvider } from "./providers/provider.js";
export type { TemplateRenderer } from "./template-engines/index.js";
export type {
    Attachment,
    AwsSesConfig,
    BaseConfig,
    EmailAddress,
    EmailOptions,
    EmailResult,
    EmailTag,
    FailoverConfig,
    FeatureFlags,
    HttpEmailConfig,
    Logger,
    MailCrabConfig,
    MaybePromise,
    NodemailerConfig,
    ResendConfig,
    Result,
    RoundRobinConfig,
    SmtpConfig,
    ZeptomailConfig,
} from "./types.js";
export {
    buildMimeMessage,
    createLogger,
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
