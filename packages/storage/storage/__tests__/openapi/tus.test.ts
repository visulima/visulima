import { describe, expect, it } from "vitest";

import tusSwagger from "../../src/openapi/tus";

describe("openapi:tus", () => {
    it("should match snapshot", () => {
        expect.assertions(1);

        expect(tusSwagger("/files")).toMatchSnapshot();
    });

    it("should match snapshot with custom options", () => {
        expect.assertions(1);

        expect(tusSwagger("/files", ["test"])).toMatchSnapshot();
    });
});
