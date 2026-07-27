import { describe, expect, it } from "vitest";

import { isUserError, VisUserError } from "../../src/errors/vis-user-error";

describe(VisUserError, () => {
    it("should carry the message and a stable name", () => {
        expect.assertions(2);

        const error = new VisUserError("No matching projects found for: nope");

        expect(error.message).toBe("No matching projects found for: nope");
        expect(error.name).toBe("VisUserError");
    });

    it("should be an Error so existing catch sites keep working", () => {
        expect.assertions(1);

        expect(new VisUserError("boom")).toBeInstanceOf(Error);
    });
});

describe(isUserError, () => {
    it("should recognise a VisUserError", () => {
        expect.assertions(1);

        expect(isUserError(new VisUserError("boom"))).toBe(true);
    });

    it("should not claim a plain Error", () => {
        expect.assertions(1);

        // Genuine invariants keep their stack — only expected failures are
        // rendered message-only.
        expect(isUserError(new Error("boom"))).toBe(false);
    });

    it("should recognise a duplicated class emitted into another bundle chunk", () => {
        expect.assertions(1);

        // The brand check exists precisely so a second copy of the class
        // (different identity, same shape) still renders concisely.
        const fromOtherChunk = Object.assign(new Error("boom"), { isVisUserError: true });

        expect(isUserError(fromOtherChunk)).toBe(true);
    });

    it("should reject non-error values", () => {
        expect.assertions(3);

        expect(isUserError(undefined)).toBe(false);
        expect(isUserError("boom")).toBe(false);
        expect(isUserError({ isVisUserError: true })).toBe(false);
    });
});
