import type { EmailResult, MailCrabConfig, Result } from "../../types.js";
import type { ProviderFactory } from "../provider.js";
import { defineProvider } from "../provider.js";
import { smtpProvider } from "../smtp/index.js";
import type { MailCrabEmailOptions } from "./types.js";

// Constants
const PROVIDER_NAME = "mailcrab";
const DEFAULT_HOST = "localhost";
const DEFAULT_PORT = 1025;

/**
 * MailCrab Provider for local email testing
 * MailCrab is a local SMTP server for testing emails during development
 * This is a convenience wrapper around the SMTP provider with MailCrab defaults
 */
export const mailCrabProvider: ProviderFactory<MailCrabConfig, unknown, MailCrabEmailOptions> = defineProvider(
    (options_: MailCrabConfig = {} as MailCrabConfig) => {
        const options: Pick<MailCrabConfig, "timeout" | "retries" | "logger"> & Required<Omit<MailCrabConfig, "timeout" | "retries" | "logger">> = {
            debug: options_.debug || false,
            host: options_.host || DEFAULT_HOST,
            logger: options_.logger,
            port: options_.port || DEFAULT_PORT,
            retries: options_.retries,
            secure: options_.secure ?? false,
            timeout: options_.timeout,
        };

        const smtp = smtpProvider({
            debug: options.debug,
            host: options.host,
            logger: options.logger,
            port: options.port,
            retries: options.retries,
            secure: options.secure,
            timeout: options.timeout,
        });

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

            /**
             * Initialize the MailCrab provider (delegates to SMTP provider)
             */
            async initialize(): Promise<void> {
                await smtp.initialize();
            },

            /**
             * Check if MailCrab is available (delegates to SMTP provider)
             */
            async isAvailable(): Promise<boolean> {
                return smtp.isAvailable();
            },

            name: PROVIDER_NAME,

            options,

            /**
             * Send email through MailCrab (delegates to SMTP provider)
             */
            async sendEmail(emailOptions: MailCrabEmailOptions): Promise<Result<EmailResult>> {
                const result = await smtp.sendEmail(emailOptions);

                if (result.success && result.data) {
                    return {
                        data: {
                            ...result.data,
                            provider: PROVIDER_NAME,
                        },
                        success: true,
                    };
                }

                return result;
            },

            /**
             * Validate MailCrab credentials (delegates to SMTP provider)
             */
            async validateCredentials(): Promise<boolean> {
                return smtp.validateCredentials?.() ?? false;
            },
        };
    },
);
