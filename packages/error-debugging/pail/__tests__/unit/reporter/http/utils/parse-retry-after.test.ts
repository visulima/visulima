import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseRetryAfter } from "../../../../../src/reporter/http/utils/retry";

describe(parseRetryAfter, () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("parses the delta-seconds form into milliseconds", () => {
        expect.assertions(2);

        expect(parseRetryAfter("2")).toBe(2000);
        expect(parseRetryAfter(" 5 ")).toBe(5000);
    });

    it("parses the HTTP-date form into a delay from now", () => {
        expect.assertions(1);

        // 30 seconds in the future.
        expect(parseRetryAfter("Thu, 01 Jan 2026 00:00:30 GMT")).toBe(30_000);
    });

    it("clamps absurdly large values to the maximum delay", () => {
        expect.assertions(1);

        // 999999 seconds would otherwise stall the pipeline indefinitely.
        expect(parseRetryAfter("999999")).toBe(60_000);
    });

    it("returns undefined for unparseable values (avoids setTimeout(NaN) firing immediately)", () => {
        expect.assertions(2);

        expect(parseRetryAfter("not-a-date")).toBeUndefined();
        expect(parseRetryAfter("")).toBeUndefined();
    });

    it("clamps a past HTTP-date to zero", () => {
        expect.assertions(1);

        expect(parseRetryAfter("Thu, 01 Jan 2026 00:00:00 GMT")).toBe(0);
    });
});
