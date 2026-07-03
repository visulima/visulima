import { describe, expect, it, vi } from "vitest";

import EmailError from "../../../src/errors/email-error";
import { createProviderLogger, handleProviderError, isSuccessfulResponse, ProviderState } from "../../../src/providers/utils/provider-base";

describe(ProviderState, () => {
    it("should report uninitialized state", () => {
        expect.assertions(1);

        const state = new ProviderState();

        expect(state.initialized).toBe(false);
    });

    it("should mark initialized via setInitialized()", () => {
        expect.assertions(1);

        const state = new ProviderState();

        state.setInitialized();

        expect(state.initialized).toBe(true);
    });

    it("should call init function exactly once via ensureInitialized()", async () => {
        expect.assertions(2);

        const state = new ProviderState();
        const init = vi.fn().mockResolvedValue(undefined);

        await state.ensureInitialized(init, "test");
        await state.ensureInitialized(init, "test");

        expect(init).toHaveBeenCalledTimes(1);
        expect(state.initialized).toBe(true);
    });

    it("should throw EmailError when init function fails", async () => {
        expect.assertions(1);

        const state = new ProviderState();
        const init = vi.fn().mockRejectedValue(new Error("boom"));

        await expect(state.ensureInitialized(init, "test")).rejects.toThrow(EmailError);
    });
});

describe(createProviderLogger, () => {
    it("should return a logger with debug/info/warn/error", () => {
        expect.assertions(4);

        const logger = createProviderLogger("test");

        expect(logger.debug).toBeTypeOf("function");
        expect(logger.info).toBeTypeOf("function");
        expect(logger.warn).toBeTypeOf("function");
        expect(logger.error).toBeTypeOf("function");
    });

    it("should accept a custom console", () => {
        expect.assertions(1);

        const customLogger = {
            debug: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            log: vi.fn(),
            warn: vi.fn(),
        } as unknown as Console;

        const logger = createProviderLogger("test", customLogger);

        expect(logger).toBeDefined();
    });
});

describe(isSuccessfulResponse, () => {
    it("should return false when success is false", () => {
        expect.assertions(1);

        expect(isSuccessfulResponse({ data: { statusCode: 200 }, success: false })).toBe(false);
    });

    it("should return false when data is undefined", () => {
        expect.assertions(1);

        expect(isSuccessfulResponse({ success: true })).toBe(false);
    });

    it("should return true for 2xx status codes", () => {
        expect.assertions(2);

        expect(isSuccessfulResponse({ data: { statusCode: 200 }, success: true })).toBe(true);
        expect(isSuccessfulResponse({ data: { statusCode: 299 }, success: true })).toBe(true);
    });

    it("should return false for non-2xx codes", () => {
        expect.assertions(2);

        expect(isSuccessfulResponse({ data: { statusCode: 199 }, success: true })).toBe(false);
        expect(isSuccessfulResponse({ data: { statusCode: 400 }, success: true })).toBe(false);
    });
});

describe(handleProviderError, () => {
    it("should return an EmailError with operation in message", () => {
        expect.assertions(2);

        const error = handleProviderError("test", "send email", new Error("upstream"));

        expect(error).toBeInstanceOf(EmailError);
        expect(error.message).toContain("Failed to send email");
    });

    it("should call logger.debug when provided", () => {
        expect.assertions(1);

        const logger = {
            debug: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
        };

        handleProviderError("test", "send email", new Error("upstream"), logger);

        expect(logger.debug).toHaveBeenCalledWith("Exception send email", new Error("upstream"));
    });
});
