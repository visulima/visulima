import { Buffer } from "node:buffer";
import { createHash, createHmac, createSign } from "node:crypto";
import type { Socket } from "node:net";
import { createConnection } from "node:net";
import { connect } from "node:tls";

import { EmailError, RequiredOptionError } from "../../errors/email-error";
import type { EmailResult, Result, SmtpConfig } from "../../types";
import { buildMimeMessage, generateMessageId, isPortAvailable, validateEmailOptions } from "../../utils";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import type { SmtpEmailOptions } from "./types";

// Constants
const PROVIDER_NAME = "smtp";
const DEFAULT_PORT = 25;
const DEFAULT_SECURE_PORT = 465;
const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_SECURE = false;
const DEFAULT_MAX_CONNECTIONS = 5;
const DEFAULT_POOL_WAIT_TIMEOUT = 30_000;

/**
 * SMTP provider for sending emails via SMTP protocol
 */
export const smtpProvider: ProviderFactory<SmtpConfig, unknown, SmtpEmailOptions> = defineProvider((options_: SmtpConfig = {} as SmtpConfig) => {
    // Validate required options
    if (!options_.host) {
        throw new RequiredOptionError(PROVIDER_NAME, "host");
    }

    // Initialize with defaults
    const options: Pick<SmtpConfig, "user" | "password" | "oauth2" | "dkim"> & Required<Omit<SmtpConfig, "user" | "password" | "oauth2" | "dkim">> = {
        authMethod: options_.authMethod || "LOGIN", // Assign default to avoid undefined
        debug: options_.debug ?? false,
        dkim: options_.dkim,
        host: options_.host,
        maxConnections: options_.maxConnections ?? DEFAULT_MAX_CONNECTIONS,
        oauth2: options_.oauth2,
        password: options_.password,
        pool: options_.pool ?? false,
        port: options_.port === undefined ? options_.secure ? DEFAULT_SECURE_PORT : DEFAULT_PORT : options_.port,
        rejectUnauthorized: options_.rejectUnauthorized ?? true,
        retries: options_.retries ?? 0,
        secure: options_.secure ?? DEFAULT_SECURE,
        timeout: options_.timeout ?? DEFAULT_TIMEOUT,
        user: options_.user,
        ...options_.logger && { logger: options_.logger },
    } as Pick<SmtpConfig, "user" | "password" | "oauth2" | "dkim"> & Required<Omit<SmtpConfig, "user" | "password" | "oauth2" | "dkim">>;

    // Track connection state
    let isInitialized = false;

    // Connection pool management
    const connectionPool: Socket[] = [];
    const connectionQueue: {
        reject: (error: Error) => void;
        resolve: (socket: Socket) => void;
        timeout?: NodeJS.Timeout;
    }[] = [];

    /**
     * Sanitize header value to prevent injection attacks
     * Removes newlines and other control characters
     */
    const sanitizeHeaderValue = (value: string): string => value.replaceAll(/[\r\n\t\v\f]/g, " ").trim();

    /**
     * Parse SMTP server response to check capabilities
     */
    const parseEhloResponse = (response: string): Record<string, string[]> => {
        const lines = response.split("\r\n");
        const capabilities: Record<string, string[]> = {};

        for (const line of lines) {
            if (line.startsWith("250-") || line.startsWith("250 ")) {
                const capLine = line.slice(4).trim();
                const parts = capLine.split(" ");
                const key = parts[0];

                if (key) {
                    capabilities[key] = parts.slice(1);
                }
            }
        }

        return capabilities;
    };

    /**
     * Send SMTP command and await response
     */
    const sendSmtpCommand = async (socket: Socket, command: string, expectedCode: string | string[]): Promise<string> => new Promise<string>((resolve, reject) => {
        const expectedCodes = Array.isArray(expectedCode) ? expectedCode : [expectedCode];
        let responseBuffer = "";
        let lastLineCode = "";
        let timeoutHandle: NodeJS.Timeout;

        // Declare functions before use
        let onData: (data: Buffer) => void;
        let onError: (error: Error) => void;

        const cleanup = () => {
            socket.removeListener("data", onData);
            socket.removeListener("error", onError);

            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
        };

        onError = (error: Error) => {
            cleanup();
            reject(new EmailError(PROVIDER_NAME, `Socket error: ${error.message}`, { cause: error }));
        };

        onData = (data: Buffer) => {
            responseBuffer += data.toString();
            // SMTP çok satırlı yanıtlar: 250-...\r\n, son satır 250 ...\r\n
            // Her satırı kontrol et
            const lines = responseBuffer.split("\r\n").filter(Boolean);

            if (lines.length > 0) {
                const lastLine = lines[lines.length - 1];

                if (lastLine) {
                    const match = lastLine.match(/^(\d{3})[\s-]/);

                    if (match && match[1]) {
                        lastLineCode = match[1];

                        // Son satırda boşluk varsa (multi-line bitti)
                        if (lastLine[3] === " ") {
                            cleanup();

                            if (expectedCodes.includes(lastLineCode)) {
                                resolve(responseBuffer);
                            } else {
                                reject(
                                    new EmailError(PROVIDER_NAME, `Expected ${expectedCodes.join(" or ")}, got ${lastLineCode}: ${responseBuffer.trim()}`),
                                );
                            }
                        }
                    }
                }
            }
        };

        // Set up timeout
        timeoutHandle = setTimeout(() => {
            cleanup();
            reject(new EmailError(PROVIDER_NAME, `Command timeout after ${options.timeout}ms: ${command?.slice(0, 50)}...`));
        }, options.timeout);

        socket.on("data", onData);
        socket.on("error", onError);

        if (command) {
            socket.write(`${command}\r\n`);
        }
    });

    /**
     * Create SMTP connection
     */
    const createSmtpConnection = async (): Promise<Socket> => {
        // If pooling is enabled and there are available connections, use one
        if (options.pool && connectionPool.length > 0) {
            const socket = connectionPool.pop();

            if (socket && !socket.destroyed) {
                return socket;
            }
        }

        // If we've reached max connections and pooling is enabled, wait for a connection
        if (options.pool && connectionPool.length + 1 >= options.maxConnections) {
            return new Promise<Socket>((resolve, reject) => {
                // Create queue item with explicit timeout property
                const queueItem: {
                    reject: (error: Error) => void;
                    resolve: (socket: Socket) => void;
                    timeout?: NodeJS.Timeout;
                } = { reject, resolve };

                // Set a timeout for waiting in the queue
                queueItem.timeout = setTimeout(() => {
                    const index = connectionQueue.indexOf(queueItem);

                    if (index !== -1) {
                        connectionQueue.splice(index, 1);
                    }

                    reject(new EmailError(PROVIDER_NAME, `Connection queue timeout after ${DEFAULT_POOL_WAIT_TIMEOUT}ms`));
                }, DEFAULT_POOL_WAIT_TIMEOUT);

                connectionQueue.push(queueItem);
            });
        }

        return new Promise<Socket>((resolve, reject) => {
            let connectionTimeout: NodeJS.Timeout;
            let isResolved = false;
            let socket: Socket | undefined;

            const cleanup = () => {
                if (connectionTimeout) {
                    clearTimeout(connectionTimeout);
                }
            };

            // Set up connection timeout using Promise-based timeout
            connectionTimeout = setTimeout(() => {
                if (!isResolved) {
                    isResolved = true;

                    if (socket && !socket.destroyed) {
                        socket.destroy();
                    }

                    cleanup();
                    reject(new EmailError(PROVIDER_NAME, `Connection timeout to ${options.host}:${options.port} after ${options.timeout}ms`));
                }
            }, options.timeout);

            try {
                // Create appropriate socket based on secure option
                socket = options.secure
                    ? connect({
                        host: options.host,
                        port: options.port,
                        rejectUnauthorized: options.rejectUnauthorized,
                    })
                    : createConnection(options.port, options.host);

                // Handle errors
                socket.on("error", (error) => {
                    if (!isResolved) {
                        isResolved = true;
                        cleanup();
                        reject(new EmailError(PROVIDER_NAME, `Connection error: ${error.message}`, { cause: error }));
                    }
                });

                // Wait for connection and server greeting
                socket.once("data", (data: Buffer) => {
                    if (!isResolved && socket) {
                        isResolved = true;
                        cleanup();
                        const greeting = data.toString();
                        const code = greeting.slice(0, 3);

                        if (code === "220") {
                            resolve(socket);
                        } else {
                            socket.destroy();
                            reject(new EmailError(PROVIDER_NAME, `Unexpected server greeting: ${greeting.trim()}`));
                        }
                    }
                });
            } catch (error) {
                if (!isResolved) {
                    isResolved = true;
                    cleanup();
                    reject(new EmailError(PROVIDER_NAME, `Failed to create connection: ${(error as Error).message}`, { cause: error as Error }));
                }
            }
        });
    };

    /**
     * Upgrade plain connection to TLS using STARTTLS
     */
    const upgradeToTLS = async (socket: Socket): Promise<Socket> => new Promise<Socket>((resolve, reject) => {
        let tlsTimeout: NodeJS.Timeout;
        let isResolved = false;
        let tlsSocket: Socket | undefined;

        const cleanup = () => {
            if (tlsTimeout) {
                clearTimeout(tlsTimeout);
            }
        };

        // Set up TLS connection timeout using Promise-based timeout
        tlsTimeout = setTimeout(() => {
            if (!isResolved) {
                isResolved = true;

                if (tlsSocket && !tlsSocket.destroyed) {
                    tlsSocket.destroy();
                }

                cleanup();
                reject(new EmailError(PROVIDER_NAME, `TLS connection timeout after ${options.timeout}ms`));
            }
        }, options.timeout);

        try {
            // Create TLS socket options
            const tlsOptions = {
                host: options.host,
                rejectUnauthorized: options.rejectUnauthorized,
                socket,
            };

            // Create TLS connection
            tlsSocket = connect(tlsOptions);

            // Handle TLS connection errors
            tlsSocket.on("error", (error) => {
                if (!isResolved) {
                    isResolved = true;
                    cleanup();
                    reject(new EmailError(PROVIDER_NAME, `TLS connection error: ${error.message}`, { cause: error }));
                }
            });

            // Resolve when secure connection is established
            tlsSocket.once("secure", () => {
                if (!isResolved && tlsSocket) {
                    isResolved = true;
                    cleanup();
                    resolve(tlsSocket);
                }
            });
        } catch (error) {
            if (!isResolved) {
                isResolved = true;
                cleanup();
                reject(new EmailError(PROVIDER_NAME, `Failed to upgrade to TLS: ${(error as Error).message}`, { cause: error as Error }));
            }
        }
    });

    /**
     * Return a connection to the pool or close it
     */
    const releaseConnection = (socket: Socket): void => {
        // If the socket is destroyed or pooling is disabled, don't try to reuse it
        if (socket.destroyed || !options.pool) {
            try {
                socket.destroy();
            } catch {
                // Ignore destroy errors
            }

            return;
        }

        // If there are connections waiting in the queue, give this socket to the next one
        if (connectionQueue.length > 0) {
            const next = connectionQueue.shift();

            if (next) {
                clearTimeout(next.timeout);
                next.resolve(socket);

                return;
            }
        }

        // Otherwise add it back to the pool
        connectionPool.push(socket);
    };

    /**
     * Close SMTP connection
     */
    const closeConnection = async (socket: Socket, release = false): Promise<void> => new Promise<void>((resolve) => {
        try {
            if (release) {
                // Reset the connection state by sending RSET command
                socket.write("RSET\r\n");

                // Release the connection back to the pool
                releaseConnection(socket);
                resolve();

                return;
            }

            // Send QUIT command
            socket.write("QUIT\r\n");
            socket.end();
            socket.once("close", () => resolve());
        } catch {
            // Just resolve even if there's an error during close
            resolve();
        }
    });

    /**
     * Perform SMTP authentication
     */
    const authenticate = async (socket: Socket): Promise<void> => {
        if (!options.user) {
            return; // No authentication needed
        }

        // Detect auth methods from server response
        const ehloResponse = await sendSmtpCommand(socket, `EHLO ${options.host}`, "250");
        const capabilities = parseEhloResponse(ehloResponse);

        // Get supported AUTH methods
        const authCapability = Object.keys(capabilities).find((key) => key.toUpperCase() === "AUTH");

        if (!authCapability && (options.user || options.password)) {
            throw new EmailError(PROVIDER_NAME, "Server does not support authentication");
        }

        // Add null check before accessing capabilities with authCapability
        const supportedMethods = authCapability ? capabilities[authCapability] || [] : [];

        const authMethod
            = options.authMethod
                || (supportedMethods.includes("CRAM-MD5")
                    ? "CRAM-MD5"
                    : supportedMethods.includes("LOGIN")
                        ? "LOGIN"
                        : supportedMethods.includes("PLAIN")
                            ? "PLAIN"
                            : null);

        if (!authMethod) {
            throw new EmailError(PROVIDER_NAME, "No supported authentication methods");
        }

        // Handle OAUTH2 authentication if configured
        if (authMethod === "OAUTH2" && options.oauth2) {
            try {
                const { accessToken, user } = options.oauth2;
                const auth = `user=${user}\u0001auth=Bearer ${accessToken}\u0001\u0001`;
                const authBase64 = Buffer.from(auth).toString("base64");

                await sendSmtpCommand(socket, `AUTH XOAUTH2 ${authBase64}`, "235");

                return;
            } catch (error) {
                const errorMessage = (error as Error).message;

                if (errorMessage.includes("535") || errorMessage.includes("Authentication failed")) {
                    throw new EmailError(PROVIDER_NAME, "Authentication failed: Invalid OAuth2 credentials");
                }

                throw error;
            }
        }

        // Handle CRAM-MD5 authentication
        if (authMethod === "CRAM-MD5" && options.password) {
            try {
                // Request challenge from server
                const response = await sendSmtpCommand(socket, "AUTH CRAM-MD5", "334");

                // Decode challenge
                const challengePart = response.split(" ")[1];

                if (!challengePart) {
                    throw new EmailError(PROVIDER_NAME, "Invalid CRAM-MD5 challenge response");
                }

                const challenge = Buffer.from(challengePart, "base64").toString("utf-8");

                // Calculate HMAC digest
                const hmac = createHmac("md5", options.password);

                hmac.update(challenge);
                const digest = hmac.digest("hex");

                // Respond with username and digest
                const cramResponse = `${options.user} ${digest}`;

                await sendSmtpCommand(socket, Buffer.from(cramResponse).toString("base64"), "235");

                return;
            } catch (error) {
                const errorMessage = (error as Error).message;

                if (errorMessage.includes("535") || errorMessage.includes("Authentication failed")) {
                    throw new EmailError(PROVIDER_NAME, "Authentication failed: Invalid username or password");
                }

                throw error;
            }
        }

        // Handle LOGIN authentication
        if (authMethod === "LOGIN" && options.password) {
            try {
                // Send AUTH command
                await sendSmtpCommand(socket, "AUTH LOGIN", "334");

                // Send username (base64 encoded)
                await sendSmtpCommand(socket, Buffer.from(options.user).toString("base64"), "334");

                // Send password (base64 encoded)
                await sendSmtpCommand(socket, Buffer.from(options.password).toString("base64"), "235");

                return;
            } catch (error) {
                const errorMessage = (error as Error).message;

                if (errorMessage.includes("535") || errorMessage.includes("Authentication failed")) {
                    throw new EmailError(PROVIDER_NAME, "Authentication failed: Invalid username or password");
                }

                throw error;
            }
        }

        // Handle PLAIN authentication (fallback)
        if (authMethod === "PLAIN" && options.password) {
            try {
                // Send AUTH PLAIN command with credentials
                const authPlain = Buffer.from(`\0${options.user}\0${options.password}`).toString("base64");

                await sendSmtpCommand(socket, `AUTH PLAIN ${authPlain}`, "235");

                return;
            } catch (error) {
                const errorMessage = (error as Error).message;

                if (errorMessage.includes("535") || errorMessage.includes("Authentication failed")) {
                    throw new EmailError(PROVIDER_NAME, "Authentication failed: Invalid username or password");
                }

                throw error;
            }
        }

        throw new EmailError(PROVIDER_NAME, "Authentication failed - no valid credentials or method");
    };

    /**
     * Sign email with DKIM
     */
    const signWithDkim = (message: string): string => {
        if (!options.dkim) {
            return message;
        }

        const { domainName, keySelector, privateKey } = options.dkim;

        try {
            // Parse the message to separate headers and body
            const [headersPart, bodyPart] = message.split("\r\n\r\n");

            if (!headersPart || !bodyPart) {
                return message;
            }

            const headers = headersPart.split("\r\n");

            // DKIM canonicalization (relaxed/relaxed, basic)
            const canonicalize = (string_: string) => string_.replaceAll("\r\n", "\n").replaceAll(/\s+/g, " ").trim();
            const canonicalizedBody = canonicalize(bodyPart);
            const bodyHash = createHash("sha256").update(canonicalizedBody).digest("base64");

            // Find which headers to sign (from, to, subject, date)
            const headerNames = ["from", "to", "subject", "date"];
            const headersToSign = headers.filter((h) => headerNames.some((n) => h.toLowerCase().startsWith(`${n}:`)));
            const dkimHeaderList = headersToSign
                .map((h) => {
                    const parts = h.split(":");

                    return parts[0]?.toLowerCase() || "";
                })
                .filter(Boolean)
                .join(":");

            // Build DKIM header (without signature)
            const now = Math.floor(Date.now() / 1000);
            const dkimFields = {
                a: "rsa-sha256",
                bh: bodyHash,
                c: "relaxed/relaxed",
                d: domainName,
                h: dkimHeaderList,
                s: keySelector,
                t: now.toString(),
                v: "1",
            };
            const dkimHeader = `DKIM-Signature: ${Object.entries(dkimFields)
                .map(([k, v]) => `${k}=${v}`)
                .join("; ")}; b=`;

            // Canonicalize headers for signing
            const headersForSign = [...headersToSign, dkimHeader].map(canonicalize).join("\r\n");
            const signer = createSign("RSA-SHA256");

            signer.update(headersForSign);
            const signature = signer.sign(privateKey, "base64");
            const finalDkimHeader = `${dkimHeader}${signature}`;

            // DKIM-Signature en başa eklenmeli
            return `${finalDkimHeader}\r\n${headers.join("\r\n")}\r\n\r\n${bodyPart}`;
        } catch (error) {
            console.error(`[${PROVIDER_NAME}] DKIM signing error:`, error);

            return message;
        }
    };

    return {
        features: {
            attachments: true,
            batchSending: options.pool, // Now supported with pooling
            customHeaders: true,
            html: true,
            replyTo: true,
            scheduling: false,
            tagging: false,
            templates: false,
            tracking: false,
        },

        /**
         * Initialize the SMTP provider
         */
        async initialize(): Promise<void> {
            // Check if the provider is already initialized
            if (isInitialized) {
                return;
            }

            try {
                // Check if SMTP server is available
                if (!await this.isAvailable()) {
                    throw new EmailError(PROVIDER_NAME, `SMTP server not available at ${options.host}:${options.port}`);
                }

                isInitialized = true;
            } catch (error) {
                throw new EmailError(PROVIDER_NAME, `Failed to initialize: ${(error as Error).message}`, { cause: error as Error });
            }
        },

        /**
         * Check if SMTP server is available
         */
        async isAvailable(): Promise<boolean> {
            try {
                // First check if port is open
                const portAvailable = await isPortAvailable(options.host, options.port);

                if (!portAvailable) {
                    return false;
                }

                // Then try establishing a connection
                const socket = await createSmtpConnection();

                await closeConnection(socket);

                return true;
            } catch {
                return false;
            }
        },

        name: PROVIDER_NAME,

        options,

        /**
         * Send email through SMTP
         */
        async sendEmail(emailOptions: SmtpEmailOptions): Promise<Result<EmailResult>> {
            try {
                // Validate email options
                const validationErrors = validateEmailOptions(emailOptions);

                if (validationErrors.length > 0) {
                    return {
                        error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                        success: false,
                    };
                }

                // Make sure provider is initialized
                if (!isInitialized) {
                    await this.initialize();
                }

                // Create SMTP connection
                let socket = await createSmtpConnection();

                try {
                    // EHLO handshake
                    await sendSmtpCommand(socket, `EHLO ${options.host}`, "250");

                    // Support for STARTTLS (if not already using TLS and server supports it)
                    if (!options.secure) {
                        try {
                            const ehloResponse = await sendSmtpCommand(socket, `EHLO ${options.host}`, "250");
                            const capabilities = parseEhloResponse(ehloResponse);

                            if (Object.keys(capabilities).includes("STARTTLS")) {
                                // Server supports STARTTLS, so use it
                                await sendSmtpCommand(socket, "STARTTLS", "220");

                                // Upgrade connection to TLS
                                const tlsSocket = await upgradeToTLS(socket);

                                // Replace socket reference with secure version
                                socket = tlsSocket;

                                // Re-issue EHLO command over secured connection
                                await sendSmtpCommand(socket, `EHLO ${options.host}`, "250");
                            }
                        } catch (error) {
                            // STARTTLS not supported or failed, continue with plain connection
                            if (options.rejectUnauthorized !== false) {
                                throw new EmailError(PROVIDER_NAME, `STARTTLS failed or not supported: ${(error as Error).message}`, { cause: error as Error });
                            }
                        }
                    }

                    // Authenticate if credentials are provided
                    await authenticate(socket);

                    // MAIL FROM command
                    await sendSmtpCommand(socket, `MAIL FROM:<${emailOptions.from.email}>`, "250");

                    // RCPT TO commands (including CC and BCC)
                    const recipients: string[] = [];

                    // Add primary recipients
                    if (Array.isArray(emailOptions.to)) {
                        recipients.push(...emailOptions.to.map((r) => r.email));
                    } else {
                        recipients.push(emailOptions.to.email);
                    }

                    // Add CC recipients
                    if (emailOptions.cc) {
                        if (Array.isArray(emailOptions.cc)) {
                            recipients.push(...emailOptions.cc.map((r) => r.email));
                        } else {
                            recipients.push(emailOptions.cc.email);
                        }
                    }

                    // Add BCC recipients
                    if (emailOptions.bcc) {
                        if (Array.isArray(emailOptions.bcc)) {
                            recipients.push(...emailOptions.bcc.map((r) => r.email));
                        } else {
                            recipients.push(emailOptions.bcc.email);
                        }
                    }

                    // Send RCPT TO for each recipient
                    for (const recipient of recipients) {
                        await sendSmtpCommand(socket, `RCPT TO:<${recipient}>`, "250");
                    }

                    // DATA command
                    await sendSmtpCommand(socket, "DATA", "354");

                    // Build and send MIME message
                    let mimeMessage = await buildMimeMessage(emailOptions);

                    // Add special headers based on email options
                    const additionalHeaders: string[] = [];

                    // Add DSN headers if requested
                    if (emailOptions.dsn) {
                        const dsnOptions = [];

                        if (emailOptions.dsn.success)
                            dsnOptions.push("SUCCESS");

                        if (emailOptions.dsn.failure)
                            dsnOptions.push("FAILURE");

                        if (emailOptions.dsn.delay)
                            dsnOptions.push("DELAY");

                        if (dsnOptions.length > 0) {
                            additionalHeaders.push(`X-DSN-NOTIFY: ${dsnOptions.join(",")}`);
                        }
                    }

                    // Add priority if specified
                    if (emailOptions.priority) {
                        let priorityValue = "";

                        switch (emailOptions.priority) {
                            case "high": {
                                priorityValue = "1 (Highest)";
                                additionalHeaders.push("Importance: High");
                                break;
                            }
                            case "low": {
                                priorityValue = "5 (Lowest)";
                                additionalHeaders.push("Importance: Low");
                                break;
                            }
                            case "normal": {
                                priorityValue = "3 (Normal)";
                                additionalHeaders.push("Importance: Normal");
                                break;
                            }
                        }

                        additionalHeaders.push(`X-Priority: ${priorityValue}`);
                    }

                    // Add In-Reply-To header if specified
                    if (emailOptions.inReplyTo) {
                        additionalHeaders.push(`In-Reply-To: ${sanitizeHeaderValue(emailOptions.inReplyTo)}`);
                    }

                    // Add References header if specified
                    if (emailOptions.references) {
                        const references = Array.isArray(emailOptions.references)
                            ? emailOptions.references.map(sanitizeHeaderValue).join(" ")
                            : sanitizeHeaderValue(emailOptions.references);

                        additionalHeaders.push(`References: ${references}`);
                    }

                    // Add List-Unsubscribe header if specified
                    if (emailOptions.listUnsubscribe) {
                        let unsubValue;

                        unsubValue = Array.isArray(emailOptions.listUnsubscribe) ? emailOptions.listUnsubscribe.map((value) => `<${sanitizeHeaderValue(value)}>`).join(", ") : `<${sanitizeHeaderValue(emailOptions.listUnsubscribe)}>`;

                        additionalHeaders.push(`List-Unsubscribe: ${unsubValue}`);
                    }

                    // Add Google Mail specific headers
                    if (emailOptions.googleMailHeaders) {
                        const { googleMailHeaders } = emailOptions;

                        // Add Feedback ID
                        if (googleMailHeaders.feedbackId) {
                            additionalHeaders.push(`Feedback-ID: ${sanitizeHeaderValue(googleMailHeaders.feedbackId)}`);
                        }

                        // Add promotional content indicator
                        if (googleMailHeaders.promotionalContent) {
                            additionalHeaders.push("X-Google-Promotion: promotional");
                        }

                        // Add category
                        if (googleMailHeaders.category) {
                            additionalHeaders.push(`X-Gmail-Labels: ${googleMailHeaders.category}`);
                        }
                    }

                    // Insert additional headers at the top of the message
                    if (additionalHeaders.length > 0) {
                        const splitIndex = mimeMessage.indexOf("\r\n\r\n");

                        if (splitIndex !== -1) {
                            const headerPart = mimeMessage.slice(0, splitIndex);
                            const bodyPart = mimeMessage.slice(splitIndex + 4);

                            mimeMessage = `${headerPart}\r\n${additionalHeaders.join("\r\n")}\r\n\r\n${bodyPart}`;
                        }
                    }

                    // Apply DKIM signing if configured and requested
                    if (options.dkim && (emailOptions.useDkim || emailOptions.useDkim === undefined)) {
                        mimeMessage = signWithDkim(mimeMessage);
                    }

                    // Send message content and finish with .
                    await sendSmtpCommand(socket, `${mimeMessage}\r\n.`, "250");

                    // Generate message ID if not present in response
                    const messageId = generateMessageId();

                    // Return connection to pool or close it
                    await closeConnection(socket, options.pool);

                    return {
                        data: {
                            messageId,
                            provider: PROVIDER_NAME,
                            response: "Message accepted",
                            sent: true,
                            timestamp: new Date(),
                        },
                        success: true,
                    };
                } catch (error) {
                    // Make sure connection is closed on error
                    try {
                        await closeConnection(socket);
                    } catch {
                        // Ignore close errors
                    }

                    throw error;
                }
            } catch (error) {
                return {
                    error: new EmailError(PROVIDER_NAME, `Failed to send email: ${(error as Error).message}`, { cause: error as Error }),
                    success: false,
                };
            }
        },

        /**
         * Cleanly shut down the provider and release resources
         */
        async shutdown(): Promise<void> {
            // Close all connections in the pool
            for (const socket of connectionPool) {
                try {
                    await closeConnection(socket);
                } catch {
                    // Ignore errors during shutdown
                }
            }

            // Clear the connection pool
            connectionPool.length = 0;

            // Reject any waiting connections
            for (const queueItem of connectionQueue) {
                clearTimeout(queueItem.timeout);
                queueItem.reject(new Error("Provider shutdown"));
            }

            // Clear the connection queue
            connectionQueue.length = 0;
        },

        /**
         * Validate SMTP credentials
         */
        async validateCredentials(): Promise<boolean> {
            try {
                if (!await this.isAvailable()) {
                    return false;
                }

                // Create connection and try to authenticate
                const socket = await createSmtpConnection();

                try {
                    // EHLO handshake
                    await sendSmtpCommand(socket, `EHLO ${options.host}`, "250");

                    // Try STARTTLS if not using secure connection directly
                    if (!options.secure) {
                        try {
                            const ehloResponse = await sendSmtpCommand(socket, `EHLO ${options.host}`, "250");
                            const capabilities = parseEhloResponse(ehloResponse);

                            if (Object.keys(capabilities).includes("STARTTLS")) {
                                // Server supports STARTTLS, so use it
                                await sendSmtpCommand(socket, "STARTTLS", "220");

                                // Upgrade connection to TLS
                                const tlsSocket = await upgradeToTLS(socket);

                                // Replace socket with secure version
                                Object.assign(socket, tlsSocket);

                                // Re-issue EHLO command over secured connection
                                await sendSmtpCommand(socket, `EHLO ${options.host}`, "250");
                            }
                        } catch {
                            // STARTTLS not supported or failed, continue with plain connection
                            if (options.rejectUnauthorized !== false) {
                                return false;
                            }
                        }
                    }

                    // Try authentication
                    await authenticate(socket);

                    // Close connection
                    await closeConnection(socket);

                    return true;
                } catch {
                    await closeConnection(socket);

                    return false;
                }
            } catch {
                return false;
            }
        },
    };
});
