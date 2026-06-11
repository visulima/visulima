import EmailError from "../../errors/email-error";
import RequiredOptionError from "../../errors/required-option-error";
import type { EmailResult, Result } from "../../types";
import buildMimeMessage from "../../utils/build-mime-message";
import generateMessageId from "../../utils/generate-message-id";
import headersToRecord from "../../utils/headers-to-record";
import validateEmailOptions from "../../utils/validation/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import { createProviderLogger, handleProviderError } from "../utils";
import type { CloudflareEmailConfig, CloudflareEmailOptions } from "./types";

const PROVIDER_NAME = "cloudflare-email";

/**
 * Cloudflare Email Workers provider — sends a raw RFC 822 message through a Worker's Email send
 * binding (supplied via {@link CloudflareEmailConfig.send}). Single-recipient only, per the binding.
 */
const cloudflareEmailProvider: ProviderFactory<CloudflareEmailConfig> = defineProvider((config: CloudflareEmailConfig = {} as CloudflareEmailConfig) => {
    if (typeof config.send !== "function") {
        throw new RequiredOptionError(PROVIDER_NAME, "send");
    }

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

        async initialize(): Promise<void> {
            // Nothing to initialize — the send binding is provided by the caller.
            await Promise.resolve();
        },

        // eslint-disable-next-line @typescript-eslint/require-await
        async isAvailable(): Promise<boolean> {
            return typeof config.send === "function";
        },

        name: PROVIDER_NAME,

        async sendEmail(emailOptions: CloudflareEmailOptions): Promise<Result<EmailResult>> {
            try {
                const validationErrors = validateEmailOptions(emailOptions);

                if (validationErrors.length > 0) {
                    return { error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`), success: false };
                }

                const toRecipients = Array.isArray(emailOptions.to) ? emailOptions.to : [emailOptions.to];

                if (toRecipients.length !== 1 || emailOptions.cc !== undefined || emailOptions.bcc !== undefined) {
                    // The Workers Email binding sends one envelope recipient; reject rather than silently drop.
                    return {
                        error: new EmailError(PROVIDER_NAME, "Cloudflare Email supports exactly one `to` recipient and does not support cc/bcc"),
                        success: false,
                    };
                }

                const [recipient] = toRecipients;

                if (!recipient) {
                    return { error: new EmailError(PROVIDER_NAME, "A single `to` recipient is required"), success: false };
                }

                const messageId = generateMessageId();
                const raw = await buildMimeMessage({
                    ...emailOptions,
                    headers: { ...emailOptions.headers ? headersToRecord(emailOptions.headers) : {}, "Message-ID": messageId },
                });

                await config.send(emailOptions.from.email, recipient.email, raw);

                return {
                    data: { messageId, provider: PROVIDER_NAME, sent: true, timestamp: new Date() },
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

export default cloudflareEmailProvider;
