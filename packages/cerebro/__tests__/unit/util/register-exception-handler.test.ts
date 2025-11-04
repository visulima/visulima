import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import registerExceptionHandler from "../../../src/util/general/register-exception-handler";

describe("register-exception-handler", () => {
    let mockLogger: {
        error: ReturnType<typeof vi.fn>;
    };

    let originalExit: typeof process.exit;

    beforeEach(() => {
        mockLogger = {
            error: vi.fn(),
        };

        // Mock process.exit to prevent test from actually exiting
        originalExit = process.exit;
        process.exit = vi.fn() as typeof process.exit;
    });

    afterEach(() => {
        // Restore original process.exit
        process.exit = originalExit;

        // Clean up any listeners
        process.removeAllListeners("uncaughtException");
        process.removeAllListeners("unhandledRejection");
    });

    it("should register uncaughtException handler", () => {
        expect.assertions(2);

        const cleanup = registerExceptionHandler(mockLogger as unknown as Console);
        const error = new Error("Test error");

        // Trigger uncaughtException
        process.emit("uncaughtException", error);

        expect(mockLogger.error).toHaveBeenCalledWith("Uncaught exception: Error: Test error");
        expect(mockLogger.error).toHaveBeenCalledWith(error.stack);

        cleanup();
    });

    it("should register unhandledRejection handler", () => {
        expect.assertions(2);

        const cleanup = registerExceptionHandler(mockLogger as unknown as Console);
        const error = new Error("Test rejection");

        // Trigger unhandledRejection
        process.emit("unhandledRejection", error);

        expect(mockLogger.error).toHaveBeenCalledWith("Promise rejection: Error: Test rejection");
        expect(mockLogger.error).toHaveBeenCalledWith(error.stack);

        cleanup();
    });

    it("should handle error without stack", () => {
        expect.assertions(1);

        const cleanup = registerExceptionHandler(mockLogger as unknown as Console);
        const error = { message: "Test error" } as Error;

        process.emit("uncaughtException", error);

        expect(mockLogger.error).toHaveBeenCalledTimes(1);

        cleanup();
    });

    it("should handle null error", () => {
        expect.assertions(1);

        const cleanup = registerExceptionHandler(mockLogger as unknown as Console);

        process.emit("uncaughtException", null);

        expect(mockLogger.error).toHaveBeenCalledWith("Uncaught exception: null");

        cleanup();
    });

    it("should handle undefined error", () => {
        expect.assertions(1);

        const cleanup = registerExceptionHandler(mockLogger as unknown as Console);

        process.emit("uncaughtException", undefined);

        expect(mockLogger.error).toHaveBeenCalledWith("Uncaught exception: undefined");

        cleanup();
    });

    it("should return cleanup function", () => {
        expect.assertions(0);

        const cleanup = registerExceptionHandler(mockLogger as unknown as Console);

        expectTypeOf(cleanup).toBeFunction();

        cleanup();
    });

    it("should remove handlers when cleanup is called", () => {
        expect.assertions(2);

        const cleanup = registerExceptionHandler(mockLogger as unknown as Console);

        // Cleanup
        cleanup();

        // Clear previous calls
        mockLogger.error.mockClear();

        // Trigger event after cleanup - use emit directly but handler should be removed
        const error = new Error("After cleanup");

        process.emit("uncaughtException", error);

        // Handler should not be called (process.exit should not be called either)
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(process.exit).not.toHaveBeenCalled();
    });

    it("should handle multiple handlers independently", () => {
        expect.assertions(2);

        const logger1 = { error: vi.fn() };
        const logger2 = { error: vi.fn() };

        const cleanup1 = registerExceptionHandler(logger1 as unknown as Console);
        const cleanup2 = registerExceptionHandler(logger2 as unknown as Console);

        process.emit("uncaughtException", new Error("Test"));

        expect(logger1.error).toHaveBeenCalledWith("Uncaught exception: Error: Test");
        // eslint-disable-next-line vitest/prefer-called-with
        expect(logger2.error).toHaveBeenCalled();

        cleanup1();
        cleanup2();
    });
});
