import { describe, expect, it } from "vitest";

import errorHintFinder from "../../src/solution/error-hint-finder";

describe("solution/error-hint-finder", () => {
    it("returns undefined when no hint", async () => {
        expect.assertions(1);

        const error = new Error("x") as Error & { hint?: unknown };
        const result = await errorHintFinder.handle(error, { file: "f", line: 1 });

        expect(result).toBeUndefined();
    });

    it("returns body for string hint", async () => {
        expect.assertions(1);

        const error = new Error("x") as Error & { hint?: unknown };

        error.hint = "Try this";
        const result = await errorHintFinder.handle(error, { file: "f", line: 1 });

        expect(result?.body).toBe("Try this");
    });

    it("returns solution when hint is solution object", async () => {
        expect.assertions(2);

        const error = new Error("x") as Error & { hint?: unknown };

        error.hint = { body: "Fix it", header: "Header" };
        const result = await errorHintFinder.handle(error, { file: "f", line: 1 });

        expect(result?.body).toBe("Fix it");
        expect(result?.header).toBe("Header");
    });

    it("joins array hint", async () => {
        expect.assertions(1);

        const error = new Error("x") as Error & { hint?: unknown };

        error.hint = ["a", "b"];
        const result = await errorHintFinder.handle(error, { file: "f", line: 1 });

        expect(result?.body).toBe("a\nb");
    });

    it("returns undefined for an empty string hint", async () => {
        expect.assertions(1);

        const error = new Error("x") as Error & { hint?: unknown };

        error.hint = "";
        const result = await errorHintFinder.handle(error, { file: "f", line: 1 });

        expect(result).toBeUndefined();
    });

    it("returns undefined for an object hint without a string body", async () => {
        expect.assertions(1);

        const error = new Error("x") as Error & { hint?: unknown };

        error.hint = { header: "only header" };
        const result = await errorHintFinder.handle(error, { file: "f", line: 1 });

        expect(result).toBeUndefined();
    });
});
