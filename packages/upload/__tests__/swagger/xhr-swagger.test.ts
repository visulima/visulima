import { describe, expect, it } from "vitest";

import xhrSwagger from "../../src/swagger/xhr-swagger";

describe("swagger:xhr", () => {
    it("should match snapshot", () => {
        // eslint-disable-next-line radar/no-duplicate-string
        expect(xhrSwagger("http://localhost")).toMatchSnapshot();
    });

    it("should match snapshot with custom options", () => {
        expect(xhrSwagger("http://localhost", "/files")).toMatchSnapshot();
        expect(xhrSwagger("http://localhost", "/files", ["test"])).toMatchSnapshot();
    });
});
