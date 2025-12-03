import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { createLogger } from "../../src/utils/create-logger";

describe(createLogger, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("without console", () => {
        it("should return no-op logger when no console provided", () => {
            expect.assertions(0);

            const logger = createLogger("test");

            expectTypeOf(logger.debug).toBeFunction();
            expectTypeOf(logger.error).toBeFunction();
            expectTypeOf(logger.info).toBeFunction();
            expectTypeOf(logger.warn).toBeFunction();
        });

        it("should not throw when calling no-op logger methods", () => {
            expect.assertions(4);

            const logger = createLogger("test");

            expect(() => logger.debug("test")).not.toThrow();
            expect(() => logger.error("test")).not.toThrow();
            expect(() => logger.info("test")).not.toThrow();
            expect(() => logger.warn("test")).not.toThrow();
        });
    });

    describe("with console", () => {
        it("should create logger with provider name prefix", () => {
            expect.assertions(4);

            const mockConsole = {
                error: vi.fn(),
                info: vi.fn(),
                log: vi.fn(),
                warn: vi.fn(),
            };

            const logger = createLogger("test-provider", mockConsole as unknown as Console);

            logger.debug("debug message");
            logger.error("error message");
            logger.info("info message");
            logger.warn("warn message");

            expect(mockConsole.log).toHaveBeenCalledWith("[test-provider] debug message");
            expect(mockConsole.error).toHaveBeenCalledWith("[test-provider] error message");
            expect(mockConsole.info).toHaveBeenCalledWith("[test-provider] info message");
            expect(mockConsole.warn).toHaveBeenCalledWith("[test-provider] warn message");
        });

        it("should pass additional arguments to console methods", () => {
            expect.assertions(2);

            const mockConsole = {
                error: vi.fn(),
                info: vi.fn(),
                log: vi.fn(),
                warn: vi.fn(),
            };

            const logger = createLogger("test", mockConsole as unknown as Console);

            logger.debug("message", { key: "value" }, 123);
            logger.error("error", new Error("test"));

            expect(mockConsole.log).toHaveBeenCalledWith("[test] message", { key: "value" }, 123);
            expect(mockConsole.error).toHaveBeenCalledWith("[test] error", expect.any(Error));
        });

        it("should use different prefixes for different providers", () => {
            expect.assertions(2);

            const mockConsole = {
                error: vi.fn(),
                info: vi.fn(),
                log: vi.fn(),
                warn: vi.fn(),
            };

            const logger1 = createLogger("provider1", mockConsole as unknown as Console);
            const logger2 = createLogger("provider2", mockConsole as unknown as Console);

            logger1.debug("message1");
            logger2.debug("message2");

            expect(mockConsole.log).toHaveBeenCalledWith("[provider1] message1");
            expect(mockConsole.log).toHaveBeenCalledWith("[provider2] message2");
        });
    });
});
