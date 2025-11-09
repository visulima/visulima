export { type AttachmentDataOptions, type AttachmentOptions, detectMimeType, generateContentId, readFileAsBuffer } from "./attachment-helpers";
export { EmailError, RequiredOptionError } from "./errors/email-error";
export { createMail, Mail, type Mailable, MailMessage } from "./mail";
export type { Provider, ProviderFactory } from "./providers/provider";
export { defineProvider } from "./providers/provider";
export type { TemplateRenderer } from "./template-engines/types";
export type {
    Attachment,
    BaseConfig,
    EmailAddress,
    EmailHeaders,
    EmailOptions,
    EmailResult,
    EmailTag,
    FeatureFlags,
    ImmutableHeaders,
    Logger,
    MaybePromise,
    Priority,
    Receipt,
    Result,
} from "./types";

export {
    buildMimeMessage,
    comparePriority,
    createLogger,
    formatEmailAddress,
    formatEmailAddresses,
    generateBoundary,
    generateMessageId,
    headersToRecord,
    isPortAvailable,
    makeRequest,
    parseAddress,
    retry,
    validateEmail,
    validateEmailOptions,
} from "./utils";
