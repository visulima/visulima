import { describe, expect, it } from "vitest";

import errorHintFinder from "../../src/solution/error-hint-finder";

describe("solution/error-hint-finder", () => {
    it("returns undefined when no hint", async () => {
        expect.assertions(1);
        const error = new Error("x") as Error & { hint?: unknown };
        const res = await errorHintFinder.handle(error, { file: "f", line: 1 });
        expect(res).toBeUndefined();
    });

    it("returns body for string hint", async () => {
        expect.assertions(1);
        const error = new Error("x") as Error & { hint?: unknown };
        error.hint = "Try this";
        const res = await errorHintFinder.handle(error, { file: "f", line: 1 });
        expect(res?.body).toBe("Try this");
    });

    it("returns solution when hint is solution object", async () => {
        expect.assertions(2);
        const error = new Error("x") as Error & { hint?: unknown };
        error.hint = { body: "Fix it", header: "Header" };
        const res = await errorHintFinder.handle(error, { file: "f", line: 1 });
        expect(res?.body).toBe("Fix it");
        expect(res?.header).toBe("Header");
    });

    it("joins array hint", async () => {
        expect.assertions(1);
        const error = new Error("x") as Error & { hint?: unknown };
        error.hint = ["a", "b"];
        const res = await errorHintFinder.handle(error, { file: "f", line: 1 });
        expect(res?.body).toBe("a\nb");
    });
});
