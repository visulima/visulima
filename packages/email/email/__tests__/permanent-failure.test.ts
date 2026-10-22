import { afterEach, describe, expect, it, vi } from "vitest";

import EmailError from "../src/errors/email-error";
import { createMail } from "../src/mail";
import { resendProvider } from "../src/providers/resend/index";
import { createWorker, MemoryQueue } from "../src/queue";
import type { EmailOptions, EmailResult, Result } from "../src/types";
import { isPermanentStatusCode, makeRequest } from "../src/utils/make-request";

const message: EmailOptions = {
    from: { email: "from@example.com" },
    subject: "Hi",
    text: "body",
    to: { email: "to@example.com" },
};

const failure = (error: Error): Result<EmailResult> => {
    return { error, success: false };
};

const stubFetchStatus = (status: number): void => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(Response.json({ message: "rejected" }, { status }))));
};

describe(EmailError, () => {
    it("defaults permanent to false", () => {
        expect.assertions(1);

        expect(new EmailError("test", "boom").permanent).toBe(false);
    });

    it("keeps an explicit permanent flag", () => {
        expect.assertions(1);

        expect(new EmailError("test", "rejected", { permanent: true }).permanent).toBe(true);
    });
});

describe(isPermanentStatusCode, () => {
    it.each([
        [400, true],
        [401, true],
        [403, true],
        [404, true],
        [408, false],
        [409, false],
        [422, true],
        [429, false],
        [500, false],
        [502, false],
        [503, false],
        [504, false],
    ])("classifies HTTP %i as permanent=%s", (statusCode, expected) => {
        expect.assertions(1);

        expect(isPermanentStatusCode(statusCode)).toBe(expected);
    });
});

describe(makeRequest, () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it.each([
        [400, true],
        [409, false],
        [422, true],
        [429, false],
        [503, false],
    ])("flags a %i response as permanent=%s", async (status, expected) => {
        expect.assertions(1);

        stubFetchStatus(status);

        const result = await makeRequest("https://api.example.com/send", { method: "POST" });

        expect((result.error as EmailError | undefined)?.permanent).toBe(expected);
    });

    it("does not flag a network failure as permanent", async () => {
        expect.assertions(1);

        vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("fetch failed"))));

        const result = await makeRequest("https://api.example.com/send", { method: "POST" });

        expect((result.error as EmailError | undefined)?.permanent).toBe(false);
    });
});

describe("worker", () => {
    it("dead-letters a permanent failure on its first attempt without retrying", async () => {
        expect.assertions(3);

        const queue = new MemoryQueue();
        const send = vi.fn(() => Promise.resolve(failure(new EmailError("test", "rejected", { permanent: true }))));
        const onDeadLetter = vi.fn();

        queue.enqueue(message);
        await createWorker({ backoff: () => 0, maxAttempts: 3, onDeadLetter, queue, send }).drain();

        expect(send).toHaveBeenCalledTimes(1);
        expect(onDeadLetter).toHaveBeenCalledTimes(1);
        expect(queue.reserve()).toBeUndefined();
    });

    it("still retries a failure that is not flagged", async () => {
        expect.assertions(2);

        const queue = new MemoryQueue();
        const send = vi.fn(() => Promise.resolve(failure(new EmailError("test", "unavailable"))));
        const onDeadLetter = vi.fn();

        queue.enqueue(message);
        await createWorker({ backoff: () => 0, maxAttempts: 3, onDeadLetter, queue, send }).drain();

        expect(send).toHaveBeenCalledTimes(3);
        expect(onDeadLetter).toHaveBeenCalledTimes(1);
    });

    it("treats permanent=false the same as an unflagged error", async () => {
        expect.assertions(1);

        const queue = new MemoryQueue();
        const send = vi.fn(() => Promise.resolve(failure(new EmailError("test", "unavailable", { permanent: false }))));

        queue.enqueue(message);
        await createWorker({ backoff: () => 0, maxAttempts: 3, queue, send }).drain();

        expect(send).toHaveBeenCalledTimes(3);
    });

    it("honours a flag set on a plain error by a caller's own send function", async () => {
        expect.assertions(1);

        const queue = new MemoryQueue();
        const rejected = Object.assign(new Error("rejected"), { permanent: true });
        const send = vi.fn(() => Promise.resolve(failure(rejected)));

        queue.enqueue(message);
        await createWorker({ backoff: () => 0, maxAttempts: 3, queue, send }).drain();

        expect(send).toHaveBeenCalledTimes(1);
    });
});

describe("end to end through Resend", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("dead-letters a 422 from the provider on the first attempt", async () => {
        expect.assertions(3);

        stubFetchStatus(422);

        const mail = createMail(resendProvider({ apiKey: "re_test123" }));
        const queue = new MemoryQueue();
        const onDeadLetter = vi.fn();

        queue.enqueue(message);
        await createWorker({ backoff: () => 0, maxAttempts: 3, onDeadLetter, queue, send: mail.send.bind(mail) }).drain();

        expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
        expect(onDeadLetter).toHaveBeenCalledTimes(1);
        expect((onDeadLetter.mock.calls[0]?.[1] as Result<EmailResult>).error).toHaveProperty("permanent", true);
    });
});
