import { describe, expect, it } from "vitest";

import WalkError from "../../../src/error/walk-error";

describe("walkError", () => {
    // WalkError can be instantiated with a cause and root path
    it("should instantiate WalkError with cause and root path", () => {
        expect.assertions(5);

        const cause = new Error("Test error");
        const root = "/path/to/root";
        const walkError = new WalkError(cause, root);

        expect(walkError).toBeInstanceOf(WalkError);
        expect((walkError as WalkError & { cause: Error }).cause).toBe(cause);
        expect(walkError.root).toBe(root);
        expect(walkError.message).toBe(`${cause.message} for path "${root}"`);
        expect(walkError.name).toBe("WalkError");
    });

    it("should include cause and root path in the error message", () => {
        expect.assertions(1);

        const cause = new Error("Test error");
        const root = "/path/to/root";
        const walkError = new WalkError(cause, root);

        expect(walkError.message).toBe(`${cause.message} for path "${root}"`);
    });

    it("should have the name \"WalkError\"", () => {
        expect.assertions(1);

        const walkError = new WalkError(null, "");

        expect(walkError.name).toBe("WalkError");
    });

    it("should allow null or undefined cause", () => {
        expect.assertions(2);

        const walkError1 = new WalkError(null, "");
        const walkError2 = new WalkError(undefined, "");

        expect((walkError1 as WalkError & { cause: Error }).cause).toBeNull();
        expect((walkError2 as WalkError & { cause: Error }).cause).toBeUndefined();
    });

    it("should allow cause to be an object that is not an instance of Error", () => {
        expect.assertions(2);

        const cause = new Error("Test error");
        const root = "/path/to/root";
        const walkError = new WalkError(cause, root);

        expect((walkError as WalkError & { cause: Error }).cause).toBe(cause);
        expect(walkError.message).toBe(`${cause.message} for path "${root}"`);
    });

    it("should allow root path to be an empty string", () => {
        expect.assertions(1);

        const walkError = new WalkError(null, "");

        expect(walkError.root).toBe("");
    });
});
