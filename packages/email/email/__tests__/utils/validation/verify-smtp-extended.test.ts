import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkMxRecords } from "../../../src/utils/validation/check-mx-records";
import { verifySmtp } from "../../../src/utils/validation/verify-smtp";

const socketState = vi.hoisted((): { behavior: "data" | "error" | "timeout"; script: string[] } => {
    return { behavior: "data", script: [] };
});

vi.mock(import("node:net"), () => {
    class FakeSocket {
        private listeners: Record<string, ((argument: unknown) => void)[]> = {};

        private written: string[] = [];

        public setTimeout(): this {
            return this;
        }

        public on(event: string, callback: (argument: unknown) => void): this {
            this.listeners[event] ??= [];
            this.listeners[event].push(callback);

            return this;
        }

        public emit(event: string, argument?: unknown): void {
            for (const callback of this.listeners[event] ?? []) {
                callback(argument);
            }
        }

        public removeAllListeners(): this {
            this.listeners = {};

            return this;
        }

        public destroy(): void {
            // no-op for the fake socket
        }

        public connect(): this {
            if (socketState.behavior === "error") {
                queueMicrotask(() => {
                    this.emit("error", new Error("connect failed"));
                });
            } else if (socketState.behavior === "timeout") {
                queueMicrotask(() => {
                    this.emit("timeout");
                });
            } else {
                queueMicrotask(() => {
                    this.emit("data", socketState.script[0]);
                });
            }

            return this;
        }

        public write(command: string): boolean {
            this.written.push(command);

            const next = socketState.script[this.written.length];

            if (next !== undefined) {
                queueMicrotask(() => {
                    this.emit("data", next);
                });
            }

            return true;
        }
    }

    return { Socket: FakeSocket };
});

vi.mock(import("../../../src/utils/validation/check-mx-records"), () => {
    return {
        checkMxRecords: vi.fn(),
    };
});

const checkMxRecordsMock = checkMxRecords as ReturnType<typeof vi.fn>;

const happyMx = { records: [{ exchange: "mx.example.com", priority: 10 }], valid: true };

describe("verifySmtp (extended)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        socketState.behavior = "data";
        socketState.script = [];
        checkMxRecordsMock.mockResolvedValue(happyMx);
    });

    it("returns valid when the SMTP conversation succeeds", async () => {
        expect.assertions(2);

        socketState.script = ["220", "250", "250", "250"];

        const result = await verifySmtp("user@example.com");

        expect(result.valid).toBe(true);
        expect(result.smtpResponse).toBeDefined();
    });

    it("accepts a 250 greeting", async () => {
        expect.assertions(1);

        socketState.script = ["250", "250", "250", "250"];

        const result = await verifySmtp("user@example.com");

        expect(result.valid).toBe(true);
    });

    it("reports a non-existent recipient on a 550 reply", async () => {
        expect.assertions(2);

        socketState.script = ["220", "250", "250", "550"];

        const result = await verifySmtp("user@example.com");

        expect(result.valid).toBe(false);
        expect(result.error).toContain("does not exist");
    });

    it("resolves invalid on a socket error", async () => {
        expect.assertions(2);

        socketState.behavior = "error";

        const result = await verifySmtp("user@example.com");

        expect(result.valid).toBe(false);
        expect(result.error).toContain("connect failed");
    });

    it("resolves invalid on a socket timeout", async () => {
        expect.assertions(2);

        socketState.behavior = "timeout";

        const result = await verifySmtp("user@example.com");

        expect(result.valid).toBe(false);
        expect(result.error).toContain("timeout");
    });

    it("returns invalid when the MX lookup fails", async () => {
        expect.assertions(2);

        checkMxRecordsMock.mockResolvedValue({ error: "lookup failed", valid: false });

        const result = await verifySmtp("user@example.com");

        expect(result.valid).toBe(false);
        expect(result.error).toContain("lookup failed");
    });

    it("returns invalid when the MX records list is empty", async () => {
        expect.assertions(2);

        checkMxRecordsMock.mockResolvedValue({ records: [], valid: true });

        const result = await verifySmtp("user@example.com");

        expect(result.valid).toBe(false);
        expect(result.error).toContain("No MX records found");
    });

    it("falls back when the top MX record is unavailable", async () => {
        expect.assertions(2);

        checkMxRecordsMock.mockResolvedValue({ records: [undefined], valid: true });

        const result = await verifySmtp("user@example.com");

        expect(result.valid).toBe(false);
        expect(result.error).toContain("No MX record available");
    });

    it("returns a cached result when present", async () => {
        expect.assertions(1);

        const cached = { mxRecords: [], valid: true };
        const smtpCache = { get: vi.fn().mockResolvedValue(cached), set: vi.fn().mockResolvedValue(undefined) };

        const result = await verifySmtp("user@example.com", { smtpCache: smtpCache as never });

        expect(result).toStrictEqual(cached);
    });

    it("caches the result when the MX lookup fails", async () => {
        expect.assertions(2);

        checkMxRecordsMock.mockResolvedValue({ error: "lookup failed", valid: false });

        const smtpCache = { get: vi.fn().mockResolvedValue(undefined), set: vi.fn().mockResolvedValue(undefined) };

        const result = await verifySmtp("user@example.com", { smtpCache: smtpCache as never });

        expect(result.valid).toBe(false);
        expect(smtpCache.set).toHaveBeenCalledTimes(1);
    });

    it("caches a successful SMTP result", async () => {
        expect.assertions(2);

        socketState.script = ["220", "250", "250", "250"];

        const smtpCache = { get: vi.fn().mockResolvedValue(undefined), set: vi.fn().mockResolvedValue(undefined) };

        const result = await verifySmtp("user@example.com", { smtpCache: smtpCache as never });

        expect(result.valid).toBe(true);
        expect(smtpCache.set).toHaveBeenCalledTimes(1);
    });
});
