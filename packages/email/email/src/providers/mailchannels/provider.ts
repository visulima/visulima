import EmailError from "../../errors/email-error";
import RequiredOptionError from "../../errors/required-option-error";
import type { EmailResult, Result } from "../../types";
import generateMessageId from "../../utils/generate-message-id";
import headersToRecord from "../../utils/headers-to-record";
import { makeRequest } from "../../utils/make-request";
import retry from "../../utils/retry";
import validateEmailOptions from "../../utils/validation/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import { createProviderLogger, createStandardAttachment, formatSendGridAddress, formatSendGridAddresses, handleProviderError, ProviderState } from "../utils";
import type { MailChannelsConfig, MailChannelsEmailOptions } from "./types";

const PROVIDER_NAME = "mailchannels";
const DEFAULT_ENDPOINT = "https://api.mailchannels.net/tx/v1/send";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * MailChannels provider — sends through the MailChannels Email API (a SendGrid-shaped payload).
 */
const mailchannelsProvider: ProviderFactory<MailChannelsConfig> = defineProvider((config: MailChannelsConfig = {} as MailChannelsConfig) => {
    if (!config.apiKey) {
        throw new RequiredOptionError(PROVIDER_NAME, "apiKey");
    }

    const options: Pick<MailChannelsConfig, "logger"> & Required<Omit<MailChannelsConfig, "logger">> = {
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
            batchSending: false,
            customHeaders: true,
            html: true,
            replyTo: true,
            scheduling: false,
            tagging: false,
            templates: false,
            tracking: false,
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

        async sendEmail(emailOptions: MailChannelsEmailOptions): Promise<Result<EmailResult>> {
            try {
                const validationErrors = validateEmailOptions(emailOptions);

                if (validationErrors.length > 0) {
                    return { error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`), success: false };
                }

                const content: { type: string; value: string }[] = [];

                if (emailOptions.text) {
                    content.push({ type: "text/plain", value: emailOptions.text });
                }

                if (emailOptions.html) {
                    content.push({ type: "text/html", value: emailOptions.html });
                }

                const personalization: Record<string, unknown> = { to: formatSendGridAddresses(emailOptions.to) };

                if (emailOptions.cc) {
                    personalization.cc = formatSendGridAddresses(emailOptions.cc);
                }

                if (emailOptions.bcc) {
                    personalization.bcc = formatSendGridAddresses(emailOptions.bcc);
                }

                const payload: Record<string, unknown> = {
                    content,
                    from: formatSendGridAddress(emailOptions.from),
                    personalizations: [personalization],
                    subject: emailOptions.subject,
                };

                if (emailOptions.replyTo) {
                    payload.reply_to = formatSendGridAddress(emailOptions.replyTo);
                }

                if (emailOptions.headers) {
                    payload.headers = headersToRecord(emailOptions.headers);
                }

                if (emailOptions.attachments && emailOptions.attachments.length > 0) {
                    payload.attachments = await Promise.all(
                        emailOptions.attachments.map(async (attachment) => {
                            const standard = await createStandardAttachment(attachment, PROVIDER_NAME);

                            return { content: standard.content, filename: standard.filename, type: standard.contentType };
                        }),
                    );
                }

                const result = await retry(
                    async () =>
                        makeRequest(
                            options.endpoint,
                            { headers: { "Content-Type": "application/json", "X-Api-Key": options.apiKey }, method: "POST", timeout: options.timeout },
                            JSON.stringify(payload),
                        ),
                    options.retries,
                );

                if (!result.success) {
                    return { error: result.error ?? new EmailError(PROVIDER_NAME, "Failed to send email"), success: false };
                }

                const { body } = result.data as { body?: { message_id?: string; request_id?: string } };
                const messageId = body?.message_id ?? body?.request_id ?? generateMessageId();

                return {
                    data: { messageId, provider: PROVIDER_NAME, response: result.data, sent: true, timestamp: new Date() },
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
});

export default mailchannelsProvider;
