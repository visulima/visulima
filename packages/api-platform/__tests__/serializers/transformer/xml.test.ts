import { describe, expect, it } from "vitest";

import xmlTransformer from "../../../src/serializers/transformer/xml";

describe("xml-transformer", () => {
    it("should be able to transform object to xml", () => {
        expect.assertions(1);

        expect(xmlTransformer({ foo: "bar" })).toBe("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<foo>bar</foo>");
    });
});
