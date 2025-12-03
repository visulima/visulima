import type { EmailResult, Result } from "../../types";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import { smtpProvider } from "../smtp/index";
import type { MailCrabConfig, MailCrabEmailOptions } from "./types";

// Constants
const PROVIDER_NAME = "mailcrab";
const DEFAULT_HOST = "localhost";
const DEFAULT_PORT = 1025;

/**
 * MailCrab Provider for local email testing
 * MailCrab is a local SMTP server for testing emails during development
 * This is a convenience wrapper around the SMTP provider with MailCrab defaults
 */
const mailCrabProvider: ProviderFactory<MailCrabConfig, unknown, MailCrabEmailOptions> = defineProvider((config: MailCrabConfig = {} as MailCrabConfig) => {
    const options: Pick<MailCrabConfig, "timeout" | "retries" | "logger"> & Required<Omit<MailCrabConfig, "timeout" | "retries" | "logger">> = {
        debug: config.debug ?? false,
        host: config.host || DEFAULT_HOST,
        logger: config.logger,
        port: config.port || DEFAULT_PORT,
        retries: config.retries,
        secure: config.secure ?? false,
        timeout: config.timeout,
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
         * Initializes the MailCrab provider (delegates to SMTP provider).
         */
        async initialize(): Promise<void> {
            await smtp.initialize();
        },

        /**
         * Checks if MailCrab is available (delegates to SMTP provider).
         * @returns True if MailCrab is available, false otherwise.
         */
        async isAvailable(): Promise<boolean> {
            return smtp.isAvailable();
        },

        name: PROVIDER_NAME,

        options,

        /**
         * Sends an email through MailCrab (delegates to SMTP provider).
         * @param emailOptions The email options to send.
         * @returns A result object containing the email result or an error.
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
         * Validates MailCrab credentials (delegates to SMTP provider).
         * @returns A promise that resolves to true if credentials are valid, false otherwise.
         */
        async validateCredentials(): Promise<boolean> {
            return smtp.validateCredentials?.() ?? false;
        },
    };
});

export default mailCrabProvider;
