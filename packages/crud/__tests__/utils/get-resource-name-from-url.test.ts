import { expect, it } from "vitest";

import { ensureCamelCase, getResourceNameFromUrl } from "../../src/utils/get-resource-name-from-url";

it("should get the correct matching resource name", () => {
    const url = "/api/foo";

    expect(getResourceNameFromUrl(url, { Foo: "foo" })).toEqual({
        modelName: "Foo",
        resourceName: "foo",
    });
});

it("should ensure the string is in camel case", () => {
    expect(ensureCamelCase("FooBar")).toBe("fooBar");
});
