import { afterEach, describe, expect, it, vi } from "vitest";

import autoSendProvider from "../../src/providers/autosend/provider";

// The other provider suites stub `src/utils/retry`, so this one deliberately drives the real
// helper end-to-end: it is what proves a provider inherits the shared retry policy.

const message = {
    from: { email: "a@b.com" },
    subject: "hi",
    text: "body",
    to: { email: "c@d.com" },
};

const jsonResponse = (status: number, body: unknown) =>
    Response.json(body, { headers: { "content-type": "application/json" }, status });

describe("real retry policy through the autosend provider", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("sends the message exactly once when the request times out", async () => {
        expect.assertions(2);

        // Never resolves, so the provider's own timeout aborts it.
        const fetchMock = vi.fn(async (_url: unknown, init: { signal?: AbortSignal }) => await new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
                const error = new Error("aborted");

                error.name = "AbortError";
                reject(error);
            });
        }));

        vi.stubGlobal("fetch", fetchMock);

        const provider = autoSendProvider({ apiKey: "k", retries: 3, timeout: 20 });
        const result = await provider.sendEmail(message);

        expect(result.success).toBe(false);
        // The message may already have been accepted, so it must not be transmitted again.
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("retries a throttled request until it is accepted", async () => {
        expect.assertions(2);

        let call = 0;
        const fetchMock = vi.fn(() => {
            call += 1;

            return Promise.resolve(
                call === 1 ? jsonResponse(429, { message: "slow down" }) : jsonResponse(200, { data: { emailId: "id-1" }, success: true }),
            );
        });

        vi.stubGlobal("fetch", fetchMock);

        const provider = autoSendProvider({ apiKey: "k", retries: 3, timeout: 1000 });
        const result = await provider.sendEmail(message);

        expect(result.success).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("does not repeat a send after an ambiguous 500", async () => {
        expect.assertions(1);

        const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(500, { message: "boom" })));

        vi.stubGlobal("fetch", fetchMock);

        const provider = autoSendProvider({ apiKey: "k", retries: 3, timeout: 1000 });

        await provider.sendEmail(message);

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
