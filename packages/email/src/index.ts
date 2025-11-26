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
    MaybePromise,
    Priority,
    Receipt,
    Result,
} from "./types";
export { default as buildMimeMessage } from "./utils/build-mime-message";
export { default as comparePriority } from "./utils/compare-priority";
export { default as createLogger } from "./utils/create-logger";
export { default as formatEmailAddress } from "./utils/format-email-address";
export { default as formatEmailAddresses } from "./utils/format-email-addresses";
export { default as generateBoundary } from "./utils/generate-boundary";
export { default as generateMessageId } from "./utils/generate-message-id";
export { default as headersToRecord } from "./utils/headers-to-record";
export { default as isPortAvailable } from "./utils/is-port-available";
export { makeRequest, type RequestOptions } from "./utils/make-request";
export { default as parseAddress } from "./utils/parse-address";
export { default as retry } from "./utils/retry";
export { default as validateEmail } from "./utils/validate-email";
export { default as validateEmailOptions } from "./utils/validate-email-options";
