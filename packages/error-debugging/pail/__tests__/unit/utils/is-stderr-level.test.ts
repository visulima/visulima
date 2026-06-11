import { describe, expect, it } from "vitest";

import isStderrLevel from "../../../src/utils/is-stderr-level";

describe(isStderrLevel, () => {
    it("routes RFC 5424 high-severity levels to stderr", () => {
        expect.assertions(6);

        expect(isStderrLevel("error")).toBe(true);
        expect(isStderrLevel("warning")).toBe(true);
        expect(isStderrLevel("critical")).toBe(true);
        expect(isStderrLevel("alert")).toBe(true);
        expect(isStderrLevel("emergency")).toBe(true);
        expect(isStderrLevel("trace")).toBe(true);
    });

    it("routes low-severity levels to stdout", () => {
        expect.assertions(4);

        expect(isStderrLevel("informational")).toBe(false);
        expect(isStderrLevel("notice")).toBe(false);
        expect(isStderrLevel("debug")).toBe(false);
        // "warn" is a *type* name, never a level name — it must not be treated as stderr.
        expect(isStderrLevel("warn")).toBe(false);
    });
});
