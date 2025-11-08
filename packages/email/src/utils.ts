import type { Attachment, EmailAddress, EmailOptions, ErrorOptions, Result } from "./types.js";

// Runtime detection - use global fetch if available (Node.js 18+, Deno, Bun, Cloudflare Workers)
const hasFetch = typeof globalThis.fetch !== "undefined";
const hasBuffer = typeof globalThis.Buffer !== "undefined";
const isNode = typeof process !== "undefined" && process.versions?.node;

// Conditional imports for Node.js-specific modules
let crypto: typeof import("node:crypto") | undefined;
let net: typeof import("node:net") | undefined;

// Lazy load Node.js modules only when needed
const getCrypto = (): typeof import("node:crypto") => {
    if (!crypto && isNode) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            crypto = require("node:crypto");
        } catch {
            // Ignore if not available
        }
    }
    return crypto!;
};

const getNet = (): typeof import("node:net") | undefined => {
    if (!net && isNode) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            net = require("node:net");
        } catch {
            // Ignore if not available
        }
    }
    return net;
};

/**
 * Creates a formatted error message
 */
export const createError = (component: string, message: string, opts?: ErrorOptions): Error => {
    const err = new Error(`[@visulima/email] [${component}] ${message}`, opts);
    if (Error.captureStackTrace) {
        Error.captureStackTrace(err, createError);
    }
    return err;
};

/**
 * Creates an error for missing required options
 */
export const createRequiredError = (component: string, name: string | string[]): Error => {
    if (Array.isArray(name)) {
        return createError(
            component,
            `Missing required options: ${name.map((n) => `'${n}'`).join(", ")}`,
        );
    }
    return createError(component, `Missing required option: '${name}'`);
};

/**
 * Generates a random message ID for emails
 */
export const generateMessageId = (): string => {
    const domain = "visulima.local";
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
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
 * Format email address as "Name <email@example.com>"
 */
export const formatEmailAddress = (address: EmailAddress): string => {
    if (!validateEmail(address.email)) {
        throw createError("email", `Invalid email address: ${address.email}`);
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

    // Validate email addresses
    if (options.from && options.from.email && !validateEmail(options.from.email)) {
        errors.push(`Invalid from email address: ${options.from.email}`);
    }

    const checkAddresses = (addresses: EmailAddress | EmailAddress[] | undefined, field: string) => {
        if (!addresses) return;

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

    // Validate replyTo if present
    if (options.replyTo && !validateEmail(options.replyTo.email)) {
        errors.push(`Invalid replyTo email address: ${options.replyTo.email}`);
    }

    return errors;
};

/**
 * Request options compatible with both Fetch API and Node.js http
 */
export interface RequestOptions {
    method?: string;
    headers?: Record<string, string>;
    timeout?: number;
    [key: string]: unknown;
}

/**
 * Makes an HTTP request using Fetch API (compatible with Node.js, Deno, Bun, Cloudflare Workers)
 * Falls back to node:http/https for older Node.js versions without fetch
 */
export const makeRequest = async (
    url: string | URL,
    options: RequestOptions = {},
    data?: string | Buffer | Uint8Array,
): Promise<Result<unknown>> => {
    const urlObj = typeof url === "string" ? new URL(url) : url;

    // Use Fetch API if available (Node.js 18+, Deno, Bun, Cloudflare Workers)
    if (hasFetch) {
        try {
            // Convert headers to Headers object
            const headers = new Headers();
            if (options.headers) {
                Object.entries(options.headers).forEach(([key, value]) => {
                    headers.set(key, value);
                });
            }

            // Prepare fetch options
            const fetchOptions: RequestInit = {
                method: options.method || (data ? "POST" : "GET"),
                headers,
            };

            // Add body if data is provided
            if (data) {
                if (typeof data === "string") {
                    fetchOptions.body = data;
                } else {
                    // Convert Buffer/Uint8Array to ArrayBuffer or Uint8Array
                    if (data instanceof Uint8Array) {
                        fetchOptions.body = data;
                    } else if (hasBuffer && data instanceof Buffer) {
                        // In Node.js/Bun, Buffer is Uint8Array-compatible
                        fetchOptions.body = data;
                    } else {
                        // Fallback: convert to Uint8Array
                        const uint8Array = data instanceof Uint8Array
                            ? data
                            : new Uint8Array(data as ArrayLike<number>);
                        fetchOptions.body = uint8Array;
                    }
                }
            }

            // Handle timeout using AbortController
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
                const response = await fetch(urlObj.toString(), fetchOptions);

                // Clear timeout if request completed
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }

                // Read response body
                let bodyText: string;
                const contentType = response.headers.get("content-type") || "";

                if (contentType.includes("application/json")) {
                    try {
                        const json = await response.json();
                        bodyText = JSON.stringify(json);
                    } catch {
                        // If JSON parsing fails, read as text
                        bodyText = await response.text();
                    }
                } else {
                    bodyText = await response.text();
                }

                // Parse body if it's JSON
                let parsedBody: unknown = bodyText;
                if (contentType.includes("application/json")) {
                    try {
                        parsedBody = JSON.parse(bodyText);
                    } catch {
                        // Keep as string if parsing fails
                        parsedBody = bodyText;
                    }
                }

                const isSuccess = response.status >= 200 && response.status < 300;

                // Convert Headers to plain object
                const headersObj: Record<string, string> = {};
                response.headers.forEach((value, key) => {
                    headersObj[key] = value;
                });

                return {
                    success: isSuccess,
                    data: {
                        statusCode: response.status,
                        headers: headersObj,
                        body: parsedBody,
                    },
                    error: isSuccess
                        ? undefined
                        : createError(
                              "http",
                              `Request failed with status ${response.status}`,
                              { code: response.status.toString() },
                          ),
                };
            } catch (error) {
                // Clear timeout on error
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }

                if (error instanceof Error && error.name === "AbortError") {
                    return {
                        success: false,
                        error: createError("http", `Request timed out after ${options.timeout}ms`),
                    };
                }

                throw error;
            }
        } catch (error) {
            return {
                success: false,
                error: createError(
                    "http",
                    `Request failed: ${error instanceof Error ? error.message : String(error)}`,
                    { cause: error instanceof Error ? error : new Error(String(error)) },
                ),
            };
        }
    }

    // Fallback to node:http/https for older Node.js versions without fetch
    if (!hasFetch && isNode) {
        try {
            // Lazy load node:http/https only when needed
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const httpModule = require("node:http");
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const httpsModule = require("node:https");

            return new Promise((resolve) => {
                const protocol = urlObj.protocol === "https:" ? httpsModule : httpModule;

                const req = protocol.request(urlObj, options as never, (res) => {
                    const chunks: Buffer[] = [];

                    res.on("data", (chunk) => chunks.push(chunk));

                    res.on("end", () => {
                        const body = Buffer.concat(chunks).toString();
                        let parsedBody: unknown = body;

                        // Try to parse as JSON if the content-type is json
                        if (res.headers["content-type"]?.includes("application/json")) {
                            try {
                                parsedBody = JSON.parse(body);
                            } catch {
                                // If it fails, keep the raw body
                            }
                        }

                        const isSuccess =
                            res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300;

                        resolve({
                            success: isSuccess,
                            data: {
                                statusCode: res.statusCode,
                                headers: res.headers as Record<string, string>,
                                body: parsedBody,
                            },
                            error: isSuccess
                                ? undefined
                                : createError(
                                      "http",
                                      `Request failed with status ${res.statusCode}`,
                                      { code: res.statusCode?.toString() },
                                  ),
                        });
                    });
                });

                req.on("error", (error) => {
                    resolve({
                        success: false,
                        error: createError("http", `Request failed: ${error.message}`, { cause: error }),
                    });
                });

                if (options.timeout) {
                    req.setTimeout(options.timeout, () => {
                        req.destroy();
                        resolve({
                            success: false,
                            error: createError("http", `Request timed out after ${options.timeout}ms`),
                        });
                    });
                }

                if (data) {
                    req.write(data);
                }

                req.end();
            });
        } catch {
            // If node:http/https is not available, fall through to error
        }
    }

    // No fetch and no node:http - this shouldn't happen in practice
    return {
        success: false,
        error: createError("http", "No HTTP client available (fetch or node:http/https required)"),
    };
};

/**
 * Helper function to retry a function with exponential backoff
 */
export const retry = async <T>(
    fn: () => Promise<Result<T>>,
    retries: number = 3,
    delay: number = 300,
): Promise<Result<T>> => {
    try {
        const result = await fn();
        if (result.success || retries <= 0) {
            return result;
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
        return retry(fn, retries - 1, delay * 2);
    } catch (error) {
        if (retries <= 0) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
            };
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
        return retry(fn, retries - 1, delay * 2);
    }
};

/**
 * Generate boundary string for multipart emails
 * Works across Node.js, Deno, Bun, and Workers
 */
export const generateBoundary = (): string => {
    const cryptoModule = getCrypto();
    if (cryptoModule) {
        // Node.js: use crypto.randomBytes
        return `----_=_NextPart_${cryptoModule.randomBytes(16).toString("hex")}`;
    }

    // Fallback for environments without node:crypto (Deno, Workers)
    // Use crypto.getRandomValues which is available in all modern environments
    const array = new Uint8Array(16);
    if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
        globalThis.crypto.getRandomValues(array);
    } else {
        // Fallback: use Math.random (less secure but works everywhere)
        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
    }

    // Convert to hex string
    const hex = Array.from(array)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    return `----_=_NextPart_${hex}`;
};

/**
 * Build a MIME message from email options
 */
export const buildMimeMessage = <T extends EmailOptions>(options: T): string => {
    const boundary = generateBoundary();
    const message: string[] = [];

    // Headers
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

    message.push(`Subject: ${options.subject}`);
    message.push("MIME-Version: 1.0");

    // Custom headers
    if (options.headers) {
        Object.entries(options.headers).forEach(([key, value]) => {
            message.push(`${key}: ${value}`);
        });
    }

    // Content-Type with boundary
    message.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    message.push("");

    // Text part
    if (options.text) {
        message.push(`--${boundary}`);
        message.push("Content-Type: text/plain; charset=UTF-8");
        message.push("Content-Transfer-Encoding: 7bit");
        message.push("");
        message.push(options.text);
        message.push("");
    }

    // HTML part
    if (options.html) {
        message.push(`--${boundary}`);
        message.push("Content-Type: text/html; charset=UTF-8");
        message.push("Content-Transfer-Encoding: 7bit");
        message.push("");
        message.push(options.html);
        message.push("");
    }

    // Attachments
    if (options.attachments && options.attachments.length > 0) {
        options.attachments.forEach((attachment: Attachment) => {
            message.push(`--${boundary}`);
            message.push(
                `Content-Type: ${attachment.contentType || "application/octet-stream"}; name="${attachment.filename}"`,
            );
            message.push(`Content-Disposition: ${attachment.disposition || "attachment"}; filename="${attachment.filename}"`);
            if (attachment.cid) {
                message.push(`Content-ID: <${attachment.cid}>`);
            }
            message.push("Content-Transfer-Encoding: base64");
            message.push("");

            // Handle content conversion for different runtimes
            let base64Content: string;
            if (typeof attachment.content === "string") {
                if (hasBuffer) {
                    base64Content = Buffer.from(attachment.content, "utf8").toString("base64");
                } else {
                    // Use TextEncoder/TextDecoder for environments without Buffer
                    const encoder = new TextEncoder();
                    const bytes = encoder.encode(attachment.content);
                    base64Content = btoa(String.fromCharCode(...bytes));
                }
            } else if (hasBuffer && attachment.content instanceof Buffer) {
                base64Content = attachment.content.toString("base64");
            } else {
                // Uint8Array or similar
                const uint8Array = attachment.content instanceof Uint8Array
                    ? attachment.content
                    : new Uint8Array(attachment.content as ArrayLike<number>);
                if (hasBuffer) {
                    base64Content = Buffer.from(uint8Array).toString("base64");
                } else {
                    base64Content = btoa(String.fromCharCode(...uint8Array));
                }
            }
            message.push(base64Content);
            message.push("");
        });
    }

    message.push(`--${boundary}--`);

    return message.join("\r\n");
};

/**
 * Check if a port is available on a host
 * Only works in Node.js environments (requires net module)
 */
export const isPortAvailable = async (host: string, port: number): Promise<boolean> => {
    const netModule = getNet();
    if (!netModule) {
        // In non-Node.js environments, assume port is available
        // This is mainly used for SMTP provider initialization
        return true;
    }

    return new Promise<boolean>((resolve) => {
        const socket = new netModule.Socket();

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
