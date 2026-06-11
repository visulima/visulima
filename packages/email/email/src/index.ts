export { type AttachmentDataOptions, type AttachmentOptions, detectMimeType, generateContentId, readFileAsBuffer } from "./attachment-helpers";
export { default as DraftMailMessage } from "./draft-mail-message";
export { default as EmailError } from "./errors/email-error";
export { default as RequiredOptionError } from "./errors/required-option-error";
export {
    type BatchBase,
    type BatchRenderer,
    createMail,
    type FeatureCheckMode,
    Mail,
    type MailGlobalConfig,
    type MailOptions,
    type Personalization,
    type SendableMessage,
    type SendBatchOptions,
} from "./mail";
export { default as MailMessage } from "./mail-message";
export type { Middleware, SendFunction } from "./middleware/types";
export type { Provider, ProviderFactory } from "./providers/provider";
export { defineProvider } from "./providers/provider";
export type { TemplateRenderer } from "./template-engines/types";
export type {
    Attachment,
    BaseConfig,
    CalendarEventOptions,
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
export { default as parseEml } from "./utils/parse-eml";
export type { OkResult } from "./utils/result";
export { isErr, isOk, mapOk, tryAsync, unwrap, unwrapOr } from "./utils/result";
export { default as checkFeatureSupport, type FeatureSupportResult, type FeatureViolation } from "./utils/validation/check-feature-support";
