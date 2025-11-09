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

// Export providers
export {
    awsSesProvider,
    defineProvider,
    failoverProvider,
    httpProvider,
    mailCrabProvider,
    nodemailerProvider,
    resendProvider,
    roundRobinProvider,
    smtpProvider,
    zeptomailProvider,
    type Provider,
    type ProviderFactory,
} from "./providers/index.js";

// Export provider-specific types
export type { AwsSesEmailOptions } from "./providers/aws-ses/types.js";
export type { FailoverEmailOptions } from "./providers/failover/types.js";
export type { HttpEmailOptions } from "./providers/http/types.js";
export type { MailCrabEmailOptions } from "./providers/mailcrab/types.js";
export type { NodemailerEmailOptions } from "./providers/nodemailer/types.js";
export type { ResendEmailOptions, ResendEmailTag } from "./providers/resend/types.js";
export type { RoundRobinEmailOptions } from "./providers/roundrobin/types.js";
export type { SmtpEmailOptions } from "./providers/smtp/types.js";
export type { ZeptomailEmailOptions } from "./providers/zeptomail/types.js";

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
