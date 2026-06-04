import type { IncomingMessage, ServerResponse } from "node:http";

import type { HtmlErrorHandlerOptions } from "./html-error-handler";
import { htmlErrorHandler } from "./html-error-handler";

type HeaderValue = string | number | string[];

// Mock ServerResponse for HTML generation
// This class stubs the full ServerResponse interface so the node-style
// htmlErrorHandler can run unchanged in a fetch context.
/* eslint-disable class-methods-use-this */
class MockServerResponse {
    public statusCode: number = 200;

    public statusMessage: string = "";

    public headers: Record<string, HeaderValue> = {};

    public headersSent: boolean = false;

    public writable: boolean = true;

    public finished: boolean = false;

    public writableEnded: boolean = false;

    public writableFinished: boolean = false;

    public writableHighWaterMark: number = 16_384;

    public writableLength: number = 0;

    public destroyed: boolean = false;

    public writableCorked: number = 0;

    public readable: boolean = false;

    public readableHighWaterMark: number = 16_384;

    public readableLength: number = 0;

    public errored: Error | undefined = undefined;

    public closed: boolean = false;

    public readableAborted: boolean = false;

    public readableDidRead: boolean = false;

    public readableEncoding: BufferEncoding | undefined = undefined;

    public readableEnded: boolean = false;

    public readableFlowing: boolean | undefined = undefined;

    public body: string = "";

    // Stub methods for interface compliance

    public sendDate = true;

    public strictContentLength = false;

    public chunkedEncoding = false;

    public shouldKeepAlive = true;

    public useChunkedEncodingByDefault = true;

    public connection: undefined = undefined;

    public socket: undefined = undefined;

    public setHeader(name: string, value: string | number | ReadonlyArray<string>): this {
        this.headers[name.toLowerCase()] = value as HeaderValue;

        return this;
    }

    public getHeader(name: string): HeaderValue | undefined {
        return this.headers[name.toLowerCase()];
    }

    public getHeaders(): Record<string, HeaderValue> {
        return { ...this.headers };
    }

    public getHeaderNames(): string[] {
        return Object.keys(this.headers);
    }

    public hasHeader(name: string): boolean {
        return name.toLowerCase() in this.headers;
    }

    public removeHeader(name: string): this {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete this.headers[name.toLowerCase()];

        return this;
    }

    public writeHead(statusCode: number, headers?: Record<string, HeaderValue>): this;
    public writeHead(statusCode: number, statusMessage?: string, headers?: Record<string, HeaderValue>): this;
    public writeHead(statusCode: number, statusMessage?: string | Record<string, HeaderValue>, headersArgument?: Record<string, HeaderValue>): this {
        this.statusCode = statusCode;

        let resolvedHeaders = headersArgument;

        if (typeof statusMessage === "string") {
            this.statusMessage = statusMessage;
        }

        if (typeof statusMessage === "object") {
            resolvedHeaders = statusMessage;
        }

        if (resolvedHeaders) {
            Object.assign(this.headers, resolvedHeaders);
        }

        return this;
    }

    public write(chunk: string | Buffer): boolean {
        this.body += chunk.toString();

        return true;
    }

    public end(data?: string | Buffer): this;
    // eslint-disable-next-line @typescript-eslint/unified-signatures
    public end(data?: string | Buffer, callback?: () => void): this;
    // eslint-disable-next-line @typescript-eslint/unified-signatures
    public end(data?: string | Buffer, encoding?: BufferEncoding, callback?: () => void): this;
    public end(data?: string | Buffer, _encoding?: BufferEncoding | (() => void), _callback?: () => void): this {
        if (data) {
            this.body += data.toString();
        }

        this.finished = true;

        return this;
    }

    public flushHeaders(): void {
        this.headersSent = true;
    }

    // Stub methods for interface compliance — these are arrow functions
    // so ESLint class-methods-use-this does not flag them.
    public addListener = (): this => this;

    public on = (): this => this;

    public once = (): this => this;

    public removeListener = (): this => this;

    public off = (): this => this;

    public removeAllListeners = (): this => this;

    public setMaxListeners = (): this => this;

    public getMaxListeners = (): number => 10;

    public listeners = (): never[] => [];

    public rawListeners = (): never[] => [];

    public emit = (): boolean => false;

    public eventNames = (): never[] => [];

    public listenerCount = (): number => 0;

    public prependListener = (): this => this;

    public prependOnceListener = (): this => this;

    // Additional methods
    public cork = (): void => {};

    public uncork = (): void => {};

    public destroy = (): this => this;

    public read = (): undefined => undefined;

    public setEncoding = (): this => this;

    public pause = (): this => this;

    public resume = (): this => this;

    public isPaused = (): boolean => false;

    public destroySoon = (): this => this;

    // eslint-disable-next-line arrow-body-style
    public pipe = (): Record<string, never> => ({});

    public unpipe = (): this => this;

    public unshift = (): void => {};

    public wrap = (): this => this;

    public setTimeout = (): this => this;

    public assignSocket = (): void => {};

    public detachSocket = (): void => {};

    public writeContinue = (): void => {};

    public writeEarlyHints = (): void => {};
}
/* eslint-enable class-methods-use-this */

export const fetchHtmlErrorHandler = (options: HtmlErrorHandlerOptions = {}): (error: Error, request: Request) => Promise<Response> => {
    const nodeHandler = htmlErrorHandler(options);

    return async (error: Error, request: Request): Promise<Response> => {
        // Create mock request/response for the node handler
        const mockRequest = {
            headers: Object.fromEntries(request.headers.entries()),
            method: request.method,
            url: request.url,
        } as IncomingMessage;

        const mockResponse = new MockServerResponse();

        // Call the node handler
        await nodeHandler(error, mockRequest, mockResponse as unknown as ServerResponse);

        // Convert the mock response to a fetch Response
        const contentType = mockResponse.getHeader("content-type") ?? "text/html; charset=utf-8";

        const headers: Record<string, string> = {
            "content-type": contentType as string,
        };

        for (const [key, value] of Object.entries(mockResponse.headers)) {
            if (key === "content-type") {
                continue;
            }

            headers[key] = Array.isArray(value) ? value.join(", ") : String(value);
        }

        return new Response(mockResponse.body, {
            headers,
            status: mockResponse.statusCode,
        });
    };
};

export default fetchHtmlErrorHandler;
