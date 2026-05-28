/* eslint-disable max-classes-per-file */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VERBOSITY_DEBUG, VERBOSITY_QUIET } from "../../../src/constants";

const { CallerProcessorMock, createPailMock, disableMock, getEnvMock, MessageFormatterProcessorMock } = vi.hoisted(() => {
    const disable = vi.fn();
    const create = vi.fn().mockImplementation((options: unknown) => {
        return {
            __options: options,
            disable,
        };
    });

    return {
        // eslint-disable-next-line @typescript-eslint/no-extraneous-class
        CallerProcessorMock: class CallerProcessor {},
        createPailMock: create,
        disableMock: disable,
        getEnvMock: vi.fn(),
        // eslint-disable-next-line @typescript-eslint/no-extraneous-class
        MessageFormatterProcessorMock: class MessageFormatterProcessor {},
    };
});

vi.mock(import("@visulima/pail/server"), () => {
    return {
        createPail: createPailMock,
    };
});

vi.mock(import("@visulima/pail/processor/caller"), () => {
    return {
        default: CallerProcessorMock,
    };
});

vi.mock(import("@visulima/pail/processor/message-formatter"), () => {
    return {
        default: MessageFormatterProcessorMock,
    };
});

vi.mock(import("../../../src/util/general/runtime-process"), () => {
    return {
        getEnv: getEnvMock,
    };
});

// eslint-disable-next-line import/first
import createPailLogger from "../../../src/logger/create-pail-logger";

interface CapturedOptions {
    logLevel: string;
    processors: unknown[];
}

const lastCallOptions = (): CapturedOptions => {
    const { calls } = createPailMock.mock;
    const last = calls.at(-1);

    if (!last) {
        throw new Error("createPailMock has not been called");
    }

    return last[0] as CapturedOptions;
};

describe(createPailLogger, () => {
    beforeEach(() => {
        createPailMock.mockClear();
        disableMock.mockClear();
        getEnvMock.mockReset();
        getEnvMock.mockReturnValue({});
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("creates a pail logger with informational level by default and a single MessageFormatterProcessor", () => {
        expect.assertions(3);

        createPailLogger();

        expect(createPailMock).toHaveBeenCalledTimes(1);

        const options = lastCallOptions();

        expect(options.logLevel).toBe("informational");
        expect(options.processors).toHaveLength(1);
    });

    it("respects an explicitly provided logLevel", () => {
        expect.assertions(1);

        createPailLogger({ logLevel: "error" });

        expect(lastCallOptions().logLevel).toBe("error");
    });

    it("maps CEREBRO_OUTPUT_LEVEL=64 (verbose) → 'trace'", () => {
        expect.assertions(1);

        getEnvMock.mockReturnValue({ CEREBRO_OUTPUT_LEVEL: "64" });

        createPailLogger();

        expect(lastCallOptions().logLevel).toBe("trace");
    });

    it("maps CEREBRO_OUTPUT_LEVEL=32 (normal) → 'informational'", () => {
        expect.assertions(1);

        getEnvMock.mockReturnValue({ CEREBRO_OUTPUT_LEVEL: "32" });

        createPailLogger();

        expect(lastCallOptions().logLevel).toBe("informational");
    });

    it("maps CEREBRO_OUTPUT_LEVEL=128 (debug) → 'debug' and appends CallerProcessor", () => {
        expect.assertions(2);

        getEnvMock.mockReturnValue({ CEREBRO_OUTPUT_LEVEL: String(VERBOSITY_DEBUG) });

        createPailLogger();

        const options = lastCallOptions();

        expect(options.logLevel).toBe("debug");
        // Both MessageFormatterProcessor and CallerProcessor present
        expect(options.processors).toHaveLength(2);
    });

    it("falls back to 'informational' for an unrecognised level value", () => {
        expect.assertions(1);

        getEnvMock.mockReturnValue({ CEREBRO_OUTPUT_LEVEL: "999" });

        createPailLogger();

        expect(lastCallOptions().logLevel).toBe("informational");
    });

    it("prepends built-in processors when user supplies extra processors", () => {
        expect.assertions(2);

        const userProcessor = { id: "user" };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createPailLogger({ processors: [userProcessor as any] });

        const options = lastCallOptions();

        expect(options.processors).toHaveLength(2);
        // User processor is appended after built-ins.
        expect(options.processors[1]).toBe(userProcessor);
    });

    it("calls disable() on the returned logger when CEREBRO_OUTPUT_LEVEL = VERBOSITY_QUIET", () => {
        expect.assertions(1);

        getEnvMock.mockReturnValue({ CEREBRO_OUTPUT_LEVEL: String(VERBOSITY_QUIET) });

        createPailLogger();

        expect(disableMock).toHaveBeenCalledTimes(1);
    });

    it("does not call disable() for non-quiet output levels", () => {
        expect.assertions(1);

        getEnvMock.mockReturnValue({ CEREBRO_OUTPUT_LEVEL: "32" });

        createPailLogger();

        expect(disableMock).not.toHaveBeenCalled();
    });
});
