import { vi } from "vitest";

/**
 * Mock XMLHttpRequest for testing upload functionality.
 * Can be extended for custom behavior in specific tests.
 */

export class MockXMLHttpRequest {
    public readyState = 0;

    public status = 200;

    public statusText = "OK";

    public responseText = "";

    public response = "";

    protected eventListeners = new Map<string, Set<(event: Event) => void>>();

    protected uploadEventListeners = new Map<string, Set<(event: ProgressEvent) => void>>();

    public upload = {
        addEventListener: vi.fn((event: string, handler: (event: ProgressEvent) => void) => {
            if (!this.uploadEventListeners.has(event)) {
                this.uploadEventListeners.set(event, new Set());
            }

            this.uploadEventListeners.get(event)?.add(handler);
        }),
        removeEventListener: vi.fn(),
    };

    public open = vi.fn();

    public send = vi.fn(() => {
        // Simulate upload progress
        setTimeout(() => {
            const handlers = this.uploadEventListeners.get("progress");

            if (handlers) {
                const progressEvent = {
                    lengthComputable: true,
                    loaded: 50,
                    total: 100,
                } as ProgressEvent;

                handlers.forEach((handler) => handler(progressEvent));
            }
        }, 10);

        // Simulate completion
        setTimeout(() => {
            this.readyState = 4;
            this.status = 200;
            this.responseText = JSON.stringify({
                contentType: "image/jpeg",
                id: "test-id",
                name: "test-name",
                originalName: "test.jpg",
                size: 100,
                status: "completed",
            });
            this.response = this.responseText;

            const handlers = this.eventListeners.get("load");

            if (handlers) {
                handlers.forEach((handler) => handler(new Event("load")));
            }
        }, 20);
    });

    public setRequestHeader = vi.fn();

    public getResponseHeader = vi.fn(undefined);

    public addEventListener = vi.fn((event: string, handler: (event: Event) => void) => {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }

        this.eventListeners.get(event)?.add(handler);
    });

    public removeEventListener = vi.fn();

    public abort = vi.fn(() => {
        const handlers = this.eventListeners.get("abort");

        if (handlers) {
            handlers.forEach((handler) => handler(new Event("abort")));
        }
    });
}
