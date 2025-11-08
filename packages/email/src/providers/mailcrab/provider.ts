import type { EmailResult, Result } from "../../types.js";
import type { MailCrabConfig } from "../../types.js";
import type { ProviderFactory } from "../provider.js";
import type { MailCrabEmailOptions } from "./types.js";
import { smtpProvider } from "../smtp/index.js";
import { defineProvider } from "../provider.js";

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
    (opts: MailCrabConfig = {} as MailCrabConfig) => {
        // Initialize with MailCrab defaults
        const options: Required<MailCrabConfig> = {
            host: opts.host || DEFAULT_HOST,
            port: opts.port || DEFAULT_PORT,
            secure: opts.secure ?? false,
            debug: opts.debug || false,
        };

        // Create underlying SMTP provider with MailCrab configuration
        const smtp = smtpProvider({
            host: options.host,
            port: options.port,
            secure: options.secure,
            debug: options.debug,
        });

        return {
            name: PROVIDER_NAME,
            features: {
                attachments: true,
                html: true,
                templates: false,
                tracking: false,
                customHeaders: true,
                batchSending: false,
                tagging: false,
                scheduling: false,
                replyTo: true,
            },
            options,

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

            /**
             * Send email through MailCrab (delegates to SMTP provider)
             */
            async sendEmail(emailOpts: MailCrabEmailOptions): Promise<Result<EmailResult>> {
                const result = await smtp.sendEmail(emailOpts);
                if (result.success && result.data) {
                    return {
                        success: true,
                        data: {
                            ...result.data,
                            provider: PROVIDER_NAME,
                        },
                    };
                }
                return result;
            },

            /**
             * Validate MailCrab credentials (delegates to SMTP provider)
             */
            async validateCredentials(): Promise<boolean> {
                return smtp.validateCredentials();
            },
        };
    },
);
