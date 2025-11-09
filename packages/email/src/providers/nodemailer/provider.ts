import nodemailerModule from "nodemailer";

import { EmailError, RequiredOptionError } from "../../errors/email-error.js";
import type { EmailResult, NodemailerConfig, Result } from "../../types.js";
import { generateMessageId, validateEmailOptions } from "../../utils.js";
import type { ProviderFactory } from "../provider.js";
import { defineProvider } from "../provider.js";
import type { NodemailerEmailOptions } from "./types.js";

// Constants
const PROVIDER_NAME = "nodemailer";

/**
 * Nodemailer Provider for sending emails via nodemailer
 */
export const nodemailerProvider: ProviderFactory<NodemailerConfig, unknown, NodemailerEmailOptions> = defineProvider(
    (options: NodemailerConfig = {} as NodemailerConfig) => {
        // Validate required options
        if (!options.transport) {
            throw new RequiredOptionError(PROVIDER_NAME, "transport");
        }

        // Transporter instance (lazy initialized)
        let transporter: ReturnType<typeof nodemailerModule.createTransport> | undefined;

        /**
         * Create transporter from transport configuration
         */
        const createTransporter = (transport?: Record<string, unknown> | string) => {
            const transportConfig = transport || options.transport;

            return nodemailerModule.createTransport(transportConfig as Parameters<typeof nodemailerModule.createTransport>[0]);
        };

        let isInitialized = false;

        /**
         * Initialize function
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
         * Convert EmailOptions to nodemailer mail options
         */
        const convertToNodemailerOptions = (emailOptions: NodemailerEmailOptions) => {
            const mailOptions: Record<string, unknown> = {
                from: options.defaultFrom
                    ? options.defaultFrom.name
                        ? `${options.defaultFrom.name} <${options.defaultFrom.email}>`
                        : options.defaultFrom.email
                    : emailOptions.from.name
                        ? `${emailOptions.from.name} <${emailOptions.from.email}>`
                        : emailOptions.from.email,
                subject: emailOptions.subject,
                to: Array.isArray(emailOptions.to)
                    ? emailOptions.to.map((addr) => addr.name ? `${addr.name} <${addr.email}>` : addr.email)
                    : emailOptions.to.name
                        ? `${emailOptions.to.name} <${emailOptions.to.email}>`
                        : emailOptions.to.email,
            };

            if (emailOptions.text) {
                mailOptions.text = emailOptions.text;
            }

            if (emailOptions.html) {
                mailOptions.html = emailOptions.html;
            }

            if (emailOptions.cc) {
                mailOptions.cc = Array.isArray(emailOptions.cc)
                    ? emailOptions.cc.map((addr) => (addr.name ? `${addr.name} <${addr.email}>` : addr.email))
                    : emailOptions.cc.name
                        ? `${emailOptions.cc.name} <${emailOptions.cc.email}>`
                        : emailOptions.cc.email;
            }

            if (emailOptions.bcc) {
                mailOptions.bcc = Array.isArray(emailOptions.bcc)
                    ? emailOptions.bcc.map((addr) => (addr.name ? `${addr.name} <${addr.email}>` : addr.email))
                    : emailOptions.bcc.name
                        ? `${emailOptions.bcc.name} <${emailOptions.bcc.email}>`
                        : emailOptions.bcc.email;
            }

            if (emailOptions.replyTo) {
                mailOptions.replyTo = emailOptions.replyTo.name ? `${emailOptions.replyTo.name} <${emailOptions.replyTo.email}>` : emailOptions.replyTo.email;
            }

            if (emailOptions.headers) {
                mailOptions.headers = emailOptions.headers;
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
             * Initialize the provider
             */
            initialize: initializeProvider,

            /**
             * Check if provider is available
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
             * Send email using nodemailer
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
                    const emailTransporter = emailOptions.transportOverride ? createTransporter(emailOptions.transportOverride) : transporter!;

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
             * Shutdown/cleanup
             */
            shutdown: async () => {
                if (transporter && typeof transporter.close === "function") {
                    transporter.close();
                }

                transporter = undefined;
                isInitialized = false;
            },

            /**
             * Validate credentials
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
