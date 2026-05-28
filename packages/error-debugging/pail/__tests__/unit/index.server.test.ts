import { afterEach, describe, expect, it, vi } from "vitest";

import { createPail, createPailError, pail, PailError } from "../../src/index.server";
import { PailServer } from "../../src/pail.server";

const getLogLevel = (logger: unknown): string => (logger as { options: { logLevel: string } }).options.logLevel;

describe("index.server", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("should expose a preconfigured default pail instance", () => {
        expect.assertions(1);

        expect(pail.info).toBeTypeOf("function");
    });

    it("should re-export the pail error helpers", () => {
        expect.assertions(2);

        expect(PailError).toBeTypeOf("function");
        expect(createPailError).toBeTypeOf("function");
    });

    it("should create a server logger instance via createPail", () => {
        expect.assertions(1);

        expect(createPail()).toBeInstanceOf(PailServer);
    });

    it("should prefer the PAIL_LOG_LEVEL environment variable", () => {
        expect.assertions(1);

        vi.stubEnv("PAIL_LOG_LEVEL", "alert");

        expect(getLogLevel(createPail())).toBe("alert");
    });

    it("should use the debug level when DEBUG is set", () => {
        expect.assertions(1);

        vi.stubEnv("PAIL_LOG_LEVEL", undefined);
        vi.stubEnv("DEBUG", "1");

        expect(getLogLevel(createPail())).toBe("debug");
    });

    it("should use the debug level when NODE_ENV is debug", () => {
        expect.assertions(1);

        vi.stubEnv("PAIL_LOG_LEVEL", undefined);
        vi.stubEnv("DEBUG", undefined);
        vi.stubEnv("NODE_ENV", "debug");

        expect(getLogLevel(createPail())).toBe("debug");
    });

    it("should use the warning level in the test environment", () => {
        expect.assertions(1);

        vi.stubEnv("PAIL_LOG_LEVEL", undefined);
        vi.stubEnv("DEBUG", undefined);
        vi.stubEnv("NODE_ENV", "test");

        expect(getLogLevel(createPail())).toBe("warning");
    });

    it("should fall back to the informational level otherwise", () => {
        expect.assertions(1);

        vi.stubEnv("PAIL_LOG_LEVEL", undefined);
        vi.stubEnv("DEBUG", undefined);
        vi.stubEnv("NODE_ENV", "production");

        expect(getLogLevel(createPail())).toBe("informational");
    });

    it("should allow overriding the resolved log level via options", () => {
        expect.assertions(1);

        expect(getLogLevel(createPail({ logLevel: "critical" }))).toBe("critical");
    });
});
