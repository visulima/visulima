export { type AttachmentDataOptions, type AttachmentOptions, detectMimeType, generateContentId, readFileAsBuffer } from "./attachment-helpers";
export { EmailError, RequiredOptionError } from "./errors/email-error";
export { createMail, Mail, type Mailable, MailMessage } from "./mail";
export type { Provider, ProviderFactory } from "./providers/provider";
export { defineProvider } from "./providers/provider";
export type { TemplateRenderer } from "./template-engines/types";
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
} from "./types";

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
} from "./utils";
