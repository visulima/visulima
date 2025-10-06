import type { UploadClientConfig } from "./types";

export interface HttpRequestOptions {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
    headers?: Record<string, string>;
    body?: string | FormData | ArrayBuffer | Blob | ReadableStream;
    signal?: AbortSignal;
}

export interface HttpResponse {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: ReadableStream<Uint8Array> | null;
    url: string;
}

export class HttpClient {
    private config: Required<UploadClientConfig>;

    constructor(config: UploadClientConfig) {
        this.config = {
            baseUrl: config.baseUrl,
            headers: config.headers || {},
            timeout: config.timeout || 30000,
            retries: config.retries || 3,
            retryDelay: config.retryDelay || 1000,
            chunkSize: config.chunkSize || 1024 * 1024, // 1MB
            maxConcurrent: config.maxConcurrent || 3,
        };
    }

    /**
     * Make an HTTP request with retry logic
     */
    async request(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
        const fullUrl = url.startsWith("http") ? url : `${this.config.baseUrl}${url}`;

        const requestOptions: RequestInit = {
            method: options.method || "GET",
            headers: {
                ...this.config.headers,
                ...options.headers,
            },
            signal: options.signal,
        };

        if (options.body) {
            requestOptions.body = options.body;
        }

        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= this.config.retries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

                // Merge abort signals
                const signal = options.signal
                    ? AbortSignal.any([options.signal, controller.signal])
                    : controller.signal;

                const response = await fetch(fullUrl, {
                    ...requestOptions,
                    signal,
                });

                clearTimeout(timeoutId);

                // Convert headers to a plain object
                const headers: Record<string, string> = {};
                response.headers.forEach((value, key) => {
                    headers[key] = value;
                });

                return {
                    status: response.status,
                    statusText: response.statusText,
                    headers,
                    body: response.body,
                    url: response.url,
                };
            } catch (error) {
                lastError = error as Error;

                // Don't retry if the request was aborted
                if (error instanceof Error && error.name === "AbortError") {
                    throw error;
                }

                // Don't retry on the last attempt
                if (attempt === this.config.retries) {
                    break;
                }

                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * (attempt + 1)));
            }
        }

        throw lastError || new Error("Request failed after all retries");
    }

    /**
     * Make a GET request
     */
    async get(url: string, options: Omit<HttpRequestOptions, "method" | "body"> = {}): Promise<HttpResponse> {
        return this.request(url, { ...options, method: "GET" });
    }

    /**
     * Make a POST request
     */
    async post(url: string, options: Omit<HttpRequestOptions, "method"> = {}): Promise<HttpResponse> {
        return this.request(url, { ...options, method: "POST" });
    }

    /**
     * Make a PUT request
     */
    async put(url: string, options: Omit<HttpRequestOptions, "method"> = {}): Promise<HttpResponse> {
        return this.request(url, { ...options, method: "PUT" });
    }

    /**
     * Make a PATCH request
     */
    async patch(url: string, options: Omit<HttpRequestOptions, "method"> = {}): Promise<HttpResponse> {
        return this.request(url, { ...options, method: "PATCH" });
    }

    /**
     * Make a DELETE request
     */
    async delete(url: string, options: Omit<HttpRequestOptions, "method" | "body"> = {}): Promise<HttpResponse> {
        return this.request(url, { ...options, method: "DELETE" });
    }

    /**
     * Make a HEAD request
     */
    async head(url: string, options: Omit<HttpRequestOptions, "method" | "body"> = {}): Promise<HttpResponse> {
        return this.request(url, { ...options, method: "HEAD" });
    }

    /**
     * Make an OPTIONS request
     */
    async options(url: string, options: Omit<HttpRequestOptions, "method" | "body"> = {}): Promise<HttpResponse> {
        return this.request(url, { ...options, method: "OPTIONS" });
    }

    /**
     * Read response body as text
     */
    async readAsText(response: HttpResponse): Promise<string> {
        if (!response.body) return "";

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let result = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            result += decoder.decode(value, { stream: true });
        }

        return result;
    }

    /**
     * Read response body as JSON
     */
    async readAsJson<T = any>(response: HttpResponse): Promise<T> {
        const text = await this.readAsText(response);
        return JSON.parse(text);
    }

    /**
     * Read response body as ArrayBuffer
     */
    async readAsArrayBuffer(response: HttpResponse): Promise<ArrayBuffer> {
        if (!response.body) return new ArrayBuffer(0);

        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }

        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;

        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        return result.buffer;
    }
}
