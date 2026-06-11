import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { PailBrowser } from "../../src/pail.browser";
import RawReporter from "../../src/reporter/raw/raw-reporter.browser";
import { createWideEvent, WideEvent } from "../../src/wide-event";

const DURATION_MS_REGEX = /^\d+ms$/;
const ISO_TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}T/;

const createMockPail = () => {
    const pail = new PailBrowser({
        logLevel: "debug",
        processors: [],
        rawReporter: new RawReporter(),
        reporters: [new RawReporter()],
    });

    return pail;
};

describe("wideEvent", () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "debug").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("constructor", () => {
        it("should create a WideEvent with required options", () => {
            expect.assertions(2);

            const pail = createMockPail();
            const wideEvent = new WideEvent({ name: "api.checkout", pail });

            expect(wideEvent.name).toBe("api.checkout");
            expect(wideEvent.getLevel()).toBe("info");
        });

        it("should create a WideEvent with all options", () => {
            expect.assertions(2);

            const pail = createMockPail();
            const wideEvent = new WideEvent({
                autoEmit: false,
                name: "api.checkout",
                pail,
                service: "checkout-service",
                type: "debug",
            });

            expect(wideEvent.name).toBe("api.checkout");
            expect(wideEvent.getLevel()).toBe("info");
        });
    });

    describe(createWideEvent, () => {
        it("should create a WideEvent instance", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ name: "test.event", pail });

            expect(wideEvent).toBeInstanceOf(WideEvent);
        });
    });

    describe("set", () => {
        it("should accumulate data via set()", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ name: "test", pail });

            wideEvent.set({ user: { id: 1 } });

            expect(wideEvent.getData()).toStrictEqual({ user: { id: 1 } });
        });

        it("should deep merge data on multiple set() calls", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent<{ user: { id: number; plan: string } }>({ name: "test", pail });

            wideEvent.set({ user: { id: 1 } });
            wideEvent.set({ user: { plan: "pro" } });

            expect(wideEvent.getData()).toStrictEqual({ user: { id: 1, plan: "pro" } });
        });

        it("should replace arrays instead of merging them", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent<{ tags: string[] }>({ name: "test", pail });

            wideEvent.set({ tags: ["a", "b"] });
            wideEvent.set({ tags: ["c"] });

            expect(wideEvent.getData()).toStrictEqual({ tags: ["c"] });
        });

        it("should handle nested deep merge", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent<{ a: { b: { c: number; d: number } } }>({ name: "test", pail });

            wideEvent.set({ a: { b: { c: 1 } } });
            wideEvent.set({ a: { b: { d: 2 } } });

            expect(wideEvent.getData()).toStrictEqual({ a: { b: { c: 1, d: 2 } } });
        });

        it("should return this for chaining", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ name: "test", pail });

            const result = wideEvent.set({ key: "value" });

            expect(result).toBe(wideEvent);
        });
    });

    describe("emit", () => {
        it("should emit a wide event through pail", () => {
            expect.assertions(3);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "api.checkout", pail });

            wideEvent.set({ user: { id: 1 } });
            wideEvent.emit();

            expect(consoleSpy).toHaveBeenCalledTimes(1);

            const emitted = consoleSpy.mock.calls[0]?.[0] as Record<string, unknown>;

            expect(emitted).toHaveProperty("event", "api.checkout");
            expect(emitted).toHaveProperty("user", { id: 1 });
        });

        it("should include timestamp in emitted event", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.emit();

            const emitted = consoleSpy.mock.calls[0]?.[0] as Record<string, unknown>;

            expect(emitted).toHaveProperty("timestamp");
        });

        it("should include duration and duration_ms in emitted event", () => {
            expect.assertions(2);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.emit();

            const emitted = consoleSpy.mock.calls[0]?.[0] as Record<string, unknown>;

            expect(emitted).toHaveProperty("duration_ms");
            expect(emitted).toHaveProperty("duration");
        });

        it("should format duration as milliseconds when under 1000ms", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            // Emit immediately — duration should be well under 1000ms
            wideEvent.emit();

            const emitted = consoleSpy.mock.calls[0]?.[0] as Record<string, unknown>;

            expect(emitted.duration).toMatch(DURATION_MS_REGEX);
        });

        it("should format duration as seconds when at or above 1000ms", () => {
            expect.assertions(1);

            const pail = createMockPail();
            // Drive startTime (constructor) and the emit timestamp so the elapsed time crosses 1000ms.
            const nowSpy = vi.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValueOnce(1500);
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.emit();
            nowSpy.mockRestore();

            const emitted = consoleSpy.mock.calls[0]?.[0] as Record<string, unknown>;

            expect(emitted.duration).toBe("1.50s");
        });

        it("should only emit once", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.emit();
            wideEvent.emit();
            wideEvent.emit();

            expect(consoleSpy).toHaveBeenCalledTimes(1);
        });

        it("should use error log type when an error is attached", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const errorSpy = vi.spyOn(console, "error");
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.setError(new Error("fail"));
            wideEvent.emit();

            expect(errorSpy).toHaveBeenCalledTimes(1);
        });

        it("should allow type override even with error attached", () => {
            expect.assertions(2);

            const pail = createMockPail();
            const errorSpy = vi.spyOn(console, "error");
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.setError(new Error("fail"));
            // Override to "warn" instead of auto-detected "error"
            // Note: pail's "warn" type uses log level "warning" which the RawReporter
            // routes through console.log (not console.warn), so we check console.log
            wideEvent.emit("warn");

            expect(consoleSpy).toHaveBeenCalledTimes(1);
            expect(errorSpy).not.toHaveBeenCalled();
        });

        it("should include service in emitted event when set", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail, service: "auth-service" });

            wideEvent.emit();

            const emitted = consoleSpy.mock.calls[0]?.[0] as Record<string, unknown>;

            expect(emitted).toHaveProperty("service", "auth-service");
        });

        it("should not include service when not set", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.emit();

            const emitted = consoleSpy.mock.calls[0]?.[0] as Record<string, unknown>;

            expect(emitted).not.toHaveProperty("service");
        });

        it("should include status when set", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.setStatus(200);
            wideEvent.emit();

            const emitted = consoleSpy.mock.calls[0]?.[0] as Record<string, unknown>;

            expect(emitted).toHaveProperty("status", 200);
        });

        it("should not include status when not set", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.emit();

            const emitted = consoleSpy.mock.calls[0]?.[0] as Record<string, unknown>;

            expect(emitted).not.toHaveProperty("status");
        });

        it("should not include requestLogs when empty", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.emit();

            const emitted = consoleSpy.mock.calls[0]?.[0] as Record<string, unknown>;

            expect(emitted).not.toHaveProperty("requestLogs");
        });
    });

    describe("error serialization", () => {
        it("should serialize error with name, message, and stack", () => {
            expect.assertions(3);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });
            const testError = new Error("Something broke");

            wideEvent.setError(testError);
            wideEvent.emit();

            // Error type emits via console.error — get from that spy
            // Actually the RawReporter uses console.log for everything, let's check consoleSpy
            // eslint-disable-next-line no-console
            const emitted = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;
            const serializedError = emitted?.error as Record<string, unknown>;

            expect(serializedError).toHaveProperty("name", "Error");
            expect(serializedError).toHaveProperty("message", "Something broke");
            expect(serializedError).toHaveProperty("stack");

            expectTypeOf(serializedError.stack).toBeString();
        });

        it("should omit stack when the error has no stack", () => {
            expect.assertions(2);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });
            const testError = new Error("No stack");

            testError.stack = undefined;

            wideEvent.setError(testError);
            wideEvent.emit();

            // eslint-disable-next-line no-console
            const emitted = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;
            const serializedError = emitted?.error as Record<string, unknown>;

            expect(serializedError).toHaveProperty("message", "No stack");
            expect(serializedError).not.toHaveProperty("stack");
        });

        it("should extract status from error", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });
            const testError = new Error("Not found") as Error & { status: number };

            testError.status = 404;

            wideEvent.setError(testError);
            wideEvent.emit();

            // eslint-disable-next-line no-console
            const emitted = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;
            const serializedError = emitted?.error as Record<string, unknown>;

            expect(serializedError).toHaveProperty("status", 404);
        });

        it("should extract statusCode from error", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });
            const testError = new Error("Not found") as Error & { statusCode: number };

            testError.statusCode = 404;

            wideEvent.setError(testError);
            wideEvent.emit();

            // eslint-disable-next-line no-console
            const emitted = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;
            const serializedError = emitted?.error as Record<string, unknown>;

            expect(serializedError).toHaveProperty("status", 404);
        });

        it("should prefer status over statusCode", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });
            const testError = new Error("Conflict") as Error & { status: number; statusCode: number };

            testError.status = 409;
            testError.statusCode = 500;

            wideEvent.setError(testError);
            wideEvent.emit();

            // eslint-disable-next-line no-console
            const emitted = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;
            const serializedError = emitted?.error as Record<string, unknown>;

            expect(serializedError).toHaveProperty("status", 409);
        });

        it("should extract data from error", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });
            const testError = new Error("Validation") as Error & { data: unknown };

            testError.data = { field: "email", reason: "invalid" };

            wideEvent.setError(testError);
            wideEvent.emit();

            // eslint-disable-next-line no-console
            const emitted = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;
            const serializedError = emitted?.error as Record<string, unknown>;

            expect(serializedError).toHaveProperty("data", { field: "email", reason: "invalid" });
        });

        it("should serialize cause chain recursively", () => {
            expect.assertions(3);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            const rootCause = new Error("Root cause");
            const wrapperError = new Error("Wrapper", { cause: rootCause });

            wideEvent.setError(wrapperError);
            wideEvent.emit();

            // eslint-disable-next-line no-console
            const emitted = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;
            const serializedError = emitted?.error as Record<string, unknown>;
            const cause = serializedError?.cause as Record<string, unknown>;

            expect(serializedError).toHaveProperty("message", "Wrapper");
            expect(cause).toHaveProperty("message", "Root cause");
            expect(cause).toHaveProperty("name", "Error");
        });

        it("should omit stack but keep data when the error has no stack", () => {
            expect.assertions(3);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });
            const testError = new Error("No stack with data") as Error & { data: unknown };

            testError.stack = undefined;
            testError.data = { field: "email", reason: "invalid" };

            wideEvent.setError(testError);
            wideEvent.emit();

            // eslint-disable-next-line no-console
            const emitted = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;
            const serializedError = emitted?.error as Record<string, unknown>;

            expect(serializedError).toHaveProperty("message", "No stack with data");
            expect(serializedError).not.toHaveProperty("stack");
            expect(serializedError).toHaveProperty("data", { field: "email", reason: "invalid" });
        });

        it("should drop a non-Error cause (instanceof Error gate)", () => {
            expect.assertions(2);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });
            const testError = new Error("Wrapper") as Error & { cause: unknown };

            // Non-Error cause (string). wide-event intentionally only recurses Error causes.
            testError.cause = "plain string cause";

            wideEvent.setError(testError);
            wideEvent.emit();

            // eslint-disable-next-line no-console
            const emitted = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;
            const serializedError = emitted?.error as Record<string, unknown>;

            expect(serializedError).toHaveProperty("message", "Wrapper");
            expect(serializedError).not.toHaveProperty("cause");
        });

        it("should not overflow on a circular cause chain", () => {
            expect.assertions(4);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            const errorA = new Error("Error A") as Error & { cause: unknown };
            const errorB = new Error("Error B") as Error & { cause: unknown };

            // Cyclic cause chain: a.cause = b; b.cause = a;
            errorA.cause = errorB;
            errorB.cause = errorA;

            wideEvent.setError(errorA);

            // Must NOT throw a RangeError / stack overflow (the latent-bug fix).
            expect(() => {
                wideEvent.emit();
            }).not.toThrow();

            // eslint-disable-next-line no-console
            const emitted = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;
            const serializedError = emitted?.error as Record<string, unknown>;
            const causeB = serializedError?.cause as Record<string, unknown>;

            expect(serializedError).toHaveProperty("message", "Error A");
            expect(causeB).toHaveProperty("message", "Error B");
            // The cycle back to A must terminate with a circular marker, not recurse forever.
            expect(causeB?.cause).toBe("[Circular]");
        });
    });

    describe("lifecycle logging", () => {
        it("should record info log entries", () => {
            expect.assertions(3);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.info("User validated");

            const logs = wideEvent.getRequestLogs();

            expect(logs).toHaveLength(1);
            expect(logs[0]?.level).toBe("info");
            expect(logs[0]?.message).toBe("User validated");
        });

        it("should record warn log entries", () => {
            expect.assertions(3);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.warn("Rate limit approaching");

            const logs = wideEvent.getRequestLogs();

            expect(logs).toHaveLength(1);
            expect(logs[0]?.level).toBe("warn");
            expect(logs[0]?.message).toBe("Rate limit approaching");
        });

        it("should record error log entries", () => {
            expect.assertions(3);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.error("Payment failed");

            const logs = wideEvent.getRequestLogs();

            expect(logs).toHaveLength(1);
            expect(logs[0]?.level).toBe("error");
            expect(logs[0]?.message).toBe("Payment failed");
        });

        it("should record debug log entries", () => {
            expect.assertions(3);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.debug("Cache miss for key xyz");

            const logs = wideEvent.getRequestLogs();

            expect(logs).toHaveLength(1);
            expect(logs[0]?.level).toBe("debug");
            expect(logs[0]?.message).toBe("Cache miss for key xyz");
        });

        it("should include context in log entries when provided", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.info("Cart validated", { itemCount: 3 });

            const logs = wideEvent.getRequestLogs();

            expect(logs[0]?.context).toStrictEqual({ itemCount: 3 });
        });

        it("should not include context when not provided", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.info("Simple message");

            const logs = wideEvent.getRequestLogs();

            expect(logs[0]?.context).toBeUndefined();
        });

        it("should include timestamps in log entries", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.info("test");

            const logs = wideEvent.getRequestLogs();

            expect(logs[0]?.timestamp).toMatch(ISO_TIMESTAMP_REGEX);
        });

        it("should record multiple entries in order", () => {
            expect.assertions(4);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.info("Step 1");
            wideEvent.debug("Step 2");
            wideEvent.warn("Step 3");
            wideEvent.info("Step 4");

            const logs = wideEvent.getRequestLogs();

            expect(logs).toHaveLength(4);
            expect(logs[0]?.message).toBe("Step 1");
            expect(logs[1]?.message).toBe("Step 2");
            expect(logs[3]?.message).toBe("Step 4");
        });

        it("should include requestLogs in emitted event", () => {
            expect.assertions(2);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.info("Step 1");
            wideEvent.info("Step 2");
            wideEvent.emit();

            const emitted = consoleSpy.mock.calls[0]?.[0] as Record<string, unknown>;
            const requestLogs = emitted?.requestLogs as Record<string, unknown>[];

            expect(requestLogs).toHaveLength(2);
            expect(requestLogs[0]?.message).toBe("Step 1");
        });

        it("should return this for chaining from lifecycle methods", () => {
            expect.assertions(4);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            expect(wideEvent.info("a")).toBe(wideEvent);
            expect(wideEvent.warn("b")).toBe(wideEvent);
            expect(wideEvent.error("c")).toBe(wideEvent);
            expect(wideEvent.debug("d")).toBe(wideEvent);
        });
    });

    describe("level escalation", () => {
        it("should start at info level", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            expect(wideEvent.getLevel()).toBe("info");
        });

        it("should escalate to warn when warn() is called", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.warn("something concerning");

            expect(wideEvent.getLevel()).toBe("warn");
        });

        it("should escalate to error when error() is called", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.error("something broke");

            expect(wideEvent.getLevel()).toBe("error");
        });

        it("should not de-escalate from error to warn", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.error("broke");
            wideEvent.warn("just a warning");

            expect(wideEvent.getLevel()).toBe("error");
        });

        it("should not de-escalate from warn to info", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.warn("warning");
            wideEvent.info("all good");

            expect(wideEvent.getLevel()).toBe("warn");
        });

        it("should not de-escalate from error to debug", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.error("error");
            wideEvent.debug("debug");

            expect(wideEvent.getLevel()).toBe("error");
        });

        it("should report error level when setError is used", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.setError(new Error("fail"));

            expect(wideEvent.getLevel()).toBe("error");
        });

        it("should escalate to error when error() is called with an Error", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.error("DB failed", new Error("connection timeout"));

            expect(wideEvent.getLevel()).toBe("error");
        });

        it("should use escalated level for pail log type on emit", () => {
            expect.assertions(2);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.warn("elevated warning");
            wideEvent.emit();

            // Pail's "warn" type uses log level "warning" which the RawReporter
            // routes through console.log, so we verify console.log was called
            // with the payload and the event level was escalated to "warn"
            expect(consoleSpy).toHaveBeenCalledTimes(1);
            expect(wideEvent.getLevel()).toBe("warn");
        });
    });

    describe("setError", () => {
        it("should attach an error", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });
            const testError = new Error("test error");

            wideEvent.setError(testError);
            wideEvent.emit();

            // eslint-disable-next-line no-console
            const emitted = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;

            expect(emitted).toHaveProperty("error");
        });

        it("should return this for chaining", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            expect(wideEvent.setError(new Error("test"))).toBe(wideEvent);
        });
    });

    describe("setStatus", () => {
        it("should set HTTP status code", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.setStatus(201);
            wideEvent.emit();

            const emitted = consoleSpy.mock.calls[0]?.[0] as Record<string, unknown>;

            expect(emitted).toHaveProperty("status", 201);
        });

        it("should return this for chaining", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            expect(wideEvent.setStatus(200)).toBe(wideEvent);
        });
    });

    describe("finish", () => {
        it("should emit with status", () => {
            expect.assertions(2);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "api.checkout", pail });

            wideEvent.set({ user: { id: 1 } });
            wideEvent.finish({ status: 200 });

            const emitted = consoleSpy.mock.calls[0]?.[0] as Record<string, unknown>;

            expect(emitted).toHaveProperty("status", 200);
            expect(emitted).toHaveProperty("user", { id: 1 });
        });

        it("should emit with error", () => {
            expect.assertions(2);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });
            const testError = new Error("DB timeout");

            wideEvent.finish({ error: testError, status: 500 });

            // eslint-disable-next-line no-console
            const emitted = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;

            expect(emitted).toHaveProperty("status", 500);
            expect(emitted).toHaveProperty("error");
        });

        it("should emit without options", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.finish();

            expect(consoleSpy).toHaveBeenCalledTimes(1);
        });

        it("should only emit once even if finish is called multiple times", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.finish({ status: 200 });
            wideEvent.finish({ status: 500 });

            expect(consoleSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("getData", () => {
        it("should return empty object initially", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            expect(wideEvent.getData()).toStrictEqual({});
        });

        it("should return accumulated data", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.set({ a: 1 });
            wideEvent.set({ b: 2 });

            expect(wideEvent.getData()).toStrictEqual({ a: 1, b: 2 });
        });
    });

    describe("getRequestLogs", () => {
        it("should return empty array initially", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            expect(wideEvent.getRequestLogs()).toStrictEqual([]);
        });
    });

    describe("symbol.dispose", () => {
        it("should auto-emit when disposed with autoEmit=true (default)", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ name: "test", pail });

            wideEvent.set({ key: "value" });
            wideEvent[Symbol.dispose]();

            expect(consoleSpy).toHaveBeenCalledTimes(1);
        });

        it("should not auto-emit when disposed with autoEmit=false", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.set({ key: "value" });
            wideEvent[Symbol.dispose]();

            expect(consoleSpy).not.toHaveBeenCalled();
        });

        it("should not double-emit if already emitted manually", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ name: "test", pail });

            wideEvent.emit();
            wideEvent[Symbol.dispose]();

            expect(consoleSpy).toHaveBeenCalledTimes(1);
        });

        it("should not double-emit if already finished", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ name: "test", pail });

            wideEvent.finish({ status: 200 });
            wideEvent[Symbol.dispose]();

            expect(consoleSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("chaining", () => {
        it("should support full chaining workflow", () => {
            expect.assertions(3);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "api.checkout", pail });

            wideEvent
                .set({ user: { id: 1 } })
                .info("User validated")
                .set({ cart: { items: 3 } })
                .info("Cart validated", { total: 9999 })
                .setStatus(200);

            wideEvent.emit();

            const emitted = consoleSpy.mock.calls[0]?.[0] as Record<string, unknown>;

            expect(emitted).toHaveProperty("user", { id: 1 });
            expect(emitted).toHaveProperty("cart", { items: 3 });
            expect(emitted).toHaveProperty("status", 200);
        });
    });

    describe("error() with Error attachment", () => {
        it("should attach error when provided to error()", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });
            const testError = new Error("DB connection failed");

            wideEvent.error("Database error", testError);
            wideEvent.emit();

            // eslint-disable-next-line no-console
            const emitted = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;

            expect(emitted).toHaveProperty("error");
        });

        it("should not overwrite error when error() is called without Error argument", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });
            const testError = new Error("First error");

            wideEvent.error("First problem", testError);
            wideEvent.error("Second problem");
            wideEvent.emit();

            // eslint-disable-next-line no-console
            const emitted = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;
            const serializedError = emitted?.error as Record<string, unknown>;

            expect(serializedError).toHaveProperty("message", "First error");
        });

        it("should overwrite error when error() is called with a new Error", () => {
            expect.assertions(1);

            const pail = createMockPail();
            const wideEvent = createWideEvent({ autoEmit: false, name: "test", pail });

            wideEvent.error("First problem", new Error("First error"));
            wideEvent.error("Second problem", new Error("Second error"));
            wideEvent.emit();

            // eslint-disable-next-line no-console
            const emitted = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;
            const serializedError = emitted?.error as Record<string, unknown>;

            expect(serializedError).toHaveProperty("message", "Second error");
        });
    });
});
