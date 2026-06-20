import EmailError from "../../errors/email-error";
import RequiredOptionError from "../../errors/required-option-error";
import type { EmailAddress, EmailResult, Result } from "../../types";
import generateMessageId from "../../utils/generate-message-id";
import { makeRequest } from "../../utils/make-request";
import retry from "../../utils/retry";
import validateEmailOptions from "../../utils/validation/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import { createProviderLogger, createStandardAttachment, formatSendGridAddress, handleProviderError, ProviderState } from "../utils";
import type { SparkPostConfig, SparkPostEmailOptions } from "./types";

const PROVIDER_NAME = "sparkpost";
const DEFAULT_ENDPOINT = "https://api.sparkpost.com/api/v1";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

const toAddressList = (addresses: EmailAddress | EmailAddress[]): EmailAddress[] => [addresses].flat();

/**
 * SparkPost provider — sends email through the SparkPost Transmissions API.
 */
const sparkpostProvider: ProviderFactory<SparkPostConfig> = defineProvider((config: SparkPostConfig = {} as SparkPostConfig) => {
    if (!config.apiKey) {
        throw new RequiredOptionError(PROVIDER_NAME, "apiKey");
    }

    const options: Pick<SparkPostConfig, "logger"> & Required<Omit<SparkPostConfig, "logger">> = {
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
            batchSending: true,
            customHeaders: true,
            html: true,
            replyTo: true,
            scheduling: false,
            tagging: true,
            templates: true,
            tracking: true,
        },

        async initialize(): Promise<void> {
            await providerState.ensureInitialized(async () => {
                if (!await this.isAvailable()) {
                    throw new EmailError(PROVIDER_NAME, "SparkPost API not available or invalid API key");
                }

                logger.debug("Provider initialized successfully");
            }, PROVIDER_NAME);
        },

        // eslint-disable-next-line @typescript-eslint/require-await
        async isAvailable(): Promise<boolean> {
            return options.apiKey.length > 0;
        },

        name: PROVIDER_NAME,

        options,

        // eslint-disable-next-line sonarjs/cognitive-complexity
        async sendEmail(emailOptions: SparkPostEmailOptions): Promise<Result<EmailResult>> {
            try {
                const validationErrors = validateEmailOptions(emailOptions);

                if (validationErrors.length > 0) {
                    return { error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`), success: false };
                }

                await providerState.ensureInitialized(() => this.initialize(), PROVIDER_NAME);

                const toAddresses = toAddressList(emailOptions.to);
                const ccAddresses = emailOptions.cc ? toAddressList(emailOptions.cc) : [];
                const bccAddresses = emailOptions.bcc ? toAddressList(emailOptions.bcc) : [];

                // SparkPost lists every recipient flat; cc/bcc are distinguished by header_to + the CC header.
                const recipients = [
                    ...toAddresses.map((address) => {
                        return { address: formatSendGridAddress(address) };
                    }),
                    ...ccAddresses.map((address) => {
                        return { address: { ...formatSendGridAddress(address), header_to: toAddresses.map((to) => to.email).join(", ") } };
                    }),
                    ...bccAddresses.map((address) => {
                        return { address: { ...formatSendGridAddress(address), header_to: toAddresses.map((to) => to.email).join(", ") } };
                    }),
                ];

                const content: Record<string, unknown> = {
                    from: formatSendGridAddress(emailOptions.from),
                    subject: emailOptions.subject,
                };

                if (emailOptions.html) {
                    content.html = emailOptions.html;
                }

                if (emailOptions.text) {
                    content.text = emailOptions.text;
                }

                if (emailOptions.replyTo) {
                    const replyTo = toAddressList(emailOptions.replyTo)[0];

                    if (replyTo) {
                        content.reply_to = replyTo.email;
                    }
                }

                const headers: Record<string, string> = {};

                if (ccAddresses.length > 0) {
                    headers.CC = ccAddresses.map((address) => address.email).join(", ");
                }

                if (emailOptions.headers) {
                    for (const [key, value] of Object.entries(emailOptions.headers)) {
                        headers[key] = String(value);
                    }
                }

                if (Object.keys(headers).length > 0) {
                    content.headers = headers;
                }

                if (emailOptions.templateId) {
                    content.template_id = emailOptions.templateId;
                }

                if (emailOptions.attachments && emailOptions.attachments.length > 0) {
                    content.attachments = await Promise.all(
                        emailOptions.attachments.map(async (attachment) => {
                            const standard = await createStandardAttachment(attachment, PROVIDER_NAME);

                            return { data: standard.content, name: standard.filename, type: standard.contentType };
                        }),
                    );
                }

                const payload: Record<string, unknown> = { content, recipients };

                if (emailOptions.campaignId) {
                    payload.campaign_id = emailOptions.campaignId;
                }

                if (emailOptions.trackOpens !== undefined || emailOptions.trackClicks !== undefined) {
                    payload.options = { click_tracking: emailOptions.trackClicks ?? true, open_tracking: emailOptions.trackOpens ?? true };
                }

                const result = await retry(
                    async () =>
                        makeRequest(
                            `${options.endpoint}/transmissions`,
                            { headers: { Authorization: options.apiKey, "Content-Type": "application/json" }, method: "POST", timeout: options.timeout },
                            JSON.stringify(payload),
                        ),
                    options.retries,
                );

                if (!result.success) {
                    return { error: result.error ?? new EmailError(PROVIDER_NAME, "Failed to send email"), success: false };
                }

                const { body } = result.data as { body?: { results?: { id?: string } } };
                const messageId = body?.results?.id ?? generateMessageId();

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

export default sparkpostProvider;
