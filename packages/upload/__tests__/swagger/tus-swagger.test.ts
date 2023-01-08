import { describe, expect, it } from "vitest";

import tusSwagger from "../../src/swagger/tus-swagger";

describe("swagger:tus", () => {
    it("should match snapshot", () => {
        expect(tusSwagger("/files")).toMatchSnapshot();
    });

    it("should match snapshot with custom options", () => {
        expect(tusSwagger("/files", ["test"])).toMatchSnapshot();
    });
});
