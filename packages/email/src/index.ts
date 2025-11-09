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
export { buildMimeMessage } from "./utils/build-mime-message";
export { comparePriority } from "./utils/compare-priority";
export { createLogger } from "./utils/create-logger";
export { formatEmailAddress } from "./utils/format-email-address";
export { formatEmailAddresses } from "./utils/format-email-addresses";
export { generateBoundary } from "./utils/generate-boundary";
export { generateMessageId } from "./utils/generate-message-id";
export { headersToRecord } from "./utils/headers-to-record";
export { isPortAvailable } from "./utils/is-port-available";
export { makeRequest, type RequestOptions } from "./utils/make-request";
export { parseAddress } from "./utils/parse-address";
export { retry } from "./utils/retry";
export { validateEmail } from "./utils/validate-email";
export { validateEmailOptions } from "./utils/validate-email-options";
