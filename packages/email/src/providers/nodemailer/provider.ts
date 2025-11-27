import nodemailerModule from "nodemailer";

import EmailError from "../../errors/email-error";
import RequiredOptionError from "../../errors/required-option-error";
import type { EmailAddress, EmailResult, Result } from "../../types";
import generateMessageId from "../../utils/generate-message-id";
import headersToRecord from "../../utils/headers-to-record";
import validateEmailOptions from "../../utils/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import type { NodemailerConfig, NodemailerEmailOptions } from "./types";

// Constants
const PROVIDER_NAME = "nodemailer";

/**
 * Nodemailer Provider for sending emails via nodemailer
 */
const nodemailerProvider: ProviderFactory<NodemailerConfig, unknown, NodemailerEmailOptions> = defineProvider(
    (options: NodemailerConfig = {} as NodemailerConfig) => {
        // Validate required options
        if (!options.transport) {
            throw new RequiredOptionError(PROVIDER_NAME, "transport");
        }

        // Transporter instance (lazy initialized)
        let transporter: ReturnType<typeof nodemailerModule.createTransport> | undefined;

        /**
         * Creates a transporter from transport configuration.
         * @param transport Optional transport configuration override.
         * @returns A nodemailer transporter instance.
         */
        const createTransporter = (transport?: Record<string, unknown> | string) => {
            const transportConfig = transport || options.transport;

            // eslint-disable-next-line sonarjs/no-clear-text-protocols
            return nodemailerModule.createTransport(transportConfig as Parameters<typeof nodemailerModule.createTransport>[0]);
        };

        let isInitialized = false;

        /**
         * Initializes the nodemailer provider by creating and verifying the transporter.
         * @throws {EmailError} When transporter verification fails.
         */
        const initializeProvider = async () => {
            if (isInitialized) {
                return;
            }

            try {
                transporter = createTransporter();
                await transporter.verify();
                isInitialized = true;
            } catch (error) {
                throw new EmailError(PROVIDER_NAME, `Failed to initialize nodemailer transport: ${error instanceof Error ? error.message : String(error)}`, {
                    cause: error instanceof Error ? error : new Error(String(error)),
                });
            }
        };

        /**
         * Converts EmailOptions to nodemailer mail options format.
         * @param emailOptions The email options object to convert to nodemailer format.
         * @returns A record containing nodemailer-compatible mail options with all fields properly formatted.
         */

        const convertToNodemailerOptions = (emailOptions: NodemailerEmailOptions) => {
            const formatFromAddress = (address: EmailAddress): string => (address.name ? `${address.name} <${address.email}>` : address.email);

            const formatToAddress = (address: EmailAddress): string => (address.name ? `${address.name} <${address.email}>` : address.email);

            const fromAddress = options.defaultFrom || emailOptions.from;
            const mailOptions: Record<string, unknown> = {
                from: formatFromAddress(fromAddress),
                subject: emailOptions.subject,
                to: Array.isArray(emailOptions.to) ? emailOptions.to.map((addr) => formatToAddress(addr)) : formatToAddress(emailOptions.to),
            };

            if (emailOptions.text) {
                mailOptions.text = emailOptions.text;
            }

            if (emailOptions.html) {
                mailOptions.html = emailOptions.html;
            }

            if (emailOptions.cc) {
                mailOptions.cc = Array.isArray(emailOptions.cc) ? emailOptions.cc.map((addr) => formatToAddress(addr)) : formatToAddress(emailOptions.cc);
            }

            if (emailOptions.bcc) {
                mailOptions.bcc = Array.isArray(emailOptions.bcc) ? emailOptions.bcc.map((addr) => formatToAddress(addr)) : formatToAddress(emailOptions.bcc);
            }

            if (emailOptions.replyTo) {
                mailOptions.replyTo = emailOptions.replyTo.name ? `${emailOptions.replyTo.name} <${emailOptions.replyTo.email}>` : emailOptions.replyTo.email;
            }

            if (emailOptions.headers) {
                mailOptions.headers = headersToRecord(emailOptions.headers);
            }

            // Handle attachments
            if (emailOptions.attachments && emailOptions.attachments.length > 0) {
                mailOptions.attachments = emailOptions.attachments.map((attachment) => {
                    const nodemailerAttachment: Record<string, unknown> = {
                        filename: attachment.filename,
                    };

                    // Content priority: raw > content > path (path would need async handling)
                    if (attachment.raw !== undefined) {
                        nodemailerAttachment.content = attachment.raw;
                    } else if (attachment.content !== undefined) {
                        nodemailerAttachment.content = attachment.content;
                    } else if (attachment.path) {
                        nodemailerAttachment.path = attachment.path;
                    }

                    if (attachment.contentType) {
                        nodemailerAttachment.contentType = attachment.contentType;
                    }

                    if (attachment.contentDisposition) {
                        nodemailerAttachment.contentDisposition = attachment.contentDisposition;
                    }

                    if (attachment.cid) {
                        nodemailerAttachment.cid = attachment.cid;
                    }

                    if (attachment.encoding) {
                        nodemailerAttachment.encoding = attachment.encoding;
                    }

                    if (attachment.headers) {
                        nodemailerAttachment.headers = attachment.headers;
                    }

                    if (attachment.href) {
                        nodemailerAttachment.href = attachment.href;
                    }

                    if (attachment.httpHeaders) {
                        nodemailerAttachment.httpHeaders = attachment.httpHeaders;
                    }

                    return nodemailerAttachment;
                });
            }

            return mailOptions;
        };

        return {
            features: {
                attachments: true,
                customHeaders: true,
                html: true,
                replyTo: true,
            },

            /**
             * Initializes the nodemailer provider.
             */
            initialize: initializeProvider,

            /**
             * Checks if the nodemailer provider is available.
             * @returns True if the provider is available, false otherwise.
             */
            isAvailable: async () => {
                try {
                    if (!transporter) {
                        transporter = createTransporter();
                    }

                    await transporter.verify();

                    return true;
                } catch {
                    return false;
                }
            },

            name: PROVIDER_NAME,

            options,

            /**
             * Sends an email using nodemailer.
             * @param emailOptions The email options to send.
             * @returns A result object containing the email result or an error.
             */
            sendEmail: async (emailOptions: NodemailerEmailOptions): Promise<Result<EmailResult>> => {
                // Validate email options
                const validationErrors = validateEmailOptions(emailOptions);

                if (validationErrors.length > 0) {
                    return {
                        error: new EmailError(PROVIDER_NAME, `Validation failed: ${validationErrors.join(", ")}`),
                        success: false,
                    };
                }

                try {
                    // Initialize if not already done
                    if (!isInitialized) {
                        await initializeProvider();
                    }

                    // Use transport override if provided, otherwise use default
                    if (!transporter) {
                        throw new EmailError(PROVIDER_NAME, "Transporter not initialized. Call initialize() first.");
                    }

                    const emailTransporter = emailOptions.transportOverride ? createTransporter(emailOptions.transportOverride) : transporter;

                    // Convert to nodemailer format
                    const mailOptions = convertToNodemailerOptions(emailOptions);

                    // Send email
                    const info = await emailTransporter.sendMail(mailOptions);

                    return {
                        data: {
                            messageId: info.messageId || generateMessageId(),
                            provider: PROVIDER_NAME,
                            response: info,
                            sent: true,
                            timestamp: new Date(),
                        },
                        success: true,
                    };
                } catch (error) {
                    return {
                        error: new EmailError(PROVIDER_NAME, `Failed to send email: ${error instanceof Error ? error.message : String(error)}`, {
                            cause: error instanceof Error ? error : new Error(String(error)),
                        }),
                        success: false,
                    };
                }
            },

            /**
             * Shuts down the nodemailer provider and cleans up resources.
             */
            shutdown: async () => {
                if (transporter && typeof transporter.close === "function") {
                    transporter.close();
                }

                transporter = undefined;
                isInitialized = false;
            },

            /**
             * Validates nodemailer credentials by verifying the transporter.
             * @returns A promise that resolves to true if credentials are valid, false otherwise.
             */
            validateCredentials: async (): Promise<boolean> => {
                try {
                    if (!transporter) {
                        transporter = createTransporter();
                    }

                    await transporter.verify();

                    return true;
                } catch {
                    return false;
                }
            },
        };
    },
);

export default nodemailerProvider;
