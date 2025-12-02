/* eslint-disable class-methods-use-this */
import type { IncomingMessage, ServerResponse } from "node:http";

import type { HtmlErrorHandlerOptions } from "./html-error-handler";
import { htmlErrorHandler } from "./html-error-handler";

// Mock ServerResponse for HTML generation
class MockServerResponse {
    public statusCode: number = 200;

    public statusMessage: string = "";

    public headers: Record<string, string | number | string[]> = {};

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

    public errored: Error | null = null;

    public closed: boolean = false;

    public readableAborted: boolean = false;

    public readableDidRead: boolean = false;

    public readableEncoding: BufferEncoding | null = null;

    public readableEnded: boolean = false;

    public readableFlowing: boolean | null = null;

    public _events: any;

    public _eventsCount: number = 0;

    public _maxListeners?: number;

    public body: string = "";

    // Stub methods for interface compliance

    public sendDate = true;

    public strictContentLength = false;

    public chunkedEncoding = false;

    public shouldKeepAlive = true;

    public useChunkedEncodingByDefault = true;

    public _hasBody = true;

    public _trailer = "";

    // eslint-disable-next-line unicorn/no-null
    public connection = null as any;

    // eslint-disable-next-line unicorn/no-null
    public socket = null as any;

    public setHeader(name: string, value: string | number | ReadonlyArray<string>): this {
        this.headers[name.toLowerCase()] = value as string | number | string[];

        return this;
    }

    public getHeader(name: string): string | number | string[] | undefined {
        return this.headers[name.toLowerCase()];
    }

    public getHeaders(): Record<string, string | number | string[]> {
        return { ...this.headers };
    }

    public getHeaderNames(): string[] {
        return Object.keys(this.headers);
    }

    public hasHeader(name: string): boolean {
        return name.toLowerCase() in this.headers;
    }

    public removeHeader(name: string): this {
        delete this.headers[name.toLowerCase()];

        return this;
    }

    public writeHead(statusCode: number, headers?: Record<string, string | number | string[]>): this;
    public writeHead(statusCode: number, statusMessage?: string, headers?: Record<string, string | number | string[]>): this;
    public writeHead(
        statusCode: number,
        statusMessage?: string | Record<string, string | number | string[]>,
        headers?: Record<string, string | number | string[]>,
    ): this {
        this.statusCode = statusCode;

        if (typeof statusMessage === "string") {
            this.statusMessage = statusMessage;
        }

        if (typeof statusMessage === "object") {
            // eslint-disable-next-line no-param-reassign
            headers = statusMessage;
        }

        if (headers) {
            Object.assign(this.headers, headers);
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
    // @ts-expect-error TS6133: 'callback' is declared but its value is never read.

    public end(data?: string | Buffer, encoding?: BufferEncoding | (() => void), callback?: () => void): this {
        if (data) {
            this.body += data.toString();
        }

        this.finished = true;

        return this;
    }

    public flushHeaders(): void {
        this.headersSent = true;
    }

    // Stub methods for interface compliance
    public addListener = () => this;

    public on = () => this;

    public once = () => this;

    public removeListener = () => this;

    public off = () => this;

    public removeAllListeners = () => this;

    public setMaxListeners = () => this;

    public getMaxListeners = () => 10;

    public listeners = () => [];

    public rawListeners = () => [];

    public emit = () => false;

    public eventNames = () => [];

    public listenerCount = () => 0;

    public prependListener = () => this;

    public prependOnceListener = () => this;

    // Additional methods
    public cork = () => {};

    public uncork = () => {};

    public destroy = () => this;

    // eslint-disable-next-line unicorn/no-null
    public read = () => null;

    public setEncoding = () => this;

    public pause = () => this;

    public resume = () => this;

    public isPaused = () => false;

    public destroySoon = () => this;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public pipe = () => ({}) as any;

    public unpipe = () => this;

    public unshift = () => {};

    public wrap = () => this;

    public setTimeout = () => this;

    public assignSocket = () => {};

    public detachSocket = () => {};

    public writeContinue = () => {};

    public writeEarlyHints = () => {};
}

export const fetchHtmlErrorHandler = (options: HtmlErrorHandlerOptions = {}): (error: Error, request: Request) => Promise<Response> => {
    const nodeHandler = htmlErrorHandler(options);

    return async (error: Error, request: Request): Promise<Response> => {
        // Create mock request/response for the node handler
        const mockRequest = {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            headers: Object.fromEntries((request as any).headers.entries()),
            method: request.method,
            url: request.url,
        } as IncomingMessage;

        const mockResponse = new MockServerResponse();

        // Call the node handler
        await nodeHandler(error, mockRequest, mockResponse as unknown as ServerResponse<IncomingMessage>);

        // Convert the mock response to a fetch Response
        const contentType = mockResponse.getHeader("content-type") || "text/html; charset=utf-8";

        return new Response(mockResponse.body, {
            headers: {
                "content-type": contentType as string,
                ...mockResponse.headers,
            },
            status: mockResponse.statusCode,
        });
    };
};

export default fetchHtmlErrorHandler;
