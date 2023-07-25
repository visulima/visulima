import { expect, test } from "vitest";

import { ensureCamelCase, getResourceNameFromUrl } from "../../src/utils/get-resource-name-from-url";

// eslint-disable-next-line vitest/require-top-level-describe
test("should get the correct matching resource name", () => {
    const url = "/api/foo";

    expect(getResourceNameFromUrl(url, { Foo: "foo" })).toStrictEqual({
        modelName: "Foo",
        resourceName: "foo",
    });
});

// eslint-disable-next-line vitest/require-top-level-describe
test("should ensure the string is in camel case", () => {
    expect(ensureCamelCase("FooBar")).toBe("fooBar");
});
