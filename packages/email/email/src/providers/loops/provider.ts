import EmailError from "../../errors/email-error";
import RequiredOptionError from "../../errors/required-option-error";
import type { EmailResult, Result } from "../../types";
import generateMessageId from "../../utils/generate-message-id";
import { makeRequest } from "../../utils/make-request";
import retry from "../../utils/retry";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import { createProviderLogger, createStandardAttachment, handleProviderError, ProviderState } from "../utils";
import type { LoopsConfig, LoopsEmailOptions } from "./types";

const PROVIDER_NAME = "loops";
const DEFAULT_ENDPOINT = "https://app.loops.so/api/v1/transactional";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * Loops provider — sends transactional template emails through the Loops API.
 */
const loopsProvider: ProviderFactory<LoopsConfig> = defineProvider((config: LoopsConfig = {} as LoopsConfig) => {
    if (!config.apiKey) {
        throw new RequiredOptionError(PROVIDER_NAME, "apiKey");
    }

    const options: Pick<LoopsConfig, "defaultTransactionalId" | "logger"> & Required<Omit<LoopsConfig, "defaultTransactionalId" | "logger">> = {
        apiKey: config.apiKey,
        debug: config.debug ?? false,
        defaultTransactionalId: config.defaultTransactionalId,
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
            customHeaders: false,
            html: false,
            replyTo: false,
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

        async sendEmail(emailOptions: LoopsEmailOptions): Promise<Result<EmailResult>> {
            try {
                const transactionalId = emailOptions.transactionalId ?? options.defaultTransactionalId;

                if (!transactionalId) {
                    return { error: new EmailError(PROVIDER_NAME, "Loops requires a `transactionalId` (on the message or as `defaultTransactionalId`)"), success: false };
                }

                const recipient = Array.isArray(emailOptions.to) ? emailOptions.to[0] : emailOptions.to;

                if (!recipient) {
                    return { error: new EmailError(PROVIDER_NAME, "A `to` recipient is required"), success: false };
                }

                const payload: Record<string, unknown> = { email: recipient.email, transactionalId };

                if (emailOptions.dataVariables) {
                    payload.dataVariables = emailOptions.dataVariables;
                }

                if (emailOptions.addToAudience) {
                    payload.addToAudience = true;
                }

                if (emailOptions.attachments && emailOptions.attachments.length > 0) {
                    payload.attachments = await Promise.all(
                        emailOptions.attachments.map(async (attachment) => {
                            const standard = await createStandardAttachment(attachment, PROVIDER_NAME);

                            return { contentType: standard.contentType, data: standard.content, filename: standard.filename };
                        }),
                    );
                }

                const result = await retry(
                    async () =>
                        makeRequest(
                            options.endpoint,
                            { headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" }, method: "POST", timeout: options.timeout },
                            JSON.stringify(payload),
                        ),
                    options.retries,
                );

                if (!result.success) {
                    return { error: result.error ?? new EmailError(PROVIDER_NAME, "Failed to send email"), success: false };
                }

                return {
                    data: { messageId: generateMessageId(), provider: PROVIDER_NAME, response: result.data, sent: true, timestamp: new Date() },
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

export default loopsProvider;
