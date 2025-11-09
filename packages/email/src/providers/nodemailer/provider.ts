import type { EmailResult, Result, NodemailerConfig } from "../../types.js";
import type { ProviderFactory } from "../provider.js";
import type { NodemailerEmailOptions } from "./types.js";
import { generateMessageId, validateEmailOptions } from "../../utils.js";
import { EmailError, RequiredOptionError } from "../../errors/email-error.js";
import { defineProvider } from "../provider.js";

// Import nodemailer using ESM import
// This ensures packem detects it as a dependency
import nodemailerModule from "nodemailer";

// Constants
const PROVIDER_NAME = "nodemailer";

/**
 * Nodemailer Provider for sending emails via nodemailer
 */
export const nodemailerProvider: ProviderFactory<NodemailerConfig, unknown, NodemailerEmailOptions> = defineProvider(
    (opts: NodemailerConfig = {} as NodemailerConfig) => {
        // Validate required options
        if (!opts.transport) {
            throw new RequiredOptionError(PROVIDER_NAME, "transport");
        }

        // Transporter instance (lazy initialized)
        let transporter: ReturnType<typeof nodemailerModule.createTransport> | undefined;

        const getNodemailer = () => nodemailerModule;

        /**
         * Create transporter from transport configuration
         */
        const createTransporter = (transport?: Record<string, unknown> | string) => {
            const nm = getNodemailer();
            const transportConfig = transport || opts.transport;
            return nm.createTransport(transportConfig as Parameters<typeof nm.createTransport>[0]);
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
                throw new EmailError(
                    PROVIDER_NAME,
                    `Failed to initialize nodemailer transport: ${error instanceof Error ? error.message : String(error)}`,
                    { cause: error instanceof Error ? error : new Error(String(error)) },
                );
            }
        };

        /**
         * Convert EmailOptions to nodemailer mail options
         */
        const convertToNodemailerOptions = (emailOpts: NodemailerEmailOptions) => {
            const mailOptions: Record<string, unknown> = {
                from: opts.defaultFrom
                    ? opts.defaultFrom.name
                        ? `${opts.defaultFrom.name} <${opts.defaultFrom.email}>`
                        : opts.defaultFrom.email
                    : emailOpts.from.name
                      ? `${emailOpts.from.name} <${emailOpts.from.email}>`
                      : emailOpts.from.email,
                to: Array.isArray(emailOpts.to)
                    ? emailOpts.to.map((addr) => (addr.name ? `${addr.name} <${addr.email}>` : addr.email))
                    : emailOpts.to.name
                      ? `${emailOpts.to.name} <${emailOpts.to.email}>`
                      : emailOpts.to.email,
                subject: emailOpts.subject,
            };

            if (emailOpts.text) {
                mailOptions.text = emailOpts.text;
            }

            if (emailOpts.html) {
                mailOptions.html = emailOpts.html;
            }

            if (emailOpts.cc) {
                mailOptions.cc = Array.isArray(emailOpts.cc)
                    ? emailOpts.cc.map((addr) => (addr.name ? `${addr.name} <${addr.email}>` : addr.email))
                    : emailOpts.cc.name
                      ? `${emailOpts.cc.name} <${emailOpts.cc.email}>`
                      : emailOpts.cc.email;
            }

            if (emailOpts.bcc) {
                mailOptions.bcc = Array.isArray(emailOpts.bcc)
                    ? emailOpts.bcc.map((addr) => (addr.name ? `${addr.name} <${addr.email}>` : addr.email))
                    : emailOpts.bcc.name
                      ? `${emailOpts.bcc.name} <${emailOpts.bcc.email}>`
                      : emailOpts.bcc.email;
            }

            if (emailOpts.replyTo) {
                mailOptions.replyTo = emailOpts.replyTo.name
                    ? `${emailOpts.replyTo.name} <${emailOpts.replyTo.email}>`
                    : emailOpts.replyTo.email;
            }

            if (emailOpts.headers) {
                mailOptions.headers = emailOpts.headers;
            }

            // Handle attachments
            if (emailOpts.attachments && emailOpts.attachments.length > 0) {
                mailOptions.attachments = emailOpts.attachments.map((attachment) => {
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

                    // Prefer contentDisposition over disposition
                    const disposition = attachment.contentDisposition || attachment.disposition;
                    if (disposition) {
                        nodemailerAttachment.contentDisposition = disposition;
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
            name: PROVIDER_NAME,
            features: {
                attachments: true,
                html: true,
                customHeaders: true,
                replyTo: true,
            },
            options: opts,

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

            /**
             * Send email using nodemailer
             */
            sendEmail: async (emailOpts: NodemailerEmailOptions): Promise<Result<EmailResult>> => {
                // Validate email options
                const validationErrors = validateEmailOptions(emailOpts);
                if (validationErrors.length > 0) {
                    return {
                        success: false,
                        error: new EmailError(PROVIDER_NAME, `Validation failed: ${validationErrors.join(", ")}`),
                    };
                }

                try {
                    // Initialize if not already done
                    if (!isInitialized) {
                        await initializeProvider();
                    }

                    // Use transport override if provided, otherwise use default
                    const emailTransporter = emailOpts.transportOverride
                        ? createTransporter(emailOpts.transportOverride)
                        : transporter!;

                    // Convert to nodemailer format
                    const mailOptions = convertToNodemailerOptions(emailOpts);

                    // Send email
                    const info = await emailTransporter.sendMail(mailOptions);

                    return {
                        success: true,
                        data: {
                            messageId: info.messageId || generateMessageId(),
                            sent: true,
                            timestamp: new Date(),
                            provider: PROVIDER_NAME,
                            response: info,
                        },
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: new EmailError(
                            PROVIDER_NAME,
                            `Failed to send email: ${error instanceof Error ? error.message : String(error)}`,
                            { cause: error instanceof Error ? error : new Error(String(error)) },
                        ),
                    };
                }
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
        };
    },
);
