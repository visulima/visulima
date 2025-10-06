import { describe, expect, it } from "vitest";

import xhrSwagger from "../../src/openapi/xhr";

describe("openapi:xhr", () => {
    it("should match snapshot", () => {
        expect.assertions(1);

        expect(xhrSwagger("http://localhost")).toMatchSnapshot();
    });

    it("should match snapshot with custom options", () => {
        expect.assertions(2);

        expect(xhrSwagger("http://localhost", "/files")).toMatchSnapshot();
        expect(xhrSwagger("http://localhost", "/files", ["test"])).toMatchSnapshot();
    });
});
