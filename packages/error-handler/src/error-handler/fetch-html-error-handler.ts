import type { IncomingMessage } from "node:http";

import { htmlErrorHandler, type HtmlErrorHandlerOptions } from "./html-error-handler";

// Mock ServerResponse for HTML generation
class MockServerResponse {
    statusCode: number = 200;
    statusMessage: string = "";
    headers: Record<string, string | number | string[]> = {};
    headersSent: boolean = false;
    writable: boolean = true;
    finished: boolean = false;
    writableEnded: boolean = false;
    writableFinished: boolean = false;
    writableHighWaterMark: number = 16384;
    writableLength: number = 0;
    destroyed: boolean = false;
    writableCorked: number = 0;
    readable: boolean = false;
    readableHighWaterMark: number = 16384;
    readableLength: number = 0;
    errored: Error | null = null;
    closed: boolean = false;
    readableAborted: boolean = false;
    readableDidRead: boolean = false;
    readableEncoding: BufferEncoding | null = null;
    readableEnded: boolean = false;
    readableFlowing: boolean | null = null;
    _events: any;
    _eventsCount: number = 0;
    _maxListeners?: number;

    public body: string = "";

    setHeader(name: string, value: string | number | readonly string[]): this {
        this.headers[name.toLowerCase()] = value as string | number | string[];
        return this;
    }

    getHeader(name: string): string | number | string[] | undefined {
        return this.headers[name.toLowerCase()];
    }

    getHeaders(): Record<string, string | number | string[]> {
        return { ...this.headers };
    }

    getHeaderNames(): string[] {
        return Object.keys(this.headers);
    }

    hasHeader(name: string): boolean {
        return name.toLowerCase() in this.headers;
    }

    removeHeader(name: string): this {
        delete this.headers[name.toLowerCase()];
        return this;
    }

    writeHead(statusCode: number, headers?: Record<string, string | number | string[]>): this;
    writeHead(statusCode: number, statusMessage?: string, headers?: Record<string, string | number | string[]>): this;
    writeHead(statusCode: number, statusMessage?: string | Record<string, string | number | string[]>, headers?: Record<string, string | number | string[]>): this {
        this.statusCode = statusCode;
        if (typeof statusMessage === "string") {
            this.statusMessage = statusMessage;
        }
        if (typeof statusMessage === "object") {
            headers = statusMessage;
        }
        if (headers) {
            Object.assign(this.headers, headers);
        }
        return this;
    }

    write(chunk: string | Buffer): boolean {
        this.body += chunk.toString();
        return true;
    }

    end(data?: string | Buffer): this;
    end(data?: string | Buffer, cb?: () => void): this;
    end(data?: string | Buffer, encoding?: BufferEncoding, cb?: () => void): this;
    end(data?: string | Buffer, encoding?: BufferEncoding | (() => void), cb?: () => void): this {
        if (data) {
            this.body += data.toString();
        }
        this.finished = true;
        return this;
    }

    flushHeaders(): void {
        this.headersSent = true;
    }

    // Stub methods for interface compliance
    addListener = () => this;
    on = () => this;
    once = () => this;
    removeListener = () => this;
    off = () => this;
    removeAllListeners = () => this;
    setMaxListeners = () => this;
    getMaxListeners = () => 10;
    listeners = () => [];
    rawListeners = () => [];
    emit = () => false;
    eventNames = () => [];
    listenerCount = () => 0;
    prependListener = () => this;
    prependOnceListener = () => this;

    // Additional methods
    cork = () => {};
    uncork = () => {};
    destroy = () => this;
    read = () => null;
    setEncoding = () => this;
    pause = () => this;
    resume = () => this;
    isPaused = () => false;
    destroySoon = () => this;
    pipe = () => ({} as any);
    unpipe = () => this;
    unshift = () => {};
    wrap = () => this;
    setTimeout = () => this;
    assignSocket = () => {};
    detachSocket = () => {};
    writeContinue = () => {};
    writeEarlyHints = () => {};
    sendDate = true;
    strictContentLength = false;
    chunkedEncoding = false;
    shouldKeepAlive = true;
    useChunkedEncodingByDefault = true;
    _hasBody = true;
    _trailer = "";
    connection = null as any;
    socket = null as any;
}

export const fetchHtmlErrorHandler = (
    options: HtmlErrorHandlerOptions = {},
): ((error: Error, request: Request) => Promise<Response>) => {
    const nodeHandler = htmlErrorHandler(options);

    return async (error: Error, request: Request): Promise<Response> => {
        // Create mock request/response for the node handler
        const mockReq = {
            url: request.url,
            method: request.method,
            headers: Object.fromEntries(Array.from((request as any).headers.entries())),
        } as IncomingMessage;

        const mockRes = new MockServerResponse();

        // Call the node handler
        await nodeHandler(error, mockReq, mockRes);

        // Convert the mock response to a fetch Response
        const contentType = mockRes.getHeader("content-type") || "text/html; charset=utf-8";

        return new Response(mockRes.body, {
            status: mockRes.statusCode,
            headers: {
                "content-type": contentType,
                ...mockRes.headers,
            },
        });
    };
};
