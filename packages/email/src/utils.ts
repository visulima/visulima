import { EmailError } from "./errors/email-error";
import type { EmailAddress, EmailOptions, Logger, Result } from "./types";

const hasBuffer = globalThis.Buffer !== undefined;
const isNode = typeof process !== "undefined" && process.versions?.node;

let cryptoModule: { createHash: typeof import("node:crypto").createHash; randomBytes: typeof import("node:crypto").randomBytes } | undefined;
let netModule: { createConnection: typeof import("node:net").createConnection; Socket: typeof import("node:net").Socket } | undefined;

const getCrypto = async (): Promise<typeof cryptoModule> => {
    if (!cryptoModule && isNode) {
        try {
            const crypto = await import("node:crypto");

            cryptoModule = {
                createHash: crypto.createHash,
                randomBytes: crypto.randomBytes,
            };
        } catch {
            // Ignore if not available
        }
    }

    return cryptoModule;
};

const getNet = async (): Promise<typeof netModule> => {
    if (!netModule && isNode) {
        try {
            const net = await import("node:net");

            netModule = {
                createConnection: net.createConnection,
                Socket: net.Socket,
            };
        } catch {
            // Ignore if not available
        }
    }

    return netModule;
};

/**
 * Creates a logger from options
 * If a custom logger is provided, it will be used
 * Otherwise, creates a logger based on debug flag
 */
export const createLogger = (providerName: string, debug?: boolean, logger?: Logger): Logger => {
    if (logger) {
        return logger;
    }

    const noop = (): void => {
        // No-op logger when debug is disabled
    };

    if (!debug) {
        return {
            debug: noop,
            error: noop,
            info: noop,
            warn: noop,
        };
    }

    return {
        debug: (message: string, ...args: unknown[]): void => {
            console.log(`[${providerName}] ${message}`, ...args);
        },
        error: (message: string, ...args: unknown[]): void => {
            console.error(`[${providerName}] ${message}`, ...args);
        },
        info: (message: string, ...args: unknown[]): void => {
            console.info(`[${providerName}] ${message}`, ...args);
        },
        warn: (message: string, ...args: unknown[]): void => {
            console.warn(`[${providerName}] ${message}`, ...args);
        },
    };
};

/**
 * Generates a random message ID for emails
 */
export const generateMessageId = (): string => {
    const domain = "visulima.local";
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 10);

    return `<${timestamp}.${random}@${domain}>`;
};

/**
 * Validate email address format
 */
export const validateEmail = (email: string): boolean => {
    const emailRegex = /^[\w.%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

    return emailRegex.test(email);
};

/**
 * Format email address as "Name &lt;email@example.com>"
 */
export const formatEmailAddress = (address: EmailAddress): string => {
    if (!validateEmail(address.email)) {
        throw new EmailError("email", `Invalid email address: ${address.email}`);
    }

    return address.name ? `${address.name} <${address.email}>` : address.email;
};

/**
 * Format email addresses list
 */
export const formatEmailAddresses = (addresses: EmailAddress | EmailAddress[]): string => {
    if (Array.isArray(addresses)) {
        return addresses.map(formatEmailAddress).join(", ");
    }

    return formatEmailAddress(addresses);
};

/**
 * Validate email options
 */
export const validateEmailOptions = <T extends EmailOptions>(options: T): string[] => {
    const errors: string[] = [];

    if (!options.from || !options.from.email) {
        errors.push("Missing required field: from");
    }

    if (!options.to) {
        errors.push("Missing required field: to");
    }

    if (!options.subject) {
        errors.push("Missing required field: subject");
    }

    if (!options.text && !options.html) {
        errors.push("Either text or html content is required");
    }

    if (options.from && options.from.email && !validateEmail(options.from.email)) {
        errors.push(`Invalid from email address: ${options.from.email}`);
    }

    const checkAddresses = (addresses: EmailAddress | EmailAddress[] | undefined, field: string) => {
        if (!addresses)
            return;

        const list = Array.isArray(addresses) ? addresses : [addresses];

        list.forEach((addr) => {
            if (!validateEmail(addr.email)) {
                errors.push(`Invalid ${field} email address: ${addr.email}`);
            }
        });
    };

    checkAddresses(options.to, "to");
    checkAddresses(options.cc, "cc");
    checkAddresses(options.bcc, "bcc");

    if (options.replyTo && !validateEmail(options.replyTo.email)) {
        errors.push(`Invalid replyTo email address: ${options.replyTo.email}`);
    }

    return errors;
};

/**
 * Request options compatible with both Fetch API and Node.js http
 */
export interface RequestOptions {
    [key: string]: unknown;
    headers?: Record<string, string>;
    method?: string;
    timeout?: number;
}

/**
 * Makes an HTTP request using Fetch API (compatible with Node.js 20.19+, Deno, Bun, Cloudflare Workers)
 */
export const makeRequest = async (url: string | URL, options: RequestOptions = {}, data?: string | Buffer | Uint8Array): Promise<Result<unknown>> => {
    const urlObject = typeof url === "string" ? new URL(url) : url;

    try {
        const headers = new Headers();

        if (options.headers) {
            Object.entries(options.headers).forEach(([key, value]) => {
                headers.set(key, value);
            });
        }

        const fetchOptions: RequestInit = {
            headers,
            method: options.method || (data ? "POST" : "GET"),
        };

        if (data) {
            if (typeof data === "string") {
                fetchOptions.body = data;
            } else if (data instanceof Uint8Array) {
                fetchOptions.body = data as BodyInit;
            } else if (hasBuffer && (data as unknown) instanceof (globalThis.Buffer as unknown as typeof Buffer)) {
                // Convert Buffer to Uint8Array for better fetch API compatibility
                fetchOptions.body = new Uint8Array(data as ArrayLike<number>) as BodyInit;
            } else {
                // Fallback: convert to Uint8Array
                fetchOptions.body = new Uint8Array(data as ArrayLike<number>) as BodyInit;
            }
        }

        let controller: AbortController | undefined;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        if (options.timeout) {
            controller = new AbortController();
            timeoutId = setTimeout(() => {
                controller?.abort();
            }, options.timeout);
            fetchOptions.signal = controller.signal;
        }

        try {
            const response = await fetch(urlObject.toString(), fetchOptions);

            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            const contentType = response.headers.get("content-type") || "";
            const isJson = contentType.includes("application/json");

            let parsedBody: unknown;

            if (isJson) {
                try {
                    parsedBody = await response.json();
                } catch {
                    parsedBody = await response.text();
                }
            } else {
                parsedBody = await response.text();
            }

            const isSuccess = response.status >= 200 && response.status < 300;

            const headersObject: Record<string, string> = {};

            response.headers.forEach((value, key) => {
                headersObject[key] = value;
            });

            return {
                data: {
                    body: parsedBody,
                    headers: headersObject,
                    statusCode: response.status,
                },
                error: isSuccess ? undefined : new EmailError("http", `Request failed with status ${response.status}`, { code: response.status.toString() }),
                success: isSuccess,
            };
        } catch (error) {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            if (error instanceof Error && error.name === "AbortError") {
                return {
                    error: new EmailError("http", `Request timed out after ${options.timeout}ms`),
                    success: false,
                };
            }

            throw error;
        }
    } catch (error) {
        return {
            error: new EmailError("http", `Request failed: ${error instanceof Error ? error.message : String(error)}`, {
                cause: error instanceof Error ? error : new Error(String(error)),
            }),
            success: false,
        };
    }
};

/**
 * Helper function to retry a function with exponential backoff
 */
export const retry = async <T>(function_: () => Promise<Result<T>>, retries: number = 3, delay: number = 300): Promise<Result<T>> => {
    try {
        const result = await function_();

        if (result.success || retries <= 0) {
            return result;
        }

        await new Promise((resolve) => setTimeout(resolve, delay));

        return retry(function_, retries - 1, delay * 2);
    } catch (error) {
        if (retries <= 0) {
            return {
                error: error instanceof Error ? error : new Error(String(error)),
                success: false,
            };
        }

        await new Promise((resolve) => setTimeout(resolve, delay));

        return retry(function_, retries - 1, delay * 2);
    }
};

/**
 * Convert content to base64 string
 * Works across Node.js, Deno, Bun, and Workers
 */
const toBase64 = (content: string | Buffer | Uint8Array): string => {
    if (typeof content === "string") {
        if (hasBuffer) {
            return Buffer.from(content, "utf8").toString("base64");
        }

        const encoder = new TextEncoder();
        const bytes = encoder.encode(content);

        return btoa(String.fromCharCode(...bytes));
    }

    if (hasBuffer && content instanceof Buffer) {
        return content.toString("base64");
    }

    const uint8Array = content instanceof Uint8Array ? content : new Uint8Array(content as ArrayLike<number>);

    if (hasBuffer) {
        return Buffer.from(uint8Array).toString("base64");
    }

    return btoa(String.fromCharCode(...uint8Array));
};

/**
 * Generate boundary string for multipart emails
 * Works across Node.js, Deno, Bun, and Workers
 */
export const generateBoundary = async (): Promise<string> => {
    const crypto = await getCrypto();

    if (crypto) {
        return `----_=_NextPart_${crypto.randomBytes(16).toString("hex")}`;
    }

    const array = new Uint8Array(16);

    if (globalThis.crypto !== undefined && globalThis.crypto.getRandomValues) {
        globalThis.crypto.getRandomValues(array);
    } else {
        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
    }

    const hex = [...array]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    return `----_=_NextPart_${hex}`;
};

/**
 * Build a MIME message from email options
 */
export const buildMimeMessage = async <T extends EmailOptions>(options: T): Promise<string> => {
    const boundary = await generateBoundary();
    const message: string[] = [];

    message.push(`From: ${formatEmailAddress(options.from)}`);
    message.push(`To: ${formatEmailAddresses(options.to)}`);

    if (options.cc) {
        message.push(`Cc: ${formatEmailAddresses(options.cc)}`);
    }

    if (options.bcc) {
        message.push(`Bcc: ${formatEmailAddresses(options.bcc)}`);
    }

    if (options.replyTo) {
        message.push(`Reply-To: ${formatEmailAddress(options.replyTo)}`);
    }

    message.push(`Subject: ${options.subject}`, "MIME-Version: 1.0");

    if (options.headers) {
        Object.entries(options.headers).forEach(([key, value]) => {
            message.push(`${key}: ${value}`);
        });
    }

    message.push(`Content-Type: multipart/mixed; boundary="${boundary}"`, "");

    if (options.text) {
        message.push(`--${boundary}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: 7bit", "", options.text, "");
    }

    if (options.html) {
        message.push(`--${boundary}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: 7bit", "", options.html, "");
    }

    if (options.attachments && options.attachments.length > 0) {
        for (const attachment of options.attachments) {
            message.push(`--${boundary}`);

            const contentType = attachment.contentType || "application/octet-stream";

            message.push(`Content-Type: ${contentType}; name="${attachment.filename}"`);

            const disposition = attachment.contentDisposition || "attachment";

            message.push(`Content-Disposition: ${disposition}; filename="${attachment.filename}"`);

            if (attachment.cid) {
                message.push(`Content-ID: <${attachment.cid}>`);
            }

            if (attachment.headers) {
                Object.entries(attachment.headers).forEach(([key, value]) => {
                    message.push(`${key}: ${value}`);
                });
            }

            const encoding = attachment.encoding || "base64";

            message.push(`Content-Transfer-Encoding: ${encoding}`, "");

            let attachmentContent: string | Buffer | undefined;

            if (attachment.raw !== undefined) {
                attachmentContent = attachment.raw;
            } else if (attachment.content === undefined) {
                throw new EmailError(
                    "attachment",
                    `Attachment '${attachment.filename}' must have content, raw, or be resolved from path/href before building MIME message`,
                );
            } else {
                attachmentContent = attachment.content;
            }

            if (encoding === "base64") {
                message.push(toBase64(attachmentContent));
            } else if (encoding === "7bit" || encoding === "8bit") {
                message.push(typeof attachmentContent === "string" ? attachmentContent : attachmentContent.toString("utf-8"));
            } else {
                message.push(toBase64(attachmentContent));
            }

            message.push("");
        }
    }

    message.push(`--${boundary}--`);

    return message.join("\r\n");
};

/**
 * Check if a port is available on a host
 * Only works in Node.js environments (requires net module)
 */
export const isPortAvailable = async (host: string, port: number): Promise<boolean> => {
    const net = await getNet();

    if (!net) {
        return true;
    }

    return new Promise<boolean>((resolve) => {
        const socket = new net.Socket();

        const onError = (): void => {
            socket.destroy();
            resolve(false);
        };

        socket.setTimeout(1000);
        socket.on("error", onError);
        socket.on("timeout", onError);

        socket.connect(port, host, () => {
            socket.end();
            resolve(true);
        });
    });
};
