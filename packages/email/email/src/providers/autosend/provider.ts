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
import { createProviderLogger, createStandardAttachment, handleProviderError, ProviderState } from "../utils";
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
const MAX_CUSTOM_HEADERS = 20;
const MAX_SUBJECT_LENGTH = 998;

/**
 * A recipient as AutoSend's API expects it: `{ email, name? }` rather than a formatted string.
 */
interface AutoSendRecipient {
    email: string;
    name?: string;
}

const toAddressList = (addresses: EmailAddress | EmailAddress[]): EmailAddress[] => [addresses].flat();

const toRecipient = (address: EmailAddress): AutoSendRecipient => {
    return { email: address.email, ...address.name ? { name: address.name } : {} };
};

const toRecipients = (addresses: EmailAddress | EmailAddress[]): AutoSendRecipient[] => toAddressList(addresses).map((address) => toRecipient(address));

/**
 * Maps an attachment to AutoSend's shape. AutoSend names the field `fileName` and takes the
 * payload base64-encoded in `content`.
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
 * Checks the message against AutoSend's documented limits.
 * @param emailOptions The message to check.
 * @returns A description of the first breached limit, or undefined when within limits.
 */
const checkLimits = (emailOptions: AutoSendEmailOptions): string | undefined => {
    // `/mails/send` takes a single `to`; the bulk endpoint is a different contract. Dropping the
    // extras silently is the one thing this provider must not do.
    if (Array.isArray(emailOptions.to) && emailOptions.to.length > 1) {
        return `AutoSend's send endpoint takes a single 'to' recipient, but ${String(emailOptions.to.length)} were given — use 'cc'/'bcc', or send one message per recipient`;
    }

    const recipientCount
        = toAddressList(emailOptions.to).length
            + (emailOptions.cc ? toAddressList(emailOptions.cc).length : 0)
            + (emailOptions.bcc ? toAddressList(emailOptions.bcc).length : 0);

    if (recipientCount > MAX_RECIPIENTS) {
        return `AutoSend allows at most ${String(MAX_RECIPIENTS)} recipients across to/cc/bcc, but ${String(recipientCount)} were given`;
    }

    if (emailOptions.attachments && emailOptions.attachments.length > MAX_ATTACHMENTS) {
        return `AutoSend allows at most ${String(MAX_ATTACHMENTS)} attachments, but ${String(emailOptions.attachments.length)} were given`;
    }

    if (emailOptions.subject.length > MAX_SUBJECT_LENGTH) {
        return `AutoSend allows a subject of at most ${String(MAX_SUBJECT_LENGTH)} characters, but ${String(emailOptions.subject.length)} were given`;
    }

    return undefined;
};

/**
 * Reads AutoSend's response envelope. A 2xx can still carry `success: false`, so the body decides.
 * @param body The parsed response body.
 * @returns The email id, or an error message when the send was rejected.
 */
const readSendResponse = (body: unknown): { emailId?: string; error?: string } => {
    if (typeof body !== "object" || body === null) {
        return { error: "AutoSend returned an unexpected response body" };
    }

    const payload = body as { data?: { emailId?: unknown }; error?: unknown; message?: unknown; success?: unknown };

    if (payload.success === false) {
        const reason = [payload.message, payload.error].find((value) => typeof value === "string");

        return { error: typeof reason === "string" ? reason : "AutoSend rejected the message" };
    }

    return { emailId: typeof payload.data?.emailId === "string" ? payload.data.emailId : undefined };
};

/**
 * AutoSend provider — sends through the [AutoSend send endpoint](https://docs.autosend.com/api-reference/mails/send).
 */
const autosendProvider: ProviderFactory<AutoSendConfig, unknown, AutoSendEmailOptions> = defineProvider<AutoSendConfig, unknown, AutoSendEmailOptions>(
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
                    const validationErrors = validateEmailOptions(emailOptions);

                    if (validationErrors.length > 0) {
                        return { error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`), success: false };
                    }

                    const limitError = checkLimits(emailOptions);

                    if (limitError) {
                        return { error: new EmailError(PROVIDER_NAME, limitError), success: false };
                    }

                    const payload: Record<string, unknown> = {
                        from: toRecipient(emailOptions.from),
                        subject: emailOptions.subject,
                        to: toRecipient(toAddressList(emailOptions.to)[0] as EmailAddress),
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
                        payload.cc = toRecipients(emailOptions.cc);
                    }

                    if (emailOptions.bcc) {
                        payload.bcc = toRecipients(emailOptions.bcc);
                    }

                    if (emailOptions.replyTo) {
                        payload.replyTo = toRecipient(emailOptions.replyTo);
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

                    if (emailOptions.headers) {
                        const headers = Object.entries(headersToRecord(emailOptions.headers));

                        if (headers.length > MAX_CUSTOM_HEADERS) {
                            return {
                                error: new EmailError(
                                    PROVIDER_NAME,
                                    `AutoSend allows at most ${String(MAX_CUSTOM_HEADERS)} custom headers, but ${String(headers.length)} were given`,
                                ),
                                success: false,
                            };
                        }

                        payload.headers = Object.fromEntries(headers.map(([key, value]) => [sanitizeHeaderName(key), sanitizeHeaderValue(value)]));
                    }

                    if (emailOptions.attachments && emailOptions.attachments.length > 0) {
                        payload.attachments = await Promise.all(emailOptions.attachments.map(async (attachment) => toAutoSendAttachment(attachment)));
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

                    if (!result.success) {
                        const { error: reason } = readSendResponse(responseBody);

                        return {
                            error: reason
                                ? new EmailError(PROVIDER_NAME, `Failed to send email: ${reason}`)
                                : result.error ?? new EmailError(PROVIDER_NAME, "Failed to send email"),
                            success: false,
                        };
                    }

                    // AutoSend answers 200 with `success: false` for a rejected message, so the
                    // envelope decides rather than the status code.
                    const { emailId, error: reason } = readSendResponse(responseBody);

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

export default autosendProvider;
