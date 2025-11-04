// packages/cerebro/__tests__/unit/constants.test.ts
import { describe, expect, it } from "vitest";

import {
    OUTPUT_NORMAL,
    OUTPUT_PLAIN,
    OUTPUT_RAW,
    POSITIONALS_KEY,
    VERBOSITY_DEBUG,
    VERBOSITY_NORMAL,
    VERBOSITY_QUIET,
    VERBOSITY_VERBOSE,
} from "../../src/constants";

describe("constants", () => {
    it("should export OUTPUT_NORMAL", () => {
        expect.assertions(1);

        expect(OUTPUT_NORMAL).toBe(1);
    });

    it("should export OUTPUT_RAW", () => {
        expect.assertions(1);

        expect(OUTPUT_RAW).toBe(2);
    });

    it("should export OUTPUT_PLAIN", () => {
        expect.assertions(1);

        expect(OUTPUT_PLAIN).toBe(4);
    });

    it("should export VERBOSITY_QUIET", () => {
        expect.assertions(1);

        expect(VERBOSITY_QUIET).toBe(16);
    });

    it("should export VERBOSITY_NORMAL", () => {
        expect.assertions(1);

        expect(VERBOSITY_NORMAL).toBe(32);
    });

    it("should export VERBOSITY_VERBOSE", () => {
        expect.assertions(1);

        expect(VERBOSITY_VERBOSE).toBe(64);
    });

    it("should export VERBOSITY_DEBUG", () => {
        expect.assertions(1);

        expect(VERBOSITY_DEBUG).toBe(128);
    });

    it("should export POSITIONALS_KEY", () => {
        expect.assertions(1);

        expect(POSITIONALS_KEY).toBe("positionals");
    });

    it("should have OUTPUT constants as powers of 2", () => {
        expect.assertions(3);

        expect(OUTPUT_NORMAL).toBe(1); // 2^0
        expect(OUTPUT_RAW).toBe(2); // 2^1
        expect(OUTPUT_PLAIN).toBe(4); // 2^2
    });

    it("should have VERBOSITY constants as powers of 2", () => {
        expect.assertions(4);

        expect(VERBOSITY_QUIET).toBe(16); // 2^4
        expect(VERBOSITY_NORMAL).toBe(32); // 2^5
        expect(VERBOSITY_VERBOSE).toBe(64); // 2^6
        expect(VERBOSITY_DEBUG).toBe(128); // 2^7
    });
});
