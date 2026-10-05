import type { Mock } from "vitest";
import { vi } from "vitest";

import MockXMLHttpRequest from "./mock-xhr";

type FetchMock = Mock<(url: string, init?: RequestInit) => Promise<unknown>>;

/**
 * A `fetch` mock whose upload is created (TUS `Location` / chunked-REST `X-Upload-ID`) and
 * whose first PATCH hangs until its signal aborts, so a test can act while bytes are in flight.
 */
export const createHangingPatchFetch = (): FetchMock =>
    vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PATCH") {
            return new Promise((_resolve, reject) => {
                init.signal?.addEventListener("abort", () => {
                    reject(new DOMException("The operation was aborted.", "AbortError"));
                });
            });
        }

        if (init?.method === "POST") {
            return {
                headers: new Headers({ Location: "https://api.example.com/upload/file-1", "Upload-Offset": "0", "X-Upload-ID": "file-1" }),
                ok: true,
                status: 201,
            };
        }

        // HEAD: the chunked-REST status probe.
        return { headers: new Headers({ "X-Upload-Offset": "0" }), ok: true, status: 200 };
    });

/** The signal of the first PATCH sent through `fetchMock`, once it was sent. */
export const patchSignal = (fetchMock: FetchMock): AbortSignal | undefined =>
    fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")?.[1]?.signal ?? undefined;

/** A `fetch` mock that rejects the upload creation with a non-retryable 400. */
export const createFailingFetch = (): FetchMock =>
    vi.fn(async () => {
        return { headers: new Headers(), ok: false, status: 400, statusText: "Bad Request" };
    });

/** An XHR whose request fails with a network error. */
export class FailingXMLHttpRequest extends MockXMLHttpRequest {
    public override send = vi.fn(() => {
        setTimeout(() => {
            for (const handler of this.eventListeners.get("error") ?? []) {
                handler(new Event("error"));
            }
        }, 0);
    });
}

/** An XHR whose request never completes; `sent` collects every sent one. */
export class HangingXMLHttpRequest extends MockXMLHttpRequest {
    public static readonly sent: HangingXMLHttpRequest[] = [];

    public override send = vi.fn(() => {
        HangingXMLHttpRequest.sent.push(this);
    });
}
