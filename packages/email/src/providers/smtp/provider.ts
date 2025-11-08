import type { EmailResult, Result } from "../../types.js";
import type { SmtpConfig } from "../../types.js";
import type { ProviderFactory } from "../provider.js";
import type { SmtpEmailOptions } from "./types.js";
import { Buffer } from "node:buffer";
import * as crypto from "node:crypto";
import * as net from "node:net";
import * as tls from "node:tls";
import { buildMimeMessage, createError, createRequiredError, generateMessageId, validateEmailOptions } from "../../utils.js";
import { defineProvider } from "../provider.js";

// Constants
const PROVIDER_NAME = "smtp";
const DEFAULT_PORT = 25;
const DEFAULT_SECURE_PORT = 465;
const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_SECURE = false;
const DEFAULT_MAX_CONNECTIONS = 5;

/**
 * SMTP provider for sending emails via SMTP protocol
 */
export const smtpProvider: ProviderFactory<SmtpConfig, unknown, SmtpEmailOptions> = defineProvider(
    (opts: SmtpConfig = {} as SmtpConfig) => {
        // Validate required options
        if (!opts.host) {
            throw createRequiredError(PROVIDER_NAME, "host");
        }

        // Initialize with defaults
        const options: Required<Omit<SmtpConfig, "user" | "password" | "oauth2" | "dkim">> &
            Pick<SmtpConfig, "user" | "password" | "oauth2" | "dkim"> = {
            host: opts.host,
            port: opts.port !== undefined ? opts.port : opts.secure ? DEFAULT_SECURE_PORT : DEFAULT_PORT,
            secure: opts.secure ?? DEFAULT_SECURE,
            user: opts.user,
            password: opts.password,
            rejectUnauthorized: opts.rejectUnauthorized ?? true,
            pool: opts.pool ?? false,
            maxConnections: opts.maxConnections ?? DEFAULT_MAX_CONNECTIONS,
            timeout: opts.timeout ?? DEFAULT_TIMEOUT,
            authMethod: opts.authMethod || "LOGIN",
            oauth2: opts.oauth2,
            dkim: opts.dkim,
        };

        let isInitialized = false;

        /**
         * Send SMTP command and await response
         */
        const sendSmtpCommand = async (
            socket: net.Socket,
            command: string,
            expectedCode: string | string[],
        ): Promise<string> => {
            return new Promise<string>((resolve, reject) => {
                const expectedCodes = Array.isArray(expectedCode) ? expectedCode : [expectedCode];
                let responseBuffer = "";
                let timeoutHandle: NodeJS.Timeout;

                const cleanup = (): void => {
                    if (timeoutHandle) {
                        clearTimeout(timeoutHandle);
                    }
                    socket.removeAllListeners("data");
                    socket.removeAllListeners("error");
                };

                const onData = (chunk: Buffer): void => {
                    responseBuffer += chunk.toString();
                    const lines = responseBuffer.split("\r\n");
                    const lastLine = lines[lines.length - 2]; // Last complete line

                    if (lastLine && lastLine.length >= 3) {
                        const code = lastLine.substring(0, 3);
                        if (expectedCodes.includes(code)) {
                            cleanup();
                            resolve(responseBuffer);
                            return;
                        }
                        if (code[0] >= "4" && code[0] <= "5") {
                            cleanup();
                            reject(new Error(`SMTP error: ${lastLine}`));
                            return;
                        }
                    }
                };

                socket.on("data", onData);
                socket.on("error", (error) => {
                    cleanup();
                    reject(error);
                });

                timeoutHandle = setTimeout(() => {
                    cleanup();
                    reject(new Error(`SMTP command timeout: ${command}`));
                }, options.timeout);

                socket.write(`${command}\r\n`);
            });
        };

        /**
         * Authenticate with SMTP server
         */
        const authenticate = async (socket: net.Socket): Promise<void> => {
            if (!options.user || !options.password) {
                return; // No authentication needed
            }

            if (options.authMethod === "PLAIN") {
                const authString = Buffer.from(`\0${options.user}\0${options.password}`).toString("base64");
                await sendSmtpCommand(socket, `AUTH PLAIN ${authString}`, "235");
            } else if (options.authMethod === "LOGIN") {
                await sendSmtpCommand(socket, "AUTH LOGIN", "334");
                await sendSmtpCommand(socket, Buffer.from(options.user).toString("base64"), "334");
                await sendSmtpCommand(socket, Buffer.from(options.password).toString("base64"), "235");
            } else {
                throw createError(PROVIDER_NAME, `Unsupported auth method: ${options.authMethod}`);
            }
        };

        /**
         * Create and connect SMTP socket
         */
        const createSocket = async (): Promise<net.Socket> => {
            return new Promise<net.Socket>((resolve, reject) => {
                const socket = options.secure
                    ? tls.connect(
                          {
                              host: options.host,
                              port: options.port,
                              rejectUnauthorized: options.rejectUnauthorized,
                          },
                          () => {
                              resolve(socket as unknown as net.Socket);
                          },
                      )
                    : net.createConnection(options.port, options.host, () => {
                          resolve(socket);
                      });

                socket.on("error", reject);
                socket.setTimeout(options.timeout);
            });
        };

        return {
            name: PROVIDER_NAME,
            features: {
                attachments: true,
                html: true,
                templates: false,
                tracking: false,
                customHeaders: true,
                batchSending: false,
                scheduling: false,
                replyTo: true,
                tagging: false,
            },
            options,

            /**
             * Initialize the SMTP provider
             */
            async initialize(): Promise<void> {
                if (isInitialized) {
                    return;
                }

                try {
                    // Test connection
                    const socket = await createSocket();
                    await sendSmtpCommand(socket, "EHLO localhost", ["250", "220"]);
                    await authenticate(socket);
                    socket.end();
                    isInitialized = true;
                } catch (error) {
                    throw createError(
                        PROVIDER_NAME,
                        `Failed to initialize: ${(error as Error).message}`,
                        { cause: error as Error },
                    );
                }
            },

            /**
             * Check if SMTP server is available
             */
            async isAvailable(): Promise<boolean> {
                try {
                    const socket = await createSocket();
                    await sendSmtpCommand(socket, "EHLO localhost", ["250", "220"]);
                    socket.end();
                    return true;
                } catch {
                    return false;
                }
            },

            /**
             * Send email via SMTP
             */
            async sendEmail(emailOpts: SmtpEmailOptions): Promise<Result<EmailResult>> {
                try {
                    // Validate email options
                    const validationErrors = validateEmailOptions(emailOpts);
                    if (validationErrors.length > 0) {
                        return {
                            success: false,
                            error: createError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                        };
                    }

                    if (!isInitialized) {
                        await this.initialize();
                    }

                    // Build MIME message
                    const mimeMessage = buildMimeMessage(emailOpts);

                    // Connect and send
                    const socket = await createSocket();

                    try {
                        // EHLO/HELO
                        await sendSmtpCommand(socket, "EHLO localhost", ["250", "220"]);

                        // Authenticate if needed
                        await authenticate(socket);

                        // MAIL FROM
                        const fromEmail = emailOpts.from.email;
                        await sendSmtpCommand(socket, `MAIL FROM:<${fromEmail}>`, "250");

                        // RCPT TO
                        const recipients = Array.isArray(emailOpts.to) ? emailOpts.to : [emailOpts.to];
                        for (const recipient of recipients) {
                            await sendSmtpCommand(socket, `RCPT TO:<${recipient.email}>`, "250");
                        }

                        // Add CC recipients
                        if (emailOpts.cc) {
                            const ccRecipients = Array.isArray(emailOpts.cc) ? emailOpts.cc : [emailOpts.cc];
                            for (const recipient of ccRecipients) {
                                await sendSmtpCommand(socket, `RCPT TO:<${recipient.email}>`, "250");
                            }
                        }

                        // Add BCC recipients
                        if (emailOpts.bcc) {
                            const bccRecipients = Array.isArray(emailOpts.bcc) ? emailOpts.bcc : [emailOpts.bcc];
                            for (const recipient of bccRecipients) {
                                await sendSmtpCommand(socket, `RCPT TO:<${recipient.email}>`, "250");
                            }
                        }

                        // DATA
                        await sendSmtpCommand(socket, "DATA", "354");

                        // Send message
                        socket.write(mimeMessage);
                        await sendSmtpCommand(socket, "\r\n.", "250");

                        // QUIT
                        await sendSmtpCommand(socket, "QUIT", "221");

                        return {
                            success: true,
                            data: {
                                messageId: generateMessageId(),
                                sent: true,
                                timestamp: new Date(),
                                provider: PROVIDER_NAME,
                            },
                        };
                    } finally {
                        socket.end();
                    }
                } catch (error) {
                    return {
                        success: false,
                        error: error instanceof Error ? error : createError(PROVIDER_NAME, String(error)),
                    };
                }
            },
        };
    },
);
