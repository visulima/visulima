import EmailError from "../../errors/email-error";
import RequiredOptionError from "../../errors/required-option-error";
import type { Attachment, EmailAddress, EmailResult, Result } from "../../types";
import headersToRecord from "../../utils/headers-to-record";
import { makeRequest } from "../../utils/make-request";
import retry from "../../utils/retry";
import { sanitizeHeaderName, sanitizeHeaderValue } from "../../utils/sanitize-header";
import validateEmailOptions from "../../utils/validation/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import { createProviderLogger, createStandardAttachment, formatSendGridAddress, formatSendGridAddresses, handleProviderError, ProviderState } from "../utils";
import type { AutoSendConfig, AutoSendEmailOptions } from "./types";

const PROVIDER_NAME = "autosend";
const DEFAULT_ENDPOINT = "https://api.autosend.com/v1";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * AutoSend limits, enforced before the request so the caller gets a precise error instead of a
 * generic rejection. See https://docs.autosend.com/api-reference/mails/send.
 */
const MAX_RECIPIENTS = 50;
const MAX_ATTACHMENTS = 20;
const MAX_ATTACHMENT_BYTES = 40 * 1024 * 1024;
const MAX_CUSTOM_HEADERS = 20;
const MAX_HEADER_VALUE_LENGTH = 1000;
const MAX_SUBJECT_LENGTH = 998;

/**
 * Header names AutoSend accepts — anything else is rejected by the API. Quoted separately for
 * error messages, since the compiled source reads `[A-Z0-9-]` + `i` and would imply that
 * lowercase is rejected.
 */
const HEADER_NAME_PATTERN = /^[A-Z0-9-]{1,76}$/i;
const HEADER_NAME_RULE = "^[A-Za-z0-9-]{1,76}$";

/**
 * `validateEmailOptions` requires a text or html body, which a template-only message legitimately
 * has neither of — AutoSend renders the body server-side from `templateId`.
 */
const CONTENT_REQUIRED_ERROR = "Either text or html content is required";

const toAddressList = (addresses: EmailAddress | EmailAddress[]): EmailAddress[] => [addresses].flat();

/**
 * Maps an attachment to AutoSend's shape.
 * @param attachment The visulima attachment.
 * @returns The payload entry for AutoSend's `attachments` array.
 */
const toAutoSendAttachment = async (attachment: Attachment): Promise<Record<string, string>> => {
    const standard = await createStandardAttachment(attachment, PROVIDER_NAME);

    return {
        content: standard.content,
        contentType: standard.contentType,
        fileName: standard.filename,
    };
};

/**
 * Checks a message against AutoSend's documented limits.
 * @param emailOptions The message to check.
 * @param headers The message's headers, already flattened to a record.
 * @returns A description of the first breached limit, or undefined when within limits.
 */

const checkLimits = (emailOptions: AutoSendEmailOptions, headers: Record<string, string>): string | undefined => {
    // `/mails/send` takes exactly one `to`; the bulk endpoint is a different contract. Silently
    // dropping the extras is the one thing this provider must not do. `!== 1` also catches the
    // empty array, which validateEmailOptions lets through since `[]` is truthy.
    const recipients = toAddressList(emailOptions.to);

    if (recipients.length !== 1) {
        return `AutoSend's send endpoint takes exactly one 'to' recipient, but ${String(recipients.length)} were given — use 'cc'/'bcc', or send one message per recipient`;
    }

    const recipientCount
        = recipients.length + (emailOptions.cc ? toAddressList(emailOptions.cc).length : 0) + (emailOptions.bcc ? toAddressList(emailOptions.bcc).length : 0);

    if (recipientCount > MAX_RECIPIENTS) {
        return `AutoSend allows at most ${String(MAX_RECIPIENTS)} recipients across to/cc/bcc, but ${String(recipientCount)} were given`;
    }

    if (emailOptions.attachments && emailOptions.attachments.length > MAX_ATTACHMENTS) {
        return `AutoSend allows at most ${String(MAX_ATTACHMENTS)} attachments, but ${String(emailOptions.attachments.length)} were given`;
    }

    // AutoSend has no contentId field, so a `cid:` reference can never resolve. Sending anyway
    // would report success and render a broken image.
    const inlineAttachment = emailOptions.attachments?.find((attachment) => attachment.cid);

    if (inlineAttachment) {
        return `AutoSend does not support inline (cid) attachments, but '${inlineAttachment.filename}' sets one — host the image and reference it by URL instead`;
    }

    if (emailOptions.subject.length > MAX_SUBJECT_LENGTH) {
        return `AutoSend allows a subject of at most ${String(MAX_SUBJECT_LENGTH)} characters, but ${String(emailOptions.subject.length)} were given`;
    }

    const headerNames = Object.keys(headers);

    if (headerNames.length > MAX_CUSTOM_HEADERS) {
        return `AutoSend allows at most ${String(MAX_CUSTOM_HEADERS)} custom headers, but ${String(headerNames.length)} were given`;
    }

    const invalidName = headerNames.find((name) => !HEADER_NAME_PATTERN.test(name));

    if (invalidName !== undefined) {
        return `AutoSend header names must match ${HEADER_NAME_RULE}, but '${invalidName}' does not`;
    }

    const oversizedHeader = headerNames.find((name) => (headers[name] as string).length > MAX_HEADER_VALUE_LENGTH);

    if (oversizedHeader !== undefined) {
        return `AutoSend allows header values of at most ${String(MAX_HEADER_VALUE_LENGTH)} characters, but '${oversizedHeader}' is longer`;
    }

    return undefined;
};

/**
 * Reads AutoSend's response envelope.
 *
 * `reason` is set only when the body actually explains a failure — an absent or non-JSON body
 * yields neither field, so the caller falls back to the transport error rather than reporting a
 * timeout or a gateway's HTML error page as an unexpected body.
 *
 * The vendor does not document its error shape, so any human-readable `message` / `error` is
 * taken rather than keying strictly on `success: false`.
 * @param body The parsed response body.
 * @returns The email id on success, or the reason the message was rejected.
 */
const readSendResponse = (body: unknown): { emailId?: string; reason?: string } => {
    if (typeof body !== "object" || body === null) {
        return {};
    }

    const payload = body as { data?: { emailId?: unknown }; error?: unknown; message?: unknown; success?: unknown };

    if (payload.success === true) {
        return { emailId: typeof payload.data?.emailId === "string" ? payload.data.emailId : undefined };
    }

    const reason = [payload.message, payload.error].find((value) => typeof value === "string");

    return { reason: typeof reason === "string" ? reason : undefined };
};

/**
 * AutoSend provider — sends through the [AutoSend send endpoint](https://docs.autosend.com/api-reference/mails/send).
 */
const autoSendProvider: ProviderFactory<AutoSendConfig, unknown, AutoSendEmailOptions> = defineProvider<AutoSendConfig, unknown, AutoSendEmailOptions>(
    (config: AutoSendConfig = {} as AutoSendConfig) => {
        if (!config.apiKey) {
            throw new RequiredOptionError(PROVIDER_NAME, "apiKey");
        }

        const options: Pick<AutoSendConfig, "logger"> & Required<Omit<AutoSendConfig, "logger">> = {
            apiKey: config.apiKey,
            debug: config.debug ?? false,
            endpoint: config.endpoint ?? DEFAULT_ENDPOINT,
            logger: config.logger,
            retries: config.retries ?? DEFAULT_RETRIES,
            timeout: config.timeout ?? DEFAULT_TIMEOUT,
        };

        const providerState = new ProviderState();
        const logger = createProviderLogger(PROVIDER_NAME, config.logger);

        return {
            features: {
                attachments: true,
                // `/mails/bulk` exists, but the Provider contract has no batch hook — Mail.sendBatch
                // fans out to sendEmail, which is the single-send endpoint.
                batchSending: false,
                customHeaders: true,
                html: true,
                replyTo: true,
                scheduling: false,
                tagging: false,
                templates: true,
                tracking: true,
            },

            // eslint-disable-next-line @typescript-eslint/require-await
            async initialize(): Promise<void> {
                providerState.setInitialized();
            },

            // eslint-disable-next-line @typescript-eslint/require-await
            async isAvailable(): Promise<boolean> {
                return options.apiKey.length > 0;
            },

            name: PROVIDER_NAME,

            options,

            /**
             * Sends an email through the AutoSend API.
             * @param emailOptions The email options, including AutoSend-specific fields.
             * @returns The send result.
             */
            // eslint-disable-next-line sonarjs/cognitive-complexity
            async sendEmail(emailOptions: AutoSendEmailOptions): Promise<Result<EmailResult>> {
                try {
                    // A template-only message has no body of its own — AutoSend renders it from
                    // `templateId`, so the shared "text or html required" rule doesn't apply.
                    const validationErrors = validateEmailOptions(emailOptions).filter(
                        (error) => !(emailOptions.templateId !== undefined && error === CONTENT_REQUIRED_ERROR),
                    );

                    if (validationErrors.length > 0) {
                        return { error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`), success: false };
                    }

                    const headers = emailOptions.headers ? headersToRecord(emailOptions.headers) : {};
                    const limitError = checkLimits(emailOptions, headers);

                    if (limitError) {
                        return { error: new EmailError(PROVIDER_NAME, limitError), success: false };
                    }

                    const payload: Record<string, unknown> = {
                        from: formatSendGridAddress(emailOptions.from),
                        subject: emailOptions.subject,
                        to: formatSendGridAddress(toAddressList(emailOptions.to)[0] as EmailAddress),
                    };

                    // templateId renders server-side and replaces html/text entirely.
                    if (emailOptions.templateId) {
                        payload.templateId = emailOptions.templateId;
                    } else {
                        if (emailOptions.html) {
                            payload.html = emailOptions.html;
                        }

                        if (emailOptions.text) {
                            payload.text = emailOptions.text;
                        }
                    }

                    if (emailOptions.cc) {
                        payload.cc = formatSendGridAddresses(emailOptions.cc);
                    }

                    if (emailOptions.bcc) {
                        payload.bcc = formatSendGridAddresses(emailOptions.bcc);
                    }

                    if (emailOptions.replyTo) {
                        payload.replyTo = formatSendGridAddress(emailOptions.replyTo);
                    }

                    if (emailOptions.dynamicData) {
                        payload.dynamicData = emailOptions.dynamicData;
                    }

                    if (emailOptions.unsubscribeGroupId) {
                        payload.unsubscribeGroupId = emailOptions.unsubscribeGroupId;
                    }

                    if (emailOptions.trackingClick !== undefined) {
                        payload.trackingClick = emailOptions.trackingClick;
                    }

                    if (emailOptions.trackingOpen !== undefined) {
                        payload.trackingOpen = emailOptions.trackingOpen;
                    }

                    if (emailOptions.bypassSuppressions !== undefined) {
                        payload.bypassSuppressions = emailOptions.bypassSuppressions;
                    }

                    if (Object.keys(headers).length > 0) {
                        payload.headers = Object.fromEntries(
                            Object.entries(headers).map(([key, value]) => [sanitizeHeaderName(key), sanitizeHeaderValue(value)]),
                        );
                    }

                    if (emailOptions.attachments && emailOptions.attachments.length > 0) {
                        const attachments = await Promise.all(emailOptions.attachments.map(async (attachment) => toAutoSendAttachment(attachment)));

                        // Only measurable once encoded, so this cannot live with the other limits.
                        const encodedBytes = attachments.reduce((total, attachment) => total + (attachment.content as string).length, 0);

                        if (encodedBytes > MAX_ATTACHMENT_BYTES) {
                            return {
                                error: new EmailError(
                                    PROVIDER_NAME,
                                    `AutoSend allows at most ${String(MAX_ATTACHMENT_BYTES)} bytes of attachments after Base64 encoding, but this message carries ${String(encodedBytes)}`,
                                ),
                                success: false,
                            };
                        }

                        payload.attachments = attachments;
                    }

                    const result = await retry(
                        async () =>
                            makeRequest(
                                `${options.endpoint}/mails/send`,
                                {
                                    headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
                                    method: "POST",
                                    timeout: options.timeout,
                                },
                                JSON.stringify(payload),
                            ),
                        options.retries,
                    );

                    const responseBody = (result.data as { body?: unknown } | undefined)?.body;
                    const { emailId, reason } = readSendResponse(responseBody);

                    if (!result.success) {
                        // Prefer the vendor's explanation; fall back to the transport error, which
                        // carries the status code / timeout and the cause chain.
                        return {
                            error: reason
                                ? new EmailError(PROVIDER_NAME, `Failed to send email: ${reason}`)
                                : result.error ?? new EmailError(PROVIDER_NAME, "Failed to send email"),
                            success: false,
                        };
                    }

                    // AutoSend answers 200 with `success: false` for a rejected message, so the
                    // envelope decides rather than the status code.
                    if (reason) {
                        return { error: new EmailError(PROVIDER_NAME, `Failed to send email: ${reason}`), success: false };
                    }

                    if (!emailId) {
                        return { error: new EmailError(PROVIDER_NAME, "AutoSend accepted the message but returned no emailId"), success: false };
                    }

                    logger.debug(`Email queued successfully: ${emailId}`);

                    return {
                        data: { messageId: emailId, provider: PROVIDER_NAME, response: responseBody, sent: true, timestamp: new Date() },
                        success: true,
                    };
                } catch (error) {
                    return { error: handleProviderError(PROVIDER_NAME, "send email", error, logger), success: false };
                }
            },

            async validateCredentials(): Promise<boolean> {
                return this.isAvailable();
            },
        };
    },
);

export default autoSendProvider;
