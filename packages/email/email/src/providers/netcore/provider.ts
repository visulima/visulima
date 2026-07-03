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
import type { NetcoreConfig, NetcoreEmailOptions } from "./types";

const PROVIDER_NAME = "netcore";
const DEFAULT_ENDPOINT = "https://emailapi.netcorecloud.net/v5.1";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

const toAddressList = (addresses: EmailAddress | EmailAddress[]): EmailAddress[] => [addresses].flat();

/**
 * Netcore (Pepipost) provider — sends email through the Netcore Email API (v5.1).
 */
const netcoreProvider: ProviderFactory<NetcoreConfig> = defineProvider((config: NetcoreConfig = {} as NetcoreConfig) => {
    if (!config.apiKey) {
        throw new RequiredOptionError(PROVIDER_NAME, "apiKey");
    }

    const options: Pick<NetcoreConfig, "logger"> & Required<Omit<NetcoreConfig, "logger">> = {
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
                    throw new EmailError(PROVIDER_NAME, "Netcore API not available or invalid API key");
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
        async sendEmail(emailOptions: NetcoreEmailOptions): Promise<Result<EmailResult>> {
            try {
                const validationErrors = validateEmailOptions(emailOptions);

                if (validationErrors.length > 0) {
                    return { error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`), success: false };
                }

                await providerState.ensureInitialized(() => this.initialize(), PROVIDER_NAME);

                const personalization: Record<string, unknown> = {
                    to: toAddressList(emailOptions.to).map((address) => formatSendGridAddress(address)),
                };

                if (emailOptions.cc) {
                    personalization.cc = toAddressList(emailOptions.cc).map((address) => formatSendGridAddress(address));
                }

                if (emailOptions.bcc) {
                    personalization.bcc = toAddressList(emailOptions.bcc).map((address) => formatSendGridAddress(address));
                }

                const payload: Record<string, unknown> = {
                    from: formatSendGridAddress(emailOptions.from),
                    personalizations: [personalization],
                    subject: emailOptions.subject,
                };

                if (emailOptions.templateId) {
                    payload.template_id = emailOptions.templateId;

                    if (emailOptions.templateData) {
                        personalization.attributes = emailOptions.templateData;
                    }
                } else {
                    const content: { type: string; value: string }[] = [];

                    if (emailOptions.html) {
                        content.push({ type: "html", value: emailOptions.html });
                    }

                    if (emailOptions.text) {
                        content.push({ type: "plain", value: emailOptions.text });
                    }

                    if (content.length > 0) {
                        payload.content = content;
                    }
                }

                if (emailOptions.replyTo) {
                    const replyTo = toAddressList(emailOptions.replyTo)[0];

                    if (replyTo) {
                        payload.reply_to = replyTo.email;
                    }
                }

                if (emailOptions.attachments && emailOptions.attachments.length > 0) {
                    payload.attachments = await Promise.all(
                        emailOptions.attachments.map(async (attachment) => {
                            const standard = await createStandardAttachment(attachment, PROVIDER_NAME);

                            return { content: standard.content, name: standard.filename };
                        }),
                    );
                }

                const result = await retry(
                    async () =>
                        makeRequest(
                            `${options.endpoint}/mail/send`,
                            { headers: { api_key: options.apiKey, "Content-Type": "application/json" }, method: "POST", timeout: options.timeout },
                            JSON.stringify(payload),
                        ),
                    options.retries,
                );

                if (!result.success) {
                    return { error: result.error ?? new EmailError(PROVIDER_NAME, "Failed to send email"), success: false };
                }

                const { body } = result.data as { body?: { data?: { message_id?: string }; message_id?: string } };
                const messageId = body?.data?.message_id ?? body?.message_id ?? generateMessageId();

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

export default netcoreProvider;
