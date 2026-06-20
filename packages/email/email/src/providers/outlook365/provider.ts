import EmailError from "../../errors/email-error";
import RequiredOptionError from "../../errors/required-option-error";
import type { EmailAddress, EmailResult, Result } from "../../types";
import generateMessageId from "../../utils/generate-message-id";
import { makeRequest } from "../../utils/make-request";
import retry from "../../utils/retry";
import validateEmailOptions from "../../utils/validation/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import { createProviderLogger, createStandardAttachment, handleProviderError, ProviderState } from "../utils";
import type { Outlook365Config, Outlook365EmailOptions } from "./types";

const PROVIDER_NAME = "outlook365";
const DEFAULT_ENDPOINT = "https://graph.microsoft.com/v1.0";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

const toAddressList = (addresses: EmailAddress | EmailAddress[]): EmailAddress[] => [addresses].flat();

const toGraphRecipients = (addresses: EmailAddress[]): { emailAddress: { address: string; name?: string } }[] =>
    addresses.map((address) => {
        return { emailAddress: { address: address.email, ...address.name ? { name: address.name } : {} } };
    });

/**
 * Outlook365 provider — sends email through the Microsoft Graph `sendMail` endpoint.
 */
const outlook365Provider: ProviderFactory<Outlook365Config> = defineProvider((config: Outlook365Config = {}) => {
    if (!config.accessToken && !config.getAccessToken) {
        throw new RequiredOptionError(PROVIDER_NAME, ["accessToken", "getAccessToken"]);
    }

    const options: Pick<Outlook365Config, "accessToken" | "getAccessToken" | "logger">
        & Required<Omit<Outlook365Config, "accessToken" | "getAccessToken" | "logger">> = {
            accessToken: config.accessToken,
            debug: config.debug ?? false,
            endpoint: config.endpoint ?? DEFAULT_ENDPOINT,
            getAccessToken: config.getAccessToken,
            logger: config.logger,
            retries: config.retries ?? DEFAULT_RETRIES,
            saveToSentItems: config.saveToSentItems ?? true,
            timeout: config.timeout ?? DEFAULT_TIMEOUT,
            userId: config.userId ?? "me",
        };

    const providerState = new ProviderState();
    const logger = createProviderLogger(PROVIDER_NAME, config.logger);

    const resolveToken = async (): Promise<string> => {
        if (options.getAccessToken) {
            return options.getAccessToken();
        }

        return options.accessToken as string;
    };

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
            return Boolean(options.accessToken ?? options.getAccessToken);
        },

        name: PROVIDER_NAME,

        options,

        async sendEmail(emailOptions: Outlook365EmailOptions): Promise<Result<EmailResult>> {
            try {
                const validationErrors = validateEmailOptions(emailOptions);

                if (validationErrors.length > 0) {
                    return { error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`), success: false };
                }

                let accessToken: string;

                try {
                    accessToken = await resolveToken();
                } catch (error) {
                    return { error: new EmailError(PROVIDER_NAME, "Failed to obtain access token", { cause: error }), success: false };
                }

                const message: Record<string, unknown> = {
                    body: { content: emailOptions.html ?? emailOptions.text ?? "", contentType: emailOptions.html ? "HTML" : "Text" },
                    subject: emailOptions.subject,
                    toRecipients: toGraphRecipients(toAddressList(emailOptions.to)),
                };

                if (emailOptions.cc) {
                    message.ccRecipients = toGraphRecipients(toAddressList(emailOptions.cc));
                }

                if (emailOptions.bcc) {
                    message.bccRecipients = toGraphRecipients(toAddressList(emailOptions.bcc));
                }

                if (emailOptions.replyTo) {
                    message.replyTo = toGraphRecipients(toAddressList(emailOptions.replyTo));
                }

                if (emailOptions.importance) {
                    message.importance = emailOptions.importance;
                }

                if (emailOptions.attachments && emailOptions.attachments.length > 0) {
                    message.attachments = await Promise.all(
                        emailOptions.attachments.map(async (attachment) => {
                            const standard = await createStandardAttachment(attachment, PROVIDER_NAME);

                            return {
                                "@odata.type": "#microsoft.graph.fileAttachment",
                                contentBytes: standard.content,
                                contentType: standard.contentType,
                                name: standard.filename,
                            };
                        }),
                    );
                }

                const userPath = options.userId === "me" ? "me" : `users/${options.userId}`;

                const result = await retry(
                    async () =>
                        makeRequest(
                            `${options.endpoint}/${userPath}/sendMail`,
                            {
                                headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                                method: "POST",
                                timeout: options.timeout,
                            },
                            JSON.stringify({ message, saveToSentItems: options.saveToSentItems }),
                        ),
                    options.retries,
                );

                if (!result.success) {
                    return { error: result.error ?? new EmailError(PROVIDER_NAME, "Failed to send email"), success: false };
                }

                // Graph sendMail returns 202 Accepted with an empty body — synthesise an id.
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

export default outlook365Provider;
