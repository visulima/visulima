import { describe, expect, it } from "vitest";

import { errorResponse, okResponse } from "../src/response";

describe(okResponse, () => {
    it("should serialize objects as compact JSON", () => {
        expect.assertions(2);

        const response = okResponse({ count: 2, items: ["a", "b"] });

        expect(response.isError).toBeUndefined();
        expect(response.content[0]!.text).toBe(JSON.stringify({ count: 2, items: ["a", "b"] }));
    });

    it("should pass through string payloads verbatim", () => {
        expect.assertions(1);

        const response = okResponse("plain text");

        expect(response.content[0]!.text).toBe("plain text");
    });
});

describe(errorResponse, () => {
    it("should set isError and wrap the error message", () => {
        expect.assertions(3);

        const response = errorResponse(new Error("boom"));

        expect(response.isError).toBe(true);
        expect(response.content[0]!.type).toBe("text");
        expect(JSON.parse(response.content[0]!.text)).toStrictEqual({ error: "boom" });
    });

    it("should stringify non-Error values", () => {
        expect.assertions(1);

        const response = errorResponse("raw string error");

        expect(JSON.parse(response.content[0]!.text)).toStrictEqual({ error: "raw string error" });
    });
});
