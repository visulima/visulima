import { describe, expect, it } from "vitest";

import { deserializeError, getErrorCauses, isErrorLike, serializeError } from "../../src/error";

describe("error serialisation on workerd", () => {
    it("should serialise a plain error to a JSON-safe payload", () => {
        expect.assertions(3);

        const serialized = serializeError(new Error("boom"));

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("boom");
        expect(JSON.stringify(serialized)).toBeTypeOf("string");
    });

    it("should serialise a cause chain", () => {
        expect.assertions(2);

        const serialized = serializeError(new Error("outer", { cause: new TypeError("inner") }));

        expect((serialized.cause as { name: string }).name).toBe("TypeError");
        expect((serialized.cause as { message: string }).message).toBe("inner");
    });

    it("should break a circular cause chain instead of recursing forever", () => {
        expect.assertions(1);

        const error: Error & { cause?: unknown } = new Error("circular");

        error.cause = error;

        expect(serializeError(error).cause).toBe("[Circular]");
    });

    it("should serialise an AggregateError with its `errors` array", () => {
        expect.assertions(2);

        const serialized = serializeError(new AggregateError([new Error("a"), new RangeError("b")], "many"));

        expect((serialized.errors as { name: string }[]).map((entry) => entry.name)).toStrictEqual(["Error", "RangeError"]);
        expect(serialized.message).toBe("many");
    });

    it("should honour a custom `toJSON` when `useToJSON` is enabled", () => {
        expect.assertions(1);

        class ApiError extends Error {
            public constructor() {
                super("api");
                this.name = "ApiError";
            }

            // eslint-disable-next-line class-methods-use-this
            public toJSON(): { marker: string } {
                return { marker: "from-toJSON" };
            }
        }

        expect(serializeError(new ApiError() as unknown as Error, { useToJSON: true })).toStrictEqual({ marker: "from-toJSON" });
    });

    it("should round-trip an error through serialise/deserialise", () => {
        expect.assertions(3);

        const restored = deserializeError(serializeError(new TypeError("round-trip", { cause: new Error("root") })));

        expect(restored).toBeInstanceOf(Error);
        expect(restored.message).toBe("round-trip");
        expect((restored.cause as Error).message).toBe("root");
    });

    it("should serialise a Web-standard value that only exists on the edge", () => {
        expect.assertions(1);

        // `Buffer` is absent from a bare Worker, but `URL` and typed arrays are always present. The
        // serializer must map them to their string form instead of an empty object.
        const error: Error & { url?: URL } = new Error("with url");

        error.url = new URL("https://example.com/a?b=1");

        expect(serializeError(error).url).toBe("https://example.com/a?b=1");
    });

    it("should walk a cause chain with `getErrorCauses`", () => {
        expect.assertions(2);

        const causes = getErrorCauses(new Error("a", { cause: new Error("b", { cause: new Error("c") }) }));

        expect(causes).toHaveLength(3);
        expect(causes.map((cause) => cause.message)).toStrictEqual(["a", "b", "c"]);
    });

    it("should stop `getErrorCauses` on a self-referencing cause", () => {
        expect.assertions(1);

        const error: Error & { cause?: unknown } = new Error("loop");

        error.cause = error;

        expect(getErrorCauses(error)).toHaveLength(1);
    });

    it("should recognise a structured-clone-style error payload as error-like", () => {
        expect.assertions(2);

        // Errors crossing a Worker boundary (queues, RPC, `structuredClone`) arrive as plain objects.
        expect(isErrorLike({ message: "boom", name: "Error", stack: "Error: boom\n    at handler (index.js:1:1)" })).toBe(true);
        expect(isErrorLike({ message: "boom" })).toBe(false);
    });
});
