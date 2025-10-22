import { describe, expect, it } from "vitest";

import { ensureCamelCase, getResourceNameFromUrl } from "../../src/utils/get-resource-name-from-url";

describe(getResourceNameFromUrl, () => {
    it("should get the correct matching resource name", () => {
        expect.assertions(1);

        const url = "/api/foo";

        expect(getResourceNameFromUrl(url, { Foo: "foo" })).toStrictEqual({
            modelName: "Foo",
            resourceName: "foo",
        });
    });

    it("should ensure the string is in camel case", () => {
        expect.assertions(1);

        expect(ensureCamelCase("FooBar")).toBe("fooBar");
    });
});
