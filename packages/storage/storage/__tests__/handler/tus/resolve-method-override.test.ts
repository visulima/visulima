import { describe, expect, it } from "vitest";

import { resolveMethodOverride } from "../../../src/handler/tus/tus-protocol";

describe(resolveMethodOverride, () => {
    it.each([
        ["no header", undefined, "POST", undefined],
        ["an empty header", " ", "POST", undefined],
        ["a POST tunnelled to PATCH", "patch", "POST", "PATCH"],
        ["a POST tunnelled to DELETE", "DELETE", "POST", "DELETE"],
        ["an override naming the request's own method", "PATCH", "PATCH", undefined],
    ])("answers %s with %j", (_, header, method, expected) => {
        expect.assertions(1);

        expect(resolveMethodOverride(header, method)).toBe(expected);
    });

    it.each([
        ["GET", "POST"],
        ["HEAD", "POST"],
        ["OPTIONS", "POST"],
        ["TRACE", "POST"],
        ["DELETE", "PATCH"],
        ["PATCH", "GET"],
    ])("refuses %s on a %s with 400", (header, method) => {
        expect.assertions(1);

        expect(() => resolveMethodOverride(header, method)).toThrow(expect.objectContaining({ statusCode: 400 }));
    });
});
